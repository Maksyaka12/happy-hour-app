import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isAddress } from "https://esm.sh/viem@2";

const FOUNDATION = Deno.env.get("FOUNDATION_ADDRESS")!.toLowerCase();
const TICKET_UNIT = 0.1;
const MIN_DEPOSIT = 0.1;
const MAX_DEPOSIT = 500;
const CLOSE_BEFORE = 180;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
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
    if (act.asset !== "USDC") continue;
    if (act.toAddress?.toLowerCase() !== FOUNDATION) continue;

    const fromAddr = act.fromAddress?.toLowerCase();
    const txHash = act.hash?.toLowerCase();
    const amount = Number.parseFloat(act.value ?? "0");

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

    const cutoff = new Date(Date.now() + CLOSE_BEFORE * 1000).toISOString();
    const { data: round } = await supabase
      .from("rounds")
      .select("id")
      .eq("status", "open")
      .gte("ends_at", cutoff)
      .order("ends_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!round) {
      console.log(`[on-deposit] No open round available for tx ${txHash}`);
      continue;
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
