const env = import.meta.env

// export const FOUNDATION = env.VITE_FOUNDATION_ADDRESS || '0x1aA4aD048ADe8DC9e6b0eaA5F148f308dAB2E56f' // OLD: Founder EOA Wallet
export const FOUNDATION = env.VITE_FOUNDATION_ADDRESS || '0xdE76F43E17B1173947f63b72C85a2f0d9a97702F' // NEW: Vault Smart Contract
export const CHECKIN_TARGET = env.VITE_CHECKIN_ADDRESS || '0x7E861466bC2845C9f57051fb9652bC4a56d95542' // NEW: HappyHourPaymentsVault contract

export const USDC_ADDRESS =
  env.VITE_USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

export const BUILDER_CODE = env.VITE_BUILDER_CODE || 'bc_prbyi4yj'

export const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://xiyrzftdeefszsiukkjc.supabase.co'
export const SUPABASE_ANON = env.VITE_SUPABASE_ANON || 'sb_publishable_C1OnF0Bi-L1hcIsPfQ8_BQ_-eT3XLzK'
export const APP_URL = env.VITE_APP_URL || 'https://happy-hour-based.vercel.app'
export const HAS_SUPABASE_CONFIG = Boolean(SUPABASE_URL && SUPABASE_ANON)

export const WINNER_SHARE = 0.85
export const TICKET_UNIT = 0.1
export const CHECKIN_AMOUNT = 0.0001
export const BOOST_AMOUNT = 0.2
export const BOOST_HP = 2
export const CLOSE_BEFORE_MS = 3 * 60 * 1000

export const BET_OPTS = [0.1, 0.5, 1, 3, 5, 10]

export const STREAK_REWARDS = [
  { days: 3, pts: 1 },
  { days: 7, pts: 3 },
  { days: 14, pts: 7 },
  { days: 30, pts: 15 },
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

export const HH_ADDRESS =
  env.VITE_HH_ADDRESS || '0x8235EdF32a1e10Bd1867ad622915AB613664cbA3'

export const HH_RAFFLE_VAULT_ADDRESS =
  env.VITE_HH_RAFFLE_VAULT_ADDRESS || '0x5E861466bC2845C9f57051fb9652bC4a56d95542'

export const HH_MANAGER_ADDRESS =
  env.VITE_HH_MANAGER_ADDRESS || '0xC6f16466bC2845C9f57051fb9652bC4a56d95542'

export const STAKING_ADDRESS =
  env.VITE_STAKING_ADDRESS || '0xE6f16466bC2845C9f57051fb9652bC4a56d95542'


export const HH_ABI = [
  ...USDC_ABI,
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
]

export const STAKING_ABI = [
  {
    name: 'stake',
    type: 'function',
    inputs: [
      { name: '_amount', type: 'uint256' },
      { name: '_durationDays', type: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'unstake',
    type: 'function',
    inputs: [{ name: '_positionIndex', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'getUserPositions',
    type: 'function',
    inputs: [{ name: '_user', type: 'address' }],
    outputs: [
      {
        components: [
          { name: 'amount', type: 'uint256' },
          { name: 'startTime', type: 'uint256' },
          { name: 'endTime', type: 'uint256' },
          { name: 'apr', type: 'uint256' },
          { name: 'durationDays', type: 'uint256' },
          { name: 'active', type: 'bool' }
        ],
        type: 'tuple[]'
      }
    ],
    stateMutability: 'view',
  },
  {
    name: 'totalActiveStaked',
    type: 'function',
    inputs: [{ name: '_user', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
]


