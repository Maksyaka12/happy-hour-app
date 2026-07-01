import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  parseUnits,
} from "https://esm.sh/viem@2";
import { privateKeyToAccount } from "https://esm.sh/viem@2/accounts";
import { base } from "https://esm.sh/viem@2/chains";

const USDC_ADDRESS =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;
const WINNER_SHARE = 0.85;
const MAX_PAYOUT = 10_000;
const USDC_DECIMALS = 6;

const USDC_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const VAULT_ABI = [
  {
    name: "distributePrize",
    type: "function",
    inputs: [
      { name: "_winner", type: "address" },
      { name: "_winnerAmount", type: "uint256" },
      { name: "_foundation", type: "address" },
      { name: "_feeAmount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  }
] as const;

const USE_VAULT_CONTRACT = Deno.env.get("USE_VAULT_CONTRACT") === "true";
const VAULT_CONTRACT_ADDRESS = Deno.env.get("VAULT_CONTRACT_ADDRESS") as `0x${string}`;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function getBuilderDataSuffix(): `0x${string}` | undefined {
  const code = Deno.env.get("BUILDER_CODE") || Deno.env.get("BUILDER_CODE_DATA_SUFFIX");
  if (!code) return undefined;
  const cleanCode = code.trim();
  if (cleanCode.startsWith("0x")) return cleanCode as `0x${string}`;

  try {
    const hexCode = Array.from(cleanCode)
      .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('');
    const schemaId = '01';
    const marker = '80218021802180218021802180218021';
    return `0x${hexCode}${schemaId}${marker}` as `0x${string}`;
  } catch (e) {
    return undefined;
  }
}

function buildWalletClient() {
  const pk = Deno.env.get("BACKEND_SIGNER_PRIVATE_KEY")!;
  if (!pk) throw new Error("BACKEND_SIGNER_PRIVATE_KEY not set");
  let safePk = pk.trim();
  if (!safePk.startsWith("0x")) safePk = "0x" + safePk;
  const account = privateKeyToAccount(safePk as `0x${string}`);
  const dataSuffix = getBuilderDataSuffix();

  return createWalletClient({
    account,
    chain: base,
    transport: http(
      Deno.env.get("BASE_RPC_URL") ?? "https://mainnet.base.org",
      { timeout: 15000, retryCount: 1 }
    ),
    ...(dataSuffix ? { dataSuffix } : {}),
  });
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("RPC Timeout Exceeded")), ms))
  ]);
}

function secureRandom(max: number): number {
  if (max <= 0) throw new Error("max must be > 0");
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

function validatePayout(params: {
  winner: string;
  participants: string[];
  payout: number;
  totalPool: number;
  alreadyPaid: boolean;
  maxAllowed: number;
}) {
  const { winner, participants, payout, totalPool, alreadyPaid, maxAllowed } = params;
  if (!isAddress(winner)) throw new Error(`SECURITY: Invalid winner address: ${winner}`);
  if (!participants.map(p => p.toLowerCase()).includes(winner.toLowerCase())) {
    throw new Error(`SECURITY: Winner ${winner} not in participants list`);
  }
  if (alreadyPaid) throw new Error(`SECURITY: Round already paid`);
  if (payout > maxAllowed + 0.001) throw new Error(`SECURITY: Payout exceeds max allowed`);
  if (payout > MAX_PAYOUT) throw new Error(`SECURITY: Payout exceeds limit`);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const now = new Date();

  try {
    const { data: expiredRounds, error: fetchErr } = await supabase
      .from("rounds")
      .select("*")
      .in("status", ["open", "closed"])
      .eq("currency", "USDC")
      .lte("ends_at", new Date(now.getTime() + 2000).toISOString());

    if (fetchErr) throw fetchErr;
    if (!expiredRounds || expiredRounds.length === 0) {
      await ensureNextRound(now);
      return new Response(JSON.stringify({ ok: true }), { headers: CORS });
    }

    const processedRounds: any[] = [];

    for (const round of expiredRounds) {
      const { data: updated } = await supabase
        .from("rounds")
        .update({ status: "closed" })
        .eq("id", round.id)
        .eq("status", "open")
        .select("id");

      if (!updated || updated.length === 0) continue;

      const { data: bets } = await supabase
        .from("bets")
        .select("address, amount, tickets")
        .eq("round_id", round.id);

      if (!bets || bets.length === 0) {
        await supabase.from("rounds").update({ status: "done" }).eq("id", round.id);
        await ensureNextRound(now);
        continue;
      }

      const ticketPool: string[] = [];
      for (const bet of bets) {
        for (let i = 0; i < bet.tickets; i++) {
          ticketPool.push(bet.address.toLowerCase());
        }
      }

      const participants = [...new Set(bets.map(b => b.address.toLowerCase()))];
      const totalPool = bets.reduce((s, b) => s + parseFloat(b.amount), 0);

      let winner = participants.length === 1 ? participants[0] : ticketPool[secureRandom(ticketPool.length)];
      const winnerStake = bets.filter(b => b.address.toLowerCase() === winner.toLowerCase()).reduce((s, b) => s + parseFloat(b.amount), 0);
      let prize = participants.length === 1 ? totalPool : totalPool * WINNER_SHARE;

      if (participants.length > 1 && prize < winnerStake) prize = winnerStake;

      try {
        validatePayout({ winner, participants, payout: prize, totalPool, alreadyPaid: !!round.tx_hash_payout, maxAllowed: prize });
      } catch (secErr) {
        await supabase.from("rounds").update({ status: "done", payout_error: String(secErr) }).eq("id", round.id);
        continue;
      }

      await supabase.from("rounds").update({ status: "spinning", winner, prize }).eq("id", round.id);

      let txHash: string | undefined;
      try {
        const walletClient = buildWalletClient();
        const prizeRaw = parseUnits(prize.toFixed(USDC_DECIMALS), USDC_DECIMALS);
        const dataSuffix = getBuilderDataSuffix();
        let txPromise: Promise<any>;

        if (USE_VAULT_CONTRACT && VAULT_CONTRACT_ADDRESS) {
          const fee = totalPool - prize;
          const feeRaw = parseUnits(Math.max(0, fee).toFixed(USDC_DECIMALS), USDC_DECIMALS);
          txPromise = withTimeout(walletClient.writeContract({
            address: VAULT_CONTRACT_ADDRESS,
            abi: VAULT_ABI,
            functionName: "distributePrize",
            args: [winner as `0x${string}`, prizeRaw, walletClient.account.address, feeRaw],
            gas: 250000n,
            ...(dataSuffix ? { dataSuffix } : {}),
          }), 15000);
        } else {
          txPromise = withTimeout(walletClient.writeContract({
            address: USDC_ADDRESS,
            abi: USDC_ABI,
            functionName: "transfer",
            args: [winner as `0x${string}`, prizeRaw],
            gas: 65000n,
            ...(dataSuffix ? { dataSuffix } : {}),
          }), 15000);
        }

        txHash = await txPromise;
        await supabase.from("rounds").update({ tx_hash_payout: txHash }).eq("id", round.id);
        processedRounds.push({ id: round.id, winner, prize, participantsCount: participants.length });
      } catch (payErr) {
        await supabase.from("rounds").update({ status: "done", payout_error: String(payErr) }).eq("id", round.id);
      }
    }

    if (processedRounds.some(r => r.participantsCount >= 1)) {
      await new Promise(r => setTimeout(r, 8000));
    }

    for (const pr of processedRounds) {
      await supabase.from("rounds").update({ status: "done" }).eq("id", pr.id);
      await supabase.rpc("add_points", { p_address: pr.winner, p_points: 1.0, p_reason: `Won round ${pr.id}` });
      await supabase.rpc("increment_wins", { p_address: pr.winner });
    }

    await ensureNextRound(now);
    return new Response(JSON.stringify({ ok: true }), { headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), { status: 500, headers: CORS });
  }
});

async function ensureNextRound(now: Date) {
  const { data: existing } = await supabase.from("rounds").select("id").in("status", ["open", "spinning"]).eq("currency", "USDC").limit(1);
  if (existing && existing.length > 0) return;

  const nextHour = new Date(now);
  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);

  const startOf = new Date(nextHour);
  startOf.setUTCHours(startOf.getUTCHours() - 1);

  await supabase.from("rounds").insert({
    starts_at: startOf.toISOString(),
    ends_at: nextHour.toISOString(),
    status: "open",
    total_pot: 0,
    currency: "USDC",
  });
}
