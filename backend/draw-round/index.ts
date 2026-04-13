// backend/draw-round/index.ts
// ═══════════════════════════════════════════════════════════
// Запускається щогодини о :01 через Supabase Cron.
// 1. Знаходить раунди що закінчились
// 2. Обирає переможця (secureRandom)
// 3. Ставить status = 'spinning' → всі юзери бачать рулетку
// 4. Чекає 12 сек (анімація)
// 5. Надсилає 80% USDC переможцю через Smart Wallet + Builder Code
// 6. Ставить status = 'done'
// ═══════════════════════════════════════════════════════════

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

// ── Константи ────────────────────────────────────────────────
const USDC_ADDRESS =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;
const WINNER_SHARE  = 0.80;
const OWNER_SHARE   = 0.20;
const MAX_PAYOUT    = 10_000; // USDC — анти-хак ліміт
const USDC_DECIMALS = 6;

// ── ABI USDC transfer ────────────────────────────────────────
const USDC_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to",    type: "address" },
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

// ── Viem wallet client з Timeout ─────────────────────────────
function buildWalletClient() {
  const pk = Deno.env.get("BACKEND_SIGNER_PRIVATE_KEY")!;
  if (!pk) throw new Error("BACKEND_SIGNER_PRIVATE_KEY not set");

  let safePk = pk.trim();
  if (!safePk.startsWith("0x")) safePk = "0x" + safePk;

  const account = privateKeyToAccount(safePk as `0x${string}`);
  const BUILDER_CODE_SUFFIX = Deno.env.get("BUILDER_CODE_DATA_SUFFIX");

  // Ставимо жорсткий таймаут 15 сек на RPC, щоб Edge Function не висіла хвилину!
  return createWalletClient({
    account,
    chain: base,
    transport: http(
      Deno.env.get("BASE_RPC_URL") ?? "https://mainnet.base.org",
      { timeout: 15000, retryCount: 1 } // Анти-зависання
    ),
    ...(BUILDER_CODE_SUFFIX ? { dataSuffix: BUILDER_CODE_SUFFIX as `0x${string}` } : {}),
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
}) {
  const { winner, participants, payout, totalPool, alreadyPaid } = params;

  // 1. Валідна адреса
  if (!isAddress(winner)) {
    throw new Error(`SECURITY: Invalid winner address: ${winner}`);
  }

  // 2. Переможець дійсно брав участь у раунді
  if (!participants.map(p => p.toLowerCase()).includes(winner.toLowerCase())) {
    throw new Error(`SECURITY: Winner ${winner} not in participants list`);
  }

  // 3. Один пейаут на раунд
  if (alreadyPaid) {
    throw new Error(`SECURITY: Round already paid`);
  }

  // 4. Сума не перевищує 80% банку (або 100% якщо 1 гравець)
  const maxAllowed = participants.length === 1 ? totalPool : totalPool * WINNER_SHARE;
  if (payout > maxAllowed + 0.001) { // +0.001 для float tolerance
    throw new Error(`SECURITY: Payout ${payout} exceeds max allowed ${maxAllowed}`);
  }

  // 5. Глобальний ліміт анти-хак
  if (payout > MAX_PAYOUT) {
    throw new Error(`SECURITY: Payout ${payout} exceeds MAX_PAYOUT ${MAX_PAYOUT}`);
  }
}

// ── Головна функція ──────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  const now = new Date();
  console.log(`[draw-round] Starting at ${now.toISOString()}`);

  try {
    // Знаходимо раунди що закінчились і ще не розіграні
    const { data: expiredRounds, error: fetchErr } = await supabase
      .from("rounds")
      .select("*")
      .in("status", ["open", "closed"])
      .lte("ends_at", now.toISOString());

    if (fetchErr) throw fetchErr;

    if (!expiredRounds || expiredRounds.length === 0) {
      console.log("[draw-round] No rounds to draw");
      await ensureNextRound(now);
      return new Response(JSON.stringify({ ok: true, message: "No rounds to draw" }), { headers: CORS });
    }

    for (const round of expiredRounds) {
      console.log(`[draw-round] Processing round ${round.id}`);

      // Атомарно закриваємо — запобігаємо подвійному запуску
      const { data: updated, error: closeErr } = await supabase
        .from("rounds")
        .update({ status: "closed" })
        .eq("id", round.id)
        .eq("status", "open")
        .select("id");

      if (closeErr || !updated || updated.length === 0) {
        console.log(`[draw-round] Round ${round.id} already being processed or not open`);
        continue;
      }

      // ── Отримуємо всі ставки раунду ──
      const { data: bets } = await supabase
        .from("bets")
        .select("address, amount, tickets")
        .eq("round_id", round.id);

      if (!bets || bets.length === 0) {
        console.log(`[draw-round] Round ${round.id}: no bets`);
        await supabase.from("rounds").update({ status: "done" }).eq("id", round.id);
        await ensureNextRound(now);
        continue;
      }

      // ── Будуємо пул тікетів ──
      const ticketPool: string[] = [];
      for (const bet of bets) {
        for (let i = 0; i < bet.tickets; i++) {
          ticketPool.push(bet.address.toLowerCase());
        }
      }

      const participants = [...new Set(bets.map(b => b.address.toLowerCase()))];
      const totalPool = bets.reduce((s, b) => s + parseFloat(b.amount), 0);

      // ── Обираємо переможця ──
      let winner: string;
      if (participants.length === 1) {
        // Один учасник — повертаємо депозит
        winner = participants[0];
        console.log(`[draw-round] Round ${round.id}: single player, full refund`);
      } else {
        const idx = secureRandom(ticketPool.length);
        winner = ticketPool[idx];
        console.log(`[draw-round] Round ${round.id}: winner = ${winner}`);
      }

      const prize = participants.length === 1 ? totalPool : totalPool * WINNER_SHARE;

      // ── Перевірки безпеки ──
      try {
        validatePayout({
          winner,
          participants,
          payout: prize,
          totalPool,
          alreadyPaid: round.already_paid ?? false,
        });
      } catch (secErr) {
        console.error(`[draw-round] SECURITY CHECK FAILED:`, secErr);
        // Логуємо інцидент і пропускаємо — не платимо
        await supabase.from("rounds").update({
          status: "done",
          payout_error: String(secErr),
        }).eq("id", round.id);
        continue;
      }

      // ── Ставимо status = 'spinning' ──
      // Це сигнал для ВСІХ підключених юзерів запустити рулетку
      await supabase.from("rounds").update({
        status:  "spinning",
        winner:  winner,
        prize:   prize,
      }).eq("id", round.id);

      console.log(`[draw-round] Round ${round.id}: status=spinning, waiting for animation...`);

      // ── Надсилаємо USDC переможцю (ДО таймера, асинхронно, або під час) ──
      let txHash: string | undefined;
      let payoutError: string | undefined;

      try {
        const walletClient = buildWalletClient();
        const prizeRaw = parseUnits(prize.toFixed(USDC_DECIMALS), USDC_DECIMALS);

        const txPromise = withTimeout(walletClient.writeContract({
          address:      USDC_ADDRESS,
          abi:          USDC_ABI,
          functionName: "transfer",
          args:         [winner as `0x${string}`, prizeRaw],
        }), 15000);

        // Гарантуємо, що статус spinning протримається хоча б 6 секунд,
        // щоб фронтенди встигли його побачити і вивести анімацію
        const [txResult] = await Promise.allSettled([
          txPromise,
          new Promise(r => setTimeout(r, 6000))
        ]);

        if (txResult.status === "fulfilled") {
          txHash = txResult.value;
          console.log(`[draw-round] ✅ Payout sent: ${txHash}`);
        } else {
          throw txResult.reason;
        }

      } catch (payErr) {
        payoutError = String(payErr);
        console.error(`[draw-round] ❌ Payout failed:`, payErr);
      }

      // ── Фіналізуємо раунд ──
      // Видалено payout_error щоб уникнути крашу, якщо колонка відсутня в БД
      await supabase.from("rounds").update({
        status:         "done",
        tx_hash_payout: txHash,
      }).eq("id", round.id);

      // ── Оновлюємо статистику переможця ──
      if (!payoutError) {
        await supabase.rpc("add_points", {
          p_address: winner,
          p_points:  100,
          p_reason:  `Won round ${round.id}`,
        });
        await supabase.rpc("increment_wins", { p_address: winner });

        console.log(`[draw-round] ✅ Round ${round.id} complete. Winner: ${winner}, Prize: ${prize} USDC`);
      }
    }

    await ensureNextRound(now);

    return new Response(JSON.stringify({ ok: true }), {
      headers: CORS,
    });

  } catch (err) {
    console.error("[draw-round] Fatal error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: CORS,
    });
  }
});

// ── Створюємо наступний раунд якщо немає відкритого ──────────
async function ensureNextRound(now: Date) {
  const { data: existing } = await supabase
    .from("rounds")
    .select("id")
    .in("status", ["open", "spinning"])
    .limit(1);

  if (existing && existing.length > 0) return;

  // Наступна година
  const nextHour = new Date(now);
  nextHour.setUTCMinutes(0, 0, 0);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1);

  const startOf = new Date(nextHour);
  startOf.setUTCHours(startOf.getUTCHours() - 1);

  await supabase.from("rounds").insert({
    starts_at: startOf.toISOString(),
    ends_at:   nextHour.toISOString(),
    status:    "open",
    total_pot: 0,
  });

  console.log(`[draw-round] ✅ Created new round ending at ${nextHour.toISOString()}`);
}
