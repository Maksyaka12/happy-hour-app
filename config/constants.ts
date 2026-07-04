// ═══════════════════════════════════════════════════════════
// config/constants.ts
// Центральний файл всіх констант проекту.
// Імпортується і фронтендом, і бекенд-функціями.
// ═══════════════════════════════════════════════════════════

// ── Адреси ──────────────────────────────────────────────────
export const FOUNDATION_ADDRESS =
  "0x1aA4aD048ADe8DC9e6b0eaA5F148f308dAB2E56f" as `0x${string}`;
// ↑ Твій Coinbase Smart Wallet — на нього йдуть всі депозити

export const USDC_ADDRESS =
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`;
// ↑ Офіційний USDC на Base Mainnet

// ── Builder Code ────────────────────────────────────────────
// Отримай на base.dev → Settings → Builder Code
// Виглядає як: "bc_b7k3p9da"
export const BUILDER_CODE = "bc_prbyi4yj";

// Це автоматично генерується з Builder Code бібліотекою ox/erc8021
// Використовується як dataSuffix у КОЖНІЙ транзакції
// Генерується у wagmi config (frontend) та у viem client (backend)

// ── Параметри раунду ────────────────────────────────────────
export const WINNER_SHARE     = 0.80;   // 80% банку переможцю
export const TICKET_UNIT_USDC = 0.10;   // 1 тікет = 0.1 USDC
export const MIN_DEPOSIT_USDC = 0.10;   // мінімальна ставка
export const CLOSE_BEFORE_SEC = 180;    // депозити закриваються за 3 хв до кінця
export const CHECKIN_USDC     = 0.0001; // вартість чек-іну

// ── Ліміти безпеки (анти-хак) ───────────────────────────────
export const MAX_PAYOUT_USDC  = 10_000; // максимальний одноразовий пейаут
export const MAX_DEPOSIT_USDC = 500;    // максимальна одна ставка

// ── Chain ────────────────────────────────────────────────────
export const CHAIN_ID = 8453; // Base Mainnet

// ── Supabase (публічні ключі — безпечно у фронтенді) ─────────
// Замінюється реальними значеннями перед деплоєм
export const SUPABASE_URL  = "";
export const SUPABASE_ANON = "";
