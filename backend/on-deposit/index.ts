import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAddress, formatUnits } from "https://esm.sh/viem@2";

const FOUNDATION = (Deno.env.get("FOUNDATION_ADDRESS") || "0xdE76F43E17B1173947f63b72C85a2f0d9a97702F").toLowerCase();
const HH_RAFFLE_VAULT_ADDRESS = (Deno.env.get("HH_RAFFLE_VAULT_ADDRESS") || "0x3bdF461984142C473F2185B4F0F64a918B8ce49b").toLowerCase();
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913".toLowerCase();
const HH = "0x8235EdF32a1e10Bd1867ad622915AB613664cbA3".toLowerCase();
const TICKET_UNIT = 0.1; // 0.1 USD per ticket
const MIN_DEPOSIT = 0.1;
const MAX_DEPOSIT = 500;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
);

// Helper to fetch HH token price from DexScreener
async function getHHPrice(): Promise<number> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${HH}`);
    const data = await res.json();
    const pair = data.pairs?.[0];
    if (pair && pair.priceUsd) {
      return parseFloat(pair.priceUsd);
    }
  } catch (err) {
    console.error("[on-deposit] DexScreener API error:", err);
  }
  return 0.00025; // fallback HH price
}

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
    const isHh = tokenAddr === HH;

    if (!isUsdc && !isHh) {
      console.log(`[on-deposit] Skipping non-supported asset: ${act.asset} at ${tokenAddr}`);
      continue;
    }

    const targetAddr = act.toAddress?.toLowerCase();
    if (isUsdc && targetAddr !== FOUNDATION) continue;
    if (isHh && targetAddr !== HH_RAFFLE_VAULT_ADDRESS) continue;

    const fromAddr = act.fromAddress?.toLowerCase();
    const txHash = act.hash?.toLowerCase();

    let amount = Number.parseFloat(act.value ?? "0");
    if (!amount && act.rawContract?.rawValue) {
      const decimals = isHh ? 18 : 6;
      amount = Number.parseFloat(formatUnits(BigInt(act.rawContract.rawValue), decimals));
    }

    if (!fromAddr || !txHash || !isAddress(fromAddr)) {
      console.log(`[on-deposit] Invalid activity sender ${fromAddr}`);
      continue;
    }

    // Determine value in USD and calculate tickets
    let amountUsd = amount;
    if (isHh) {
      const hhPrice = await getHHPrice();
      amountUsd = amount * hhPrice;
      console.log(`[on-deposit] Deposited ${amount} HH ($${amountUsd} USD)`);
    }

    // Apply a 20% tolerance to account for minor price discrepancies/fluctuations between the frontend and DexScreener APIs
    const minAllowedUsd = MIN_DEPOSIT * 0.8;
    const maxAllowedUsd = MAX_DEPOSIT * 1.2;

    if (amountUsd < minAllowedUsd || amountUsd > maxAllowedUsd) {
      console.log(`[on-deposit] Invalid USD amount ${amountUsd} (limits: ${minAllowedUsd} - ${maxAllowedUsd})`);
      continue;
    }

    const tickets = Math.round(amountUsd / TICKET_UNIT);
    if (tickets < 1) {
      console.log(`[on-deposit] Amount yields 0 tickets: ${amountUsd}`);
      continue;
    }

    let { data: round, error: roundError } = await supabase
      .from("rounds")
      .select("id")
      .eq("status", "open")
      .eq("currency", isHh ? "HH" : "USDC")
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
          currency: isHh ? "HH" : "USDC",
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
      p_amount: amount, // Stores the token amount (USDC or HH)
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

    console.log(`[on-deposit] Recorded ${amount} ${isHh ? "HH" : "USDC"} from ${fromAddr} into round ${round.id}`);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
