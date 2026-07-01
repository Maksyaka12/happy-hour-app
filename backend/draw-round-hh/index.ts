// backend/draw-round-hh/index.ts
// ═══════════════════════════════════════════════════════════
// Запускається щогодини о :00 через Supabase Cron.
// 1. Знаходить раунди HH, що закінчились
// 2. Обирає переможця (secureRandom)
// 3. Ставить status = 'spinning' → всі юзери бачать рулетку
// 4. Чекає 8 сек (анімація)
// 5. Надсилає 85% HH переможцю та спалює 15% через HH Raffle Vault
// 6. Ставить status = 'done'
// ═══════════════════════════════════════════════════════════

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createWalletClient,
  http,
  isAddress,
  parseUnits,
} from "https://esm.sh/viem@2";
import { privateKeyToAccount } from "https://esm.sh/viem@2/accounts";
import { base } from "https://esm.sh/viem@2/chains";

// ── Константи ────────────────────────────────────────────────
const WINNER_SHARE = 0.85;
const MAX_PAYOUT = 100_000_000; // HH — анти-хак ліміт
const HH_DECIMALS = 18;
const STALE_SPINNING_MINUTES = 10; // скільки хвилин чекати перед force-done

// ── Supabase client ──────────────────────────────────────────
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// ── Helper для отримання суфікса ──────────────────────────────
function getBuilderDataSuffix(): `0x${string}` | undefined {
  const code = Deno.env.get("BUILDER_CODE") || Deno.env.get("BUILDER_CODE_DATA_SUFFIX");

  if (!code) {
    console.log("[draw-round-hh] ℹ️ No Builder Code found in secrets. Skipping attribution.");
    return undefined;
  }

  const cleanCode = code.trim();

  if (cleanCode.startsWith("0x")) {
    console.log("[draw-round-hh] ✅ Using raw Hex Builder Suffix from secrets.");
    return cleanCode as `0x${string}`;
  }

  try {
    const hexCode = Array.from(cleanCode)
      .map(c => c.charCodeAt(0).toString(16).padStart(2, '0'))
      .join('');
    const schemaId = '01';
    const marker = '80218021802180218021802180218021';
    const suffix = `0x${hexCode}${schemaId}${marker}` as `0x${string}`;

    console.log(`[draw-round-hh] ✅ Generated Builder Suffix from code: ${cleanCode}`);
    return suffix;
  } catch (e) {
    console.error(`[draw-round-hh] ❌ Failed to generate data suffix for code '${cleanCode}':`, e);
    return undefined;
  }
}

// ── Viem wallet client з Timeout ─────────────────────────────
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

// ── Promise Timeout Utils ────────────────────────────────────
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("RPC Timeout Exceeded")), ms))
  ]);
}

// ── Криптографічно захищений рандом ─────────────────────────
function secureRandom(max: number): number {
  if (max <= 0) throw new Error("max must be > 0");
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % max;
}

// ── Перевірки безпеки перед пейаутом ────────────────────────
function validatePayout(params: {
  winner: string;
  participants: string[];
  payout: number;
  totalPool: number;
  alreadyPaid: boolean;
  maxAllowed: number;
}) {
  const { winner, participants, payout, totalPool, alreadyPaid, maxAllowed } = params;

  if (!isAddress(winner)) {
    throw new Error(`SECURITY: Invalid winner address: ${winner}`);
  }

  if (!participants.map(p => p.toLowerCase()).includes(winner.toLowerCase())) {
    throw new Error(`SECURITY: Winner ${winner} not in participants list`);
  }

  if (alreadyPaid) {
    throw new Error(`SECURITY: Round already paid`);
  }

  if (payout > maxAllowed + 0.001) {
    throw new Error(`SECURITY: Payout ${payout} exceeds max allowed ${maxAllowed}`);
  }

  if (payout > MAX_PAYOUT) {
    throw new Error(`SECURITY: Payout ${payout} exceeds limit ${MAX_PAYOUT} HH`);
  }
}

// ── Відновлення застряглих spinning раундів ──────────────────
// Якщо раунд завис у spinning довше STALE_SPINNING_MINUTES — примусово done
async function recoverStaleSpinningRounds(now: Date) {
  const staleThreshold = new Date(now.getTime() - STALE_SPINNING_MINUTES * 60 * 1000);

  const { data: staleRounds } = await supabase
    .from("rounds")
    .select("id, ends_at, winner")
    .eq("status", "spinning")
    .eq("currency", "HH")
    .lt("ends_at", staleThreshold.toISOString());

  if (!staleRounds || staleRounds.length === 0) return;

  for (const r of staleRounds) {
    console.warn(`[draw-round-hh] ⚠️ Force-closing stale spinning round ${r.id} (ended ${r.ends_at})`);
    await supabase.from("rounds").update({
      status: "done",
      payout_error: "Force-closed: stuck in spinning for >" + STALE_SPINNING_MINUTES + " minutes",
    }).eq("id", r.id).eq("status", "spinning");
  }

  console.log(`[draw-round-hh] ✅ Recovered ${staleRounds.length} stale HH spinning round(s)`);
}

// ── Головна функція ──────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const now = new Date();
  console.log(`[draw-round-hh] Starting at ${now.toISOString()}`);

  try {
    // ── КРОК 0: Відновлення застряглих spinning раундів ──────
    await recoverStaleSpinningRounds(now);

    // Шукаємо відкриті або закриті раунди HH, які вже завершилися
    const { data: expiredRounds, error: fetchErr } = await supabase
      .from("rounds")
      .select("*")
      .in("status", ["open", "closed"])
      .eq("currency", "HH")
      .lte("ends_at", new Date(now.getTime() + 2000).toISOString());

    if (fetchErr) throw fetchErr;

    if (!expiredRounds || expiredRounds.length === 0) {
      console.log("[draw-round-hh] No HH rounds to draw");
      await ensureNextRound(now);
      return new Response(JSON.stringify({ ok: true, message: "No HH rounds to draw" }), { headers: CORS });
    }

    const processedRounds: Array<{
      id: number;
      winner: string;
      prize: number;
      currency: string;
      txHash: string;
      participantsCount: number;
    }> = [];

    for (const round of expiredRounds) {
      // Атомарно закриваємо раунд
      const { data: updated, error: closeErr } = await supabase
        .from("rounds")
        .update({ status: "closed" })
        .eq("id", round.id)
        .eq("status", "open")
        .select("id");

      if (closeErr || !updated || updated.length === 0) {
        continue;
      }

      console.log(`[draw-round-hh] ✅ Processing HH round ${round.id}`);

      // Завантажуємо ставки з таблиці bets_hh
      const { data: bets } = await supabase
        .from("bets_hh")
        .select("address, amount, tickets")
        .eq("round_id", round.id);

      if (!bets || bets.length === 0) {
        console.log(`[draw-round-hh] Round ${round.id}: no bets`);
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

      let winner: string;
      if (participants.length === 1) {
        winner = participants[0];
        console.log(`[draw-round-hh] Round ${round.id}: single player, full refund`);
      } else {
        const idx = secureRandom(ticketPool.length);
        winner = ticketPool[idx];
        console.log(`[draw-round-hh] Round ${round.id}: winner = ${winner}`);
      }

      const winnerStake = bets
        .filter(b => b.address.toLowerCase() === winner.toLowerCase())
        .reduce((s, b) => s + parseFloat(b.amount), 0);

      let prize = participants.length === 1 ? totalPool : totalPool * WINNER_SHARE;

      if (participants.length > 1 && prize < winnerStake) {
        console.log(`[draw-round-hh] Round ${round.id}: Prize adjusted to cover winner stake (${winnerStake} HH)`);
        prize = winnerStake;
      }

      try {
        validatePayout({
          winner,
          participants,
          payout: prize,
          totalPool,
          alreadyPaid: !!round.tx_hash_payout,
          maxAllowed: prize,
        });
      } catch (secErr) {
        console.error(`[draw-round-hh] SECURITY CHECK FAILED:`, secErr);
        await supabase.from("rounds").update({
          status: "done",
          payout_error: String(secErr),
        }).eq("id", round.id);
        continue;
      }

      await supabase.from("rounds").update({
        status: "spinning",
        winner: winner,
        prize: prize,
      }).eq("id", round.id);

      console.log(`[draw-round-hh] Round ${round.id}: status=spinning, sending transaction...`);

      let txHash: string | undefined;
      let payoutError: string | undefined;

      try {
        const walletClient = buildWalletClient();
        const hhRaffleVaultAddress = (Deno.env.get("HH_RAFFLE_VAULT_ADDRESS") || "0x3bdF461984142C473F2185B4F0F64a918B8ce49b") as `0x${string}`;

        // 1. Truncate totalPool down to 4 decimal places to prevent float rounding issues
        // e.g. 1819836.21479511 becomes 1819836.2147 (strictly rounded down)
        const safeTotalPool = Math.floor(totalPool * 10000) / 10000;
        console.log(`[draw-round-hh] Original totalPool: ${totalPool}, Truncated safeTotalPool: ${safeTotalPool}`);

        if (safeTotalPool <= 0) {
          throw new Error(`Total pool ${safeTotalPool} is too small to distribute.`);
        }

        // 2. Calculate safe prize and fee based on safeTotalPool
        let safePrize = participants.length === 1 ? safeTotalPool : safeTotalPool * WINNER_SHARE;

        // Apply winner stake protection if needed, but capped at the safeTotalPool
        if (participants.length > 1 && safePrize < winnerStake) {
          console.log(`[draw-round-hh] Adjusting safePrize from ${safePrize} to winnerStake ${winnerStake}`);
          safePrize = Math.min(winnerStake, safeTotalPool);
        }

        const safeFee = Math.max(0, safeTotalPool - safePrize);

        // 3. Convert to raw BigInt units (18 decimals)
        const prizeRaw = parseUnits(safePrize.toFixed(HH_DECIMALS), HH_DECIMALS);
        const feeRaw = parseUnits(safeFee.toFixed(HH_DECIMALS), HH_DECIMALS);

        // 4. Update prize in database to match the safePrize
        prize = safePrize;
        await supabase.from("rounds").update({ prize }).eq("id", round.id);

        console.log(`[draw-round-hh] Distributing: WinnerAmount = ${safePrize} HH, BurnAmount = ${safeFee} HH (Sum = ${safeTotalPool} HH)`);
        const dataSuffix = getBuilderDataSuffix();
        let txPromise: Promise<any>;

        txPromise = withTimeout(walletClient.writeContract({
          address: hhRaffleVaultAddress,
          abi: [
            {
              name: "distributePrize",
              type: "function",
              inputs: [
                { name: "_winner", type: "address" },
                { name: "_winnerAmount", type: "uint256" },
                { name: "_burnAmount", type: "uint256" },
              ],
              outputs: [],
              stateMutability: "nonpayable",
            }
          ] as const,
          functionName: "distributePrize",
          args: [winner as `0x${string}`, prizeRaw, feeRaw],
          gas: 250000n,
          ...(dataSuffix ? { dataSuffix } : {}),
        }), 15000);

        txHash = await txPromise;
        console.log(`[draw-round-hh] ✅ Payout sent: ${txHash}`);

        await supabase.from("rounds").update({
          tx_hash_payout: txHash,
        }).eq("id", round.id);

        processedRounds.push({
          id: round.id,
          winner,
          prize,
          currency: "HH",
          txHash,
          participantsCount: participants.length,
        });

      } catch (payErr) {
        payoutError = String(payErr);
        console.error(`[draw-round-hh] ❌ Payout failed for round ${round.id}:`, payErr);

        // Навіть якщо транзакція впала — закриваємо раунд щоб не застрягав
        await supabase.from("rounds").update({
          status: "done",
          payout_error: payoutError,
        }).eq("id", round.id);
      }
    }

    const needsSleep = processedRounds.some(r => r.participantsCount >= 1);
    if (needsSleep) {
      console.log(`[draw-round-hh] Sleeping 8s for frontend animation...`);
      await new Promise(r => setTimeout(r, 8000));
    }

    for (const pr of processedRounds) {
      await supabase.from("rounds").update({
        status: "done",
      }).eq("id", pr.id);

      await supabase.rpc("add_points", {
        p_address: pr.winner,
        p_points: 1.0,
        p_reason: `Won round ${pr.id}`,
      });
      await supabase.rpc("increment_wins", { p_address: pr.winner });

      console.log(`[draw-round-hh] ✅ Round ${pr.id} finalized. Winner: ${pr.winner}, Prize: ${pr.prize} HH`);
    }

    await ensureNextRound(now);

    return new Response(JSON.stringify({ ok: true }), {
      headers: CORS,
    });

  } catch (err) {
    console.error("[draw-round-hh] Fatal error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: CORS,
    });
  }
});

async function ensureNextRound(now: Date) {
  const cur = "HH";
  const { data: existing } = await supabase
    .from("rounds")
    .select("id")
    .eq("status", "open")   // ← ФІКС: тільки "open", НЕ "spinning"
    .eq("currency", cur)
    .limit(1);

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
    currency: cur,
  });

  console.log(`[draw-round-hh] ✅ Created new ${cur} round ending at ${nextHour.toISOString()}`);
}
