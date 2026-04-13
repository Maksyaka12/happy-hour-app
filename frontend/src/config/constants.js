const env = import.meta.env

export const FOUNDATION =
  env.VITE_FOUNDATION_ADDRESS || '0x753e38C804445428C730ec53063051Eddf85446c'

export const USDC_ADDRESS =
  env.VITE_USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

export const BUILDER_CODE = env.VITE_BUILDER_CODE || 'bc_prbyi4yj'

export const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://xiyrzftdeefszsiukkjc.supabase.co'
export const SUPABASE_ANON = env.VITE_SUPABASE_ANON || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpeXJ6ZnRkZWVmc3pzaXVra2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1NTc3MzgsImV4cCI6MjA5MTEzMzczOH0.uM1JOb9m2V-oq6IDZZGZhD4u9w2WeCRREav-9okOV9g'
export const APP_URL = env.VITE_APP_URL || 'https://happy-hour-based.vercel.app'
export const HAS_SUPABASE_CONFIG = Boolean(SUPABASE_URL && SUPABASE_ANON)

export const WINNER_SHARE = 0.8
export const TICKET_UNIT = 0.1
export const CHECKIN_AMOUNT = 0.0001
export const CLOSE_BEFORE_MS = 3 * 60 * 1000

export const BET_OPTS = [0.1, 0.5, 1, 5, 10, 30]

export const STREAK_REWARDS = [
  { days: 3, pts: 5 },
  { days: 7, pts: 10 },
  { days: 14, pts: 20 },
  { days: 30, pts: 50 },
]

export const USDC_ABI = [
  {
    name: 'transfer',
    type: 'function',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'balanceOf',
    type: 'function',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
]
