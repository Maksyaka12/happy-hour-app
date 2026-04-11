import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAddress, formatUnits } from "https://esm.sh/viem@2";

const FOUNDATION = (Deno.env.get("FOUNDATION_ADDRESS") || "0x753e38C804445428C730ec53063051Eddf85446c").toLowerCase();
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase();
const TICKET_UNIT = 0.1;
const MIN_DEPOSIT = 0.1;
const MAX_DEPOSIT = 500;
const CLOSE_BEFORE = 180;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
);

serve(async (req) => {
  const signingKey = Deno.env.get("ALCHEMY_SIGNING_KEY");
  let body: string;

  if (signingKey) {
    body = await req.text();
    const sig = req.headers.get("x-alchemy-signature");
    if (!sig) {
      return new Response("Unauthorized: missing signature", { status: 401 });
    }

    const encoder = new TextEncoder();
    const keyData = encoder.encode(signingKey);
    const msgData = encoder.encode(body);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
    const expected = Array.from(new Uint8Array(signature))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");

    if (sig !== expected) {
      return new Response("Unauthorized: invalid signature", { status: 401 });
    }
  } else {
    body = await req.text();
  }

  const payload = JSON.parse(body);
  const activities = payload?.event?.activity ?? [];

  for (const act of activities) {
    const tokenAddr = act.rawContract?.address?.toLowerCase();
    const isUsdc = act.asset === "USDC" || tokenAddr === USDC;

    if (!isUsdc) {
        console.log(`[on-deposit] Skipping non-USDC asset: ${act.asset} at ${tokenAddr}`);
        continue;
    }

    if (act.toAddress?.toLowerCase() !== FOUNDATION) continue;

    const fromAddr = act.fromAddress?.toLowerCase();
    const txHash = act.hash?.toLowerCase();
    
    let amount = Number.parseFloat(act.value ?? "0");
    if (!amount && act.rawContract?.rawValue) {
      amount = Number.parseFloat(formatUnits(BigInt(act.rawContract.rawValue), 6));
    }

    if (!fromAddr || !txHash || !isAddress(fromAddr)) {
      console.log(`[on-deposit] Invalid activity sender ${fromAddr}`);
      continue;
    }

    if (amount < MIN_DEPOSIT || amount > MAX_DEPOSIT) {
      console.log(`[on-deposit] Invalid amount ${amount}`);
      continue;
    }

    const tickets = Math.round(amount / TICKET_UNIT);
    if (Math.abs(tickets * TICKET_UNIT - amount) > 0.0001) {
      console.log(`[on-deposit] Amount not multiple of ${TICKET_UNIT}: ${amount}`);
      continue;
    }

    let { data: round, error: roundError } = await supabase
      .from("rounds")
      .select("id")
      .eq("status", "open")
      .order("ends_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (roundError) {
      console.error(`[on-deposit] Error fetching open round:`, roundError);
      continue;
    }

    if (!round) {
      console.log(`[on-deposit] No open round exists! Creating emergency round for tx ${txHash}`);
      const nextHour = new Date();
      nextHour.setUTCMinutes(0, 0, 0);
      nextHour.setUTCHours(nextHour.getUTCHours() + 1);

      const startOf = new Date(nextHour);
      startOf.setUTCHours(startOf.getUTCHours() - 1);

      const { data: newRound, error: createErr } = await supabase
        .from("rounds")
        .insert({
          starts_at: startOf.toISOString(),
          ends_at: nextHour.toISOString(),
          status: "open",
          total_pot: 0,
        })
        .select("id")
        .single();

      if (createErr || !newRound) {
        console.error(`[on-deposit] Failed to create emergency round:`, createErr);
        continue;
      }
      round = newRound;
    }

    const { data, error } = await supabase.rpc("record_deposit", {
      p_round_id: round.id,
      p_address: fromAddr,
      p_amount: amount,
      p_tickets: tickets,
      p_tx_hash: txHash,
      p_block_number: act.blockNum ? Number.parseInt(act.blockNum, 16) : null,
    });

    if (error) {
      console.error("[on-deposit] record_deposit failed:", error);
      continue;
    }

    if (data?.duplicate) {
      console.log(`[on-deposit] Duplicate deposit ${txHash}, skipping`);
      continue;
    }

    console.log(`[on-deposit] Recorded ${amount} USDC from ${fromAddr} into round ${round.id}`);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
