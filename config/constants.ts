const env = import.meta.env

export const FOUNDATION = env.VITE_FOUNDATION_ADDRESS || '0xdE76F43E17B1173947f63b72C85a2f0d9a97702F'
export const CHECKIN_TARGET = env.VITE_CHECKIN_ADDRESS || '0x7E861466bC2845C9f57051fb9652bC4a56d95542'

export const USDC_ADDRESS = env.VITE_USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
export const BUILDER_CODE = env.VITE_BUILDER_CODE || 'bc_prbyi4yj'

export const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://xiyrzftdeefszsiukkjc.supabase.co'
export const SUPABASE_ANON = env.VITE_SUPABASE_ANON || 'sb_publishable_C1OnF0Bi-L1hcIsPfQ8_BQ_-eT3XLzK'
export const APP_URL = (env.VITE_APP_URL && !env.VITE_APP_URL.includes('vercel.app')) ? env.VITE_APP_URL : 'https://happy-hour-based.app'
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
    inputs: [{ name: 'to', type: 'address' }, { name: 'value', type: 'uint256' }],
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
  {
    name: 'approve',
    type: 'function',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'value', type: 'uint256' }],
    outputs: [{ type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'allowance',
    type: 'function',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
]

export const HH_ADDRESS = env.VITE_HH_ADDRESS || '0x8235EdF32a1e10Bd1867ad622915AB613664cbA3'
export const HH_RAFFLE_VAULT_ADDRESS = env.VITE_HH_RAFFLE_VAULT_ADDRESS || '0x3bdF461984142C473F2185B4F0F64a918B8ce49b'
export const HH_MANAGER_ADDRESS = env.VITE_HH_MANAGER_ADDRESS || '0x13802fDe66BCf54BcebE2242aF0836A5Dfb45Fc8'
export const STAKING_ADDRESS = env.VITE_STAKING_ADDRESS || '0xFd23526111280b78FF4e7F38B1fAF5818B9c5214'

// V2 New Contract Addresses (to be deployed)
export const RAFFLE_V2_ADDRESS = env.VITE_RAFFLE_V2_ADDRESS || ''
export const DAILY_ADDRESS = env.VITE_DAILY_ADDRESS || ''
export const POINTS_ADDRESS = env.VITE_POINTS_ADDRESS || ''
export const MEMBERSHIP_ADDRESS = env.VITE_MEMBERSHIP_ADDRESS || ''
export const COORDINATOR_ADDRESS = env.VITE_COORDINATOR_ADDRESS || ''

export const HH_ABI = [...USDC_ABI]

export const STAKING_ABI = [
  {
    name: 'stake',
    type: 'function',
    inputs: [{ name: '_amount', type: 'uint256' }, { name: '_durationDays', type: 'uint256' }],
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
    outputs: [{
      components: [
        { name: 'amount', type: 'uint256' },
        { name: 'startTime', type: 'uint256' },
        { name: 'endTime', type: 'uint256' },
        { name: 'apr', type: 'uint256' },
        { name: 'durationDays', type: 'uint256' },
        { name: 'active', type: 'bool' }
      ],
      type: 'tuple[]'
    }],
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

// V2: HappyHourPoints ABI
export const POINTS_ABI = [
  { name: 'checkIn', type: 'function', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { name: 'getHP', type: 'function', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'getStreak', type: 'function', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  { name: 'canCheckIn', type: 'function', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { name: 'getBadges', type: 'function', inputs: [{ name: 'user', type: 'address' }], outputs: [{ components: [{ name: 'isHolder', type: 'bool' }, { name: 'isStaker', type: 'bool' }], type: 'tuple' }], stateMutability: 'view' },
]

// V2: HappyHourMembership ABI
export const MEMBERSHIP_ABI = [
  { name: 'subscribe', type: 'function', inputs: [{ name: 'token', type: 'address' }, { name: 'durationDays', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { name: 'isMember', type: 'function', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'bool' }], stateMutability: 'view' },
  { name: 'getExpiry', type: 'function', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
]

// V2: HappyHourCoordinator ABI
export const COORDINATOR_ABI = [
  { name: 'depositToRaffle', type: 'function', inputs: [{ name: 'amount', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { name: 'checkIn', type: 'function', inputs: [], outputs: [], stateMutability: 'nonpayable' },
  { name: 'stakeHH', type: 'function', inputs: [{ name: 'amount', type: 'uint256' }, { name: 'durationDays', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { name: 'unstakeHH', type: 'function', inputs: [{ name: 'positionIndex', type: 'uint256' }], outputs: [], stateMutability: 'nonpayable' },
  { name: 'isPremium', type: 'function', inputs: [{ name: 'user', type: 'address' }], outputs: [{ type: 'bool' }], stateMutability: 'view' },
]

// HP Tiers for deposits
export const HP_TIERS = [
  { min: 0.1, max: 10, tickets: [1, 100], hp: 1 },
  { min: 10.01, max: 50, tickets: [101, 500], hp: 2 },
  { min: 50.01, max: 100, tickets: [501, 1000], hp: 3 },
  { min: 100.01, max: Infinity, tickets: [1001, Infinity], hp: 5 },
]

export const BADGE_THRESHOLDS = { happyHolder: 100_000_000, happyStaker: 100_000_000 }
export const BADGE_BENEFITS = { happyHolder: { dailyHP: 5, winBonus: 2 }, happyStaker: { dailyHP: 10, winBonus: 5 } }

export const MEMBERSHIP_PRICING = { monthly: { days: 30, usd: 10 }, yearly: { days: 365, usd: 100 } }

export const THEME = {
  primary: '#0000FF', primaryLight: '#3C8AFF', primaryBg: '#EEF0F3', primaryBg2: '#F0F5FF',
  black: '#0A0B0D', white: '#FFFFFF', gray10: '#EEF0F3', gray15: '#DEE1E7',
  gray30: '#B1B7C3', gray50: '#717886', gray80: '#32353D',
  red: '#FC401F', green: '#059669', gold: '#D97706',
}
