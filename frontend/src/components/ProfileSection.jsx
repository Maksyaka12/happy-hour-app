import { useEffect, useMemo, useRef, useState } from 'react'
import { useWaitForTransactionReceipt, useDisconnect, useChainId, useSwitchChain, useWriteContract, useBalance } from 'wagmi'
import { parseUnits } from 'viem'
import { base } from 'wagmi/chains'
import { APP_URL, FOUNDATION, CHECKIN_TARGET, USDC_ADDRESS, USDC_ABI, CHECKIN_AMOUNT, BOOST_AMOUNT, BOOST_HP, STREAK_REWARDS } from '../config/constants'
import { db } from '../config/supabase'
import { TxModal } from './TxModal'
import { UserAvatar } from './UserAvatar'
import { HistorySection } from './HistorySection'
import { useBuilderWrite } from '../hooks/useBuilderWrite'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')
const todayUTC = () => new Date().toISOString().slice(0, 10)
const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF', '#FF9F1C', '#00B4D8', '#F72585', '#3A86FF', '#8338EC']
const pColor = (addr) => colors[parseInt(addr?.slice(2, 4) || '0', 16) % colors.length]

function normalizeUserRow(data) {
  return {
    streak: data?.streak ?? 0,
    streak_last: data?.streak_last ?? null,
    points: data?.points ?? 0,
    wins: data?.wins ?? 0,
    entries: data?.entries ?? 0,
    referral_count: data?.referral_count ?? 0,
    referral_points: data?.referral_points ?? 0,
    ref_code: data?.ref_code ?? null,
    boost_last: data?.boost_last ?? null,
    boost_last: data?.boost_last ?? null,
    active_multiplier: data?.active_multiplier ?? 1.0,
    multiplier_expires_at: data?.multiplier_expires_at ?? null,
    account_level: data?.account_level ?? 1,
  }
}

const LEVELS = [
  { level: 1, name: 'Basic',    mult: 1.0, price: 0.00 },
  { level: 2, name: 'Bronze',   mult: 1.2, price: 0.95 },
  { level: 3, name: 'Silver',   mult: 1.5, price: 1.75 },
  { level: 4, name: 'Gold',     mult: 1.7, price: 3.00 },
  { level: 5, name: 'MAX',      mult: 2.0, price: 5.00 },
]

export function ProfileSection({ address, basename }) {
  const { disconnect } = useDisconnect()
  const { writeContract: wagmiWriteContract } = useWriteContract()

  const rescueMyFunds = () => {
    if (!refundAmount || isNaN(refundAmount)) return;
    const amountBigInt = BigInt(Math.floor(parseFloat(refundAmount) * 1000000));

    wagmiWriteContract({
      address: '0xdE76F43E17B1173947f63b72C85a2f0d9a97702F',
      abi: [{
        name: 'rescueFunds',
        type: 'function',
        inputs: [
          { name: '_token', type: 'address' },
          { name: '_to', type: 'address' },
          { name: '_amount', type: 'uint256' }
        ],
        outputs: [],
        stateMutability: 'nonpayable'
      }],
      functionName: 'rescueFunds',
      args: [
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        '0x4c91D3BEd372C11795b9Ce9a9017dFE447Bf050a',
        amountBigInt
      ]
    })
  }

  const [refundAmount, setRefundAmount] = useState('')
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const [txModal, setTxModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copiedCode, setCopiedCode] = useState(false)

  const { data: vaultBalanceData } = useBalance({
    address: FOUNDATION,
    token: USDC_ADDRESS,
    query: {
      refetchInterval: 5000,
    }
  })
  const [streak, setStreak] = useState({ count: 0, last: null })
  const [userStats, setUserStats] = useState({
    points: 0,
    wins: 0,
    entries: 0,
    referral_count: 0,
    referral_points: 0,
    ref_code: null,
    referrer: null
  })
  const [checkedToday, setCheckedToday] = useState(false)
  const [boostedToday, setBoostedToday] = useState(false)
  const [activeMultiplier, setActiveMultiplier] = useState(1.0)
  const [multiplierExpiresAt, setMultiplierExpiresAt] = useState(null)
  const [accountLevel, setAccountLevel] = useState(1)
  const [timeLeft, setTimeLeft] = useState('')
  const [checkinError, setCheckinError] = useState('')
  const [boostError, setBoostError] = useState('')
  const [upgradeError, setUpgradeError] = useState('')

  // Bot Management State
  const [bots, setBots] = useState([])
  const [botCountInput, setBotCountInput] = useState(10)
  const [botMinPoints, setBotMinPoints] = useState(100)
  const [botMaxPoints, setBotMaxPoints] = useState(1000)
  const [isCreatingBots, setIsCreatingBots] = useState(false)
  const [editingBot, setEditingBot] = useState(null) // { address, points }
  const processedTxRef = useRef(null)
  const processedBoostTxRef = useRef(null)
  const processedMultTxRef = useRef(null)
  const today = todayUTC()

  const displayName = basename || short(address)
  const referralLink = useMemo(() => {
    const baseUrl = APP_URL.replace(/\/$/, '')
    return userStats.ref_code
      ? `${baseUrl}/r?ref=${userStats.ref_code}`
      : `${baseUrl}/r?ref=${address}` // Fallback while loading
  }, [address, userStats.ref_code])

  const isAdmin = address?.toLowerCase() === '0x4c91D3BEd372C11795b9Ce9a9017dFE447Bf050a'.toLowerCase()

  const loadProfile = async () => {
    if (!address) return
    const { data, error } = await db
      .from('users')
      .select('streak, streak_last, boost_last, points, wins, entries, referral_count, referral_points, ref_code, active_multiplier, multiplier_expires_at, referrer, account_level')
      .eq('address', address.toLowerCase())
      .maybeSingle()

    if (error) {
      console.error('loadProfile:', error)
      return
    }

    const user = normalizeUserRow(data)
    setStreak({ count: user.streak, last: user.streak_last })
    setCheckedToday(user.streak_last === today)
    setBoostedToday(user.boost_last === today)
    setActiveMultiplier(user.active_multiplier)
    setMultiplierExpiresAt(user.multiplier_expires_at)
    setAccountLevel(user.account_level)
    setUserStats({
      points: user.points,
      wins: user.wins,
      entries: user.entries,
      referral_count: user.referral_count,
      referral_points: user.referral_points,
      ref_code: user.ref_code,
      referrer: data?.referrer || null
    })
  }

  useEffect(() => {
    loadProfile()
    if (isAdmin) loadBots()
  }, [address, today])

  const loadBots = async () => {
    const { data } = await db.from('users').select('*').eq('is_bot', true).order('points', { ascending: false })
    setBots(data || [])
  }

  const handleCreateBots = async () => {
    setIsCreatingBots(true)
    await db.rpc('create_bots', {
      p_count: Number(botCountInput),
      p_min_points: Number(botMinPoints),
      p_max_points: Number(botMaxPoints)
    })
    await loadBots()
    setIsCreatingBots(false)
  }

  const handleUpdateBotPoints = async (botAddr, newPts) => {
    // Handle both dot and comma as decimal separators
    const val = String(newPts).replace(',', '.');
    const points = parseFloat(val);
    
    if (isNaN(points)) {
      setEditingBot(null);
      return;
    }

    const { error } = await db.rpc('update_bot_points', {
      p_admin_address: address.toLowerCase(),
      p_bot_address: botAddr,
      p_new_points: points
    })

    if (error) {
      console.error('Update bot points error:', error);
      alert('Error updating points: ' + error.message);
    }

    setEditingBot(null)
    await loadBots()
  }

  const handleDeleteBot = async (botAddr) => {
    await db.rpc('delete_bot', {
      p_admin_address: address.toLowerCase(),
      p_bot_address: botAddr
    })
    await loadBots()
  }

  const handleDeleteBots = async () => {
    console.log('Resetting bots...')
    const { data, error } = await db.rpc('delete_all_bots', { p_admin_address: address.toLowerCase() })
    if (error) console.error('Delete bots error:', error)
    await loadBots()
  }

  // --- Timer Effect ---
  useEffect(() => {
    if (!multiplierExpiresAt || activeMultiplier <= 1) {
      setTimeLeft('')
      return
    }
    const interval = setInterval(() => {
      const diff = new Date(multiplierExpiresAt).getTime() - new Date().getTime()
      if (diff <= 0) {
        setTimeLeft('')
        setActiveMultiplier(1.0)
        clearInterval(interval)
      } else {
        const h = Math.floor(diff / (1000 * 60 * 60))
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const s = Math.floor((diff % (1000 * 60)) / 1000)
        setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [multiplierExpiresAt, activeMultiplier])

  const canCheckin = !checkedToday
  const canBoost = !boostedToday

  const { data: txHash, writeContract, isPending, isConfirming, isSuccess, error: writeError, reset } = useBuilderWrite()
  const { data: boostTxHash, writeContract: writeBoost, isPending: isPendingBoost, isConfirming: isConfirmingBoost, isSuccess: isSuccessBoost, error: boostWriteError, reset: resetBoost } = useBuilderWrite()
  const { data: upgradeTxHash, writeContract: writeUpgrade, isPending: isPendingUpgrade, isConfirming: isConfirmingUpgrade, isSuccess: isSuccessUpgrade, error: upgradeWriteError, reset: resetUpgrade } = useBuilderWrite()

  const [selectedLevel, setSelectedLevel] = useState(null)

  useEffect(() => {
    if (!isSuccess || !txHash || processedTxRef.current === txHash || !address) return

    processedTxRef.current = txHash
    setCheckinError('')

    db.rpc('process_checkin', {
      p_address: address.toLowerCase(),
      p_tx_hash: txHash,
    }).then(async ({ data, error }) => {
      if (error) {
        console.error('process_checkin:', error)
        setCheckinError('Check-in saved onchain, but database sync failed. Reloading profile…')
        await loadProfile()
        return
      }

      if (!data?.ok) {
        setCheckinError(data?.error || 'Check-in was not accepted.')
        await loadProfile()
        return
      }

      setCheckedToday(true)
      setStreak({ count: data.newStreak, last: today })
      setUserStats((stats) => ({ ...stats, points: stats.points + (data.ptsEarned ?? 0) }))
      setTxModal(false)
    }).finally(() => {
      reset()
    })
  }, [address, isSuccess, txHash, today, reset])

  // --- Boost Effect ---
  useEffect(() => {
    if (!isSuccessBoost || !boostTxHash || processedBoostTxRef.current === boostTxHash || !address) return

    processedBoostTxRef.current = boostTxHash
    setBoostError('')

    db.rpc('process_hp_boost', {
      p_address: address.toLowerCase(),
      p_tx_hash: boostTxHash,
    }).then(async ({ data, error }) => {
      if (error) {
        console.error('process_hp_boost:', error)
        setBoostError('Boost saved onchain, but database sync failed.')
        await loadProfile()
        return
      }

      if (!data?.ok) {
        setBoostError(data?.error || 'Boost was not accepted.')
        await loadProfile()
        return
      }

      setBoostedToday(true)
      setUserStats((stats) => ({ ...stats, points: stats.points + BOOST_HP }))
      setTxModal(false)
    }).finally(() => {
      resetBoost()
    })
  }, [address, isSuccessBoost, boostTxHash, today, resetBoost])

  // --- Account Upgrade Effect ---
  useEffect(() => {
    if (!isSuccessUpgrade || !upgradeTxHash || processedMultTxRef.current === upgradeTxHash || !address || !selectedLevel) return

    processedMultTxRef.current = upgradeTxHash
    setUpgradeError('')

    db.rpc('buy_account_level', {
      p_address: address.toLowerCase(),
      p_tx_hash: upgradeTxHash,
      p_target_level: selectedLevel.level,
    }).then(async ({ data, error }) => {
      if (error) {
        console.error('buy_account_level:', error)
        setUpgradeError('Transaction saved onchain, but database sync failed.')
        await loadProfile()
        return
      }

      if (!data?.ok) {
        setUpgradeError(data?.error || 'Upgrade was not accepted.')
        await loadProfile()
        return
      }

      await loadProfile()
      setTxModal(false)
      setSelectedLevel(null)
    }).finally(() => {
      resetUpgrade()
    })
  }, [address, isSuccessUpgrade, upgradeTxHash, selectedLevel, resetUpgrade])

  const sendCheckin = () => {
    setCheckinError('')
    if (chainId !== base.id) {
      switchChain({ chainId: base.id })
      return
    }

    writeContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [CHECKIN_TARGET, parseUnits(CHECKIN_AMOUNT.toFixed(6), 6)],
      chainId: base.id,
    })
  }

  const sendBoost = () => {
    setBoostError('')
    if (chainId !== base.id) {
      switchChain({ chainId: base.id })
      return
    }

    writeBoost({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [CHECKIN_TARGET, parseUnits(BOOST_AMOUNT.toFixed(6), 6)],
      chainId: base.id,
    })
  }

  const sendUpgrade = () => {
    if (!selectedLevel) return
    setUpgradeError('')
    if (chainId !== base.id) {
      switchChain({ chainId: base.id })
      return
    }

    writeUpgrade({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [CHECKIN_TARGET, parseUnits(selectedLevel.price.toFixed(6), 6)],
      chainId: base.id,
    })
  }

  const copyRef = async () => {
    try {
      await navigator.clipboard?.writeText(referralLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const [refInput, setRefInput] = useState('')
  const [refLoading, setRefLoading] = useState(false)
  const [refError, setRefError] = useState('')

  const handleApplyRef = async () => {
    if (!refInput.trim()) return
    setRefLoading(true)
    setRefError('')
    
    const { data, error } = await db.rpc('apply_referral_code', {
      p_address: address.toLowerCase(),
      p_code: refInput.trim()
    })

    if (error) {
      setRefError('Database error. Try again.')
    } else if (!data.ok) {
      setRefError(data.error)
    } else {
      await loadProfile()
    }
    setRefLoading(false)
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard?.writeText(userStats.ref_code)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    } catch {
      setCopiedCode(false)
    }
  }

  return (
    <div style={{ paddingBottom: 120, padding: '0 12px 120px', position: 'relative' }}>
      {/* Disconnect button positioned to align with the main Profile title in App.jsx */}
      {/* Disconnect button - Hidden during event
      <button
        onClick={() => disconnect()}
        style={{
          position: 'absolute',
          top: -44, // Align with App.jsx title
          right: 16,
          background: '#EEF0F3',
          border: '1px solid #DEE1E7',
          color: '#717886',
          borderRadius: 50,
          padding: '6px 14px',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          zIndex: 100,
        }}
      >
        Disconnect
      </button>
      */}

      {/* Senior Dev Redesign v8.3: Crystal Clear Player Passport */}
      <div
        style={{
          backgroundImage: 'url(/banner.jpg)',
          backgroundColor: '#0000FF', // Fallback
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderRadius: 24,
          padding: '24px 20px',
          marginBottom: 14,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0,0,255,0.25)',
          border: '1px solid rgba(255,255,255,0.15)',
        }}
      >
        {/* Subtler Dark Glass Overlay for Clarity */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 80, 0.35)', zIndex: 0 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,0,255,0.1) 100%)', zIndex: 0 }} />
        
        {/* Top Bar: Player Identity Passport */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          
          {/* Left: Upscaled Avatar & HP Balance Hub */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            background: 'rgba(255, 255, 255, 0.08)', 
            backdropFilter: 'blur(10px)',
            padding: '6px 20px 6px 6px', 
            borderRadius: 60, 
            border: '1px solid rgba(255,255,255,0.12)',
            gap: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>
            <div style={{ 
              width: 48, 
              height: 48, 
              borderRadius: '50%', 
              overflow: 'hidden', 
              border: '2px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <UserAvatar address={address} size={48} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <div style={{ 
                fontFamily: "'Barlow Condensed',sans-serif", 
                fontSize: 32, 
                fontWeight: 900, 
                color: '#fff', 
                lineHeight: 1, 
                textShadow: '0 2px 15px rgba(0,0,0,0.5)' 
              }}>
                {userStats.points.toLocaleString()}
              </div>
              <div style={{ 
                fontSize: 12, 
                fontWeight: 900, 
                color: '#A5B4FC', 
                opacity: 0.9,
                letterSpacing: 0.5
              }}>
                HP
              </div>
            </div>
          </div>

          {/* Right: Account Utilities (Disconnect & Address) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <button
              onClick={() => disconnect()}
              style={{
                background: 'rgba(255,255,255,0.1)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.8)',
                borderRadius: 50,
                padding: '4px 14px',
                fontSize: 8,
                fontWeight: 900,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              DISCONNECT
            </button>
            <div style={{ 
              fontSize: 9, 
              fontWeight: 800, 
              color: '#fff', 
              opacity: 0.4, 
              letterSpacing: 0.8,
              padding: '0 4px'
            }}>
              {basename ? basename : short(address)}
            </div>
          </div>
        </div>

        {/* Progression Status Area */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          
          {/* Left: Multiplier Status */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 8, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Multiplier</div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 6, 
              background: 'rgba(255, 255, 255, 0.08)', 
              backdropFilter: 'blur(12px)',
              padding: '8px 12px', 
              borderRadius: 14, 
              border: '1px solid rgba(255,255,255,0.1)',
              minWidth: 95,
              height: 38,
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
            }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>{LEVELS.find(l => l.level === accountLevel)?.name}</div>
              <div style={{ 
                background: (LEVELS.find(l => l.level === accountLevel)?.mult || 1) === 1.0 
                  ? 'linear-gradient(135deg, #94A3B8, #64748B)' 
                  : (LEVELS.find(l => l.level === accountLevel)?.mult || 1) === 5.0 || (LEVELS.find(l => l.level === accountLevel)?.mult || 1) === 2.0
                    ? 'linear-gradient(135deg, #34D399, #059669)'
                    : 'linear-gradient(135deg, #F4C81B, #F97316)',
                color: '#000', 
                padding: '1px 5px', 
                borderRadius: 4, 
                fontSize: 9, 
                fontWeight: 900
              }}>
                {LEVELS.find(l => l.level === accountLevel)?.mult}x
              </div>
            </div>
          </div>

          {/* Center: Active Boost */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            <div style={{ fontSize: 8, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Boost</div>
            
            <div style={{ 
              background: 'rgba(255, 255, 255, 0.08)', 
              backdropFilter: 'blur(12px)',
              padding: '8px 12px', 
              borderRadius: 14, 
              border: '1px solid rgba(255,255,255,0.1)', 
              minWidth: 95, 
              height: 38,
              textAlign: 'center',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
            }}>
              {activeMultiplier > (LEVELS.find(l => l.level === accountLevel)?.mult || 1) ? (
                <>
                  <div style={{ 
                    position: 'absolute', 
                    top: -6, 
                    right: -8, 
                    background: '#0000FF', 
                    border: '1px solid rgba(255,255,255,0.3)', 
                    padding: '1px 6px', 
                    borderRadius: 5, 
                    fontSize: 7, 
                    fontWeight: 900, 
                    color: '#fff',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.4)',
                    whiteSpace: 'nowrap',
                    zIndex: 2
                  }}>
                    {timeLeft}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#F4C81B', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    ⚡ {activeMultiplier}x
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 16, fontWeight: 900, color: 'rgba(255,255,255,0.15)' }}>—</div>
              )}
            </div>
          </div>

          {/* Right: Streak Status */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ fontSize: 8, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Streak</div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 5, 
              background: 'rgba(255, 255, 255, 0.08)', 
              backdropFilter: 'blur(12px)',
              padding: '8px 12px', 
              borderRadius: 14, 
              border: '1px solid rgba(255,255,255,0.1)',
              minWidth: 95,
              height: 38,
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
            }}>
              <span style={{ fontSize: 16 }}>🔥</span>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: -0.5 }}>{streak.count}<span style={{ fontSize: 12, marginLeft: 1, opacity: 0.6 }}>d</span></div>
            </div>
          </div>

        </div>
      </div>

      {/* 2-Column Action Grid: Daily Rewards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        {/* Check-in Tile */}
        <div style={{ background: '#fff', border: '1px solid #DEE1E7', borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#0A0B0D' }}>DAILY CHECK-IN</div>
              <div style={{ background: '#0000FF', color: '#fff', padding: '1px 6px', borderRadius: 50, fontSize: 8, fontWeight: 900 }}>+1 HP</div>
            </div>
            <div style={{ fontSize: 9, color: '#717886', marginTop: 1, fontWeight: 500 }}>Build your streak.</div>
          </div>
          <div style={{ marginTop: 14 }}>
            {canCheckin ? (
              <button
                onClick={() => setTxModal('checkin')}
                style={{ width: '100%', background: '#0000FF', color: '#fff', borderRadius: 50, padding: '10px', fontSize: 11, fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,255,0.2)' }}
              >
                ✓ Claim <span style={{ color: '#A5B4FC', textTransform: 'lowercase' }}>free</span>
              </button>
            ) : (
              <div style={{ textAlign: 'center', padding: '10px 4px', background: '#ECFDF5', borderRadius: 50, border: '1px solid #D1FAE5', fontSize: 8, color: '#059669', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                RESETS AT 00:00 UTC
              </div>
            )}
          </div>
        </div>

        {/* Boost Tile */}
        <div style={{ background: '#fff', border: '1px solid #DEE1E7', borderRadius: 20, padding: 16, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#0A0B0D' }}>DAILY CLAIM</div>
              <div style={{ background: '#0000FF', color: '#fff', padding: '1px 6px', borderRadius: 50, fontSize: 8, fontWeight: 900 }}>+2 HP</div>
            </div>
            <div style={{ fontSize: 9, color: '#717886', marginTop: 1, fontWeight: 500 }}>Climb to the top.</div>
          </div>
          <div style={{ marginTop: 14 }}>
            {canBoost ? (
              <button
                onClick={() => setTxModal('boost')}
                style={{ width: '100%', background: '#0000FF', color: '#fff', borderRadius: 50, padding: '10px', fontSize: 11, fontWeight: 800, border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
              >
                ✓ Claim <span style={{ color: '#A5B4FC' }}>0.10</span><img src="/usdc-logo.png" alt="USDC" style={{ width: 14, height: 14 }} />
              </button>
            ) : (
              <div style={{ textAlign: 'center', padding: '10px 4px', background: '#ECFDF5', borderRadius: 50, border: '1px solid #D1FAE5', fontSize: 8, color: '#059669', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                RESETS AT 00:00 UTC
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Streak Milestone Row (Compact) */}
      <div style={{ background: '#fff', border: '1px solid #DEE1E7', borderRadius: 20, padding: '14px 16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0A0B0D' }}>DAILY STREAK PROGRESS</div>
            <div style={{ fontSize: 9, color: '#717886', marginTop: 1, fontWeight: 500 }}>Don't miss a day.</div>
          </div>
          <div style={{ background: '#0000FF', color: '#fff', padding: '2px 8px', borderRadius: 50, fontSize: 8, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
            🔥 {streak.count} DAYS
          </div>
        </div>
        <div style={{ position: 'relative', height: 50, padding: '0 10px' }}>
          <div style={{ position: 'absolute', top: 26, left: 20, right: 20, height: 2, background: '#F1F5F9', borderRadius: 1 }} />
          {/* Advanced Progress Calculation: Segmented Logic */}
          {(() => {
            const milestones = [1, 3, 7, 14, 30];
            let width = 0;
            if (streak.count >= milestones[milestones.length - 1]) {
              width = 100;
            } else if (streak.count > milestones[0]) {
              for (let i = 0; i < milestones.length - 1; i++) {
                const start = milestones[i];
                const end = milestones[i+1];
                if (streak.count >= start && streak.count < end) {
                  const segmentBase = i * 25; // 25% per segment (4 segments)
                  const segmentProgress = (streak.count - start) / (end - start);
                  width = segmentBase + (segmentProgress * 25);
                  break;
                }
              }
            }
            return (
              <div style={{ 
                position: 'absolute', 
                top: 26, 
                left: 20, 
                height: 2, 
                background: '#0000FF', 
                borderRadius: 1, 
                width: `calc(${width}% - ${width > 0 ? (width/100)*10 : 0}px)`, // Adjust for circle width padding
                maxWidth: 'calc(100% - 40px)',
                transition: 'width 0.5s ease' 
              }} />
            );
          })()}
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
            {[
              { days: 1, pts: 0 },
              { days: 3, pts: 1 },
              { days: 7, pts: 3 },
              { days: 14, pts: 7 },
              { days: 30, pts: 15 }
            ].map(reward => {
              const reached = streak.count >= reward.days
              return (
                <div key={reward.days} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 7, fontWeight: 900, color: reached ? '#059669' : '#94A3B8', textTransform: 'uppercase' }}>
                    {reward.pts > 0 ? `+${reward.pts} HP` : '—'}
                  </div>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: reached ? '#0000FF' : '#fff', border: reached ? 'none' : '2px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: reached ? '0 4px 10px rgba(0,0,255,0.2)' : 'none' }}>
                    {reached ? <span style={{ fontSize: 10, color: '#fff' }}>✓</span> : <span style={{ fontSize: 8, color: '#94A3B8', fontWeight: 800 }}>{reward.days}d</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {checkinError && (
        <div style={{ background: '#FEF3C7', border: '1px solid #D97706', borderRadius: 12, padding: '8px 12px', marginBottom: 12, fontSize: 10, color: '#B45309', fontWeight: 600, textAlign: 'center' }}>
          ⚠️ {checkinError}
        </div>
      )}

      {boostError && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 12, padding: '8px 12px', marginBottom: 12, fontSize: 10, color: '#DC2626', fontWeight: 600, textAlign: 'center' }}>
          ⚠️ {boostError}
        </div>
      )}

      {/* Account Progression: Roadmap */}
      <div style={{ background: '#fff', border: '1px solid #DEE1E7', borderRadius: 20, padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0A0B0D' }}>ACCOUNT LEVEL</div>
            <div style={{ fontSize: 9, color: '#717886', marginTop: 1, fontWeight: 500 }}>Unlock permanent multipliers.</div>
          </div>
          <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '4px 10px', borderRadius: 8, fontSize: 10, fontWeight: 800, color: '#0000FF' }}>
            RANK: {LEVELS.find(l => l.level === accountLevel)?.name}
          </div>
        </div>

        {/* Level Roadmap */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, position: 'relative', padding: '0 10px' }}>
          <div style={{ position: 'absolute', top: 12, left: 20, right: 20, height: 2, background: '#F1F5F9', zIndex: 0 }} />
          {LEVELS.map(l => {
            const isActive = l.level <= accountLevel
            const isCurrent = l.level === accountLevel
            return (
              <div key={l.level} style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ 
                  width: 26, 
                  height: 26, 
                  borderRadius: '50%', 
                  background: isCurrent || isActive 
                    ? (l.mult === 1.0 ? '#94A3B8' : l.mult === 2.0 ? '#34D399' : '#F97316')
                    : '#fff', 
                  border: isCurrent ? '4px solid #DBEAFE' : '2px solid #E2E8F0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: isCurrent ? `0 0 15px ${l.mult === 2.0 ? 'rgba(52,211,153,0.3)' : 'rgba(249,115,22,0.3)'}` : 'none'
                }}>
                  <span style={{ fontSize: 9, color: isCurrent || isActive ? '#fff' : '#94A3B8', fontWeight: 900 }}>{l.mult}x</span>
                </div>
                <div style={{ fontSize: 8, fontWeight: 800, color: isCurrent ? '#0000FF' : '#94A3B8', textTransform: 'uppercase' }}>LVL {l.level}</div>
              </div>
            )
          })}
        </div>

        {accountLevel < 5 && (
          <button
            onClick={() => {
              const next = LEVELS.find(l => l.level === accountLevel + 1)
              setSelectedLevel(next)
              setTxModal('upgrade')
            }}
            style={{ width: '100%', background: '#0000FF', color: '#fff', borderRadius: 50, padding: '12px', fontSize: 13, fontWeight: 800, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 8px 20px rgba(0,0,255,0.15)' }}
          >
            Upgrade to {LEVELS.find(l => l.level === accountLevel + 1)?.name}
            <span style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 20, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              {LEVELS.find(l => l.level === accountLevel + 1)?.price.toFixed(2)}<img src="/usdc-logo.png" alt="USDC" style={{ width: 14, height: 14 }} />
            </span>
          </button>
        )}
        {accountLevel === 5 && (
          <div style={{ 
            textAlign: 'center', 
            padding: '14px', 
            background: '#EEF0F3', 
            borderRadius: 50, 
            border: '1px solid #DEE1E7', 
            fontSize: 13, 
            color: '#717886', 
            fontWeight: 700,
          }}>
            You reached MAX multiplier
          </div>
        )}
        {upgradeError && (
          <div style={{ color: '#DC2626', fontSize: 12, marginTop: 12, textAlign: 'center', fontWeight: 600 }}>⚠️ {upgradeError}</div>
        )}
      </div>

      {/* Referral Program: Senior Hub */}
      <div style={{ background: '#fff', border: '1px solid #DEE1E7', borderRadius: 20, padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0A0B0D' }}>REFERRAL HUB</div>
            <div style={{ fontSize: 9, color: '#717886', marginTop: 1, fontWeight: 500 }}>Earn 50% commission from friends.</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 12, border: '1px solid #F1F5F9', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0000FF', lineHeight: 1 }}>{userStats.referral_count}</div>
            <div style={{ fontSize: 8, color: '#64748B', marginTop: 4, fontWeight: 800 }}>FRIENDS</div>
          </div>
          <div style={{ background: '#F8FAFC', borderRadius: 12, padding: 12, border: '1px solid #F1F5F9', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#059669', lineHeight: 1 }}>{userStats.referral_points} <span style={{ fontSize: 9 }}>HP</span></div>
            <div style={{ fontSize: 8, color: '#64748B', marginTop: 4, fontWeight: 800 }}>TOTAL EARNED</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          <div style={{ flex: 1, background: '#F1F5F9', borderRadius: 10, padding: '10px 12px', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{referralLink}</span>
          </div>
          <button
            onClick={copyRef}
            style={{ background: '#0000FF', color: '#fff', border: 'none', borderRadius: 10, padding: '0 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {copied ? '✓' : 'COPY'}
          </button>
        </div>

        {/* Manual Referral Entry */}
        {!userStats.referrer && (
          <div style={{ display: 'flex', gap: 6, paddingTop: 14, borderTop: '1px solid #F1F5F9' }}>
            <input
              type="text"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              placeholder="Referral Code"
              style={{ flex: 1, background: '#fff', border: '1px solid #DEE1E7', borderRadius: 10, padding: '10px 12px', fontSize: 11, outline: 'none', fontFamily: "'DM Mono', monospace" }}
            />
            <button
              onClick={handleApplyRef}
              disabled={refLoading || !refInput.trim()}
              style={{ background: '#EEF0F3', color: '#000', border: '1px solid #DEE1E7', borderRadius: 10, padding: '0 14px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
            >
              APPLY
            </button>
          </div>
        )}
      </div>



      <HistorySection address={address} />

      {/* Spacer to push Admin Refund lower */}
      <div style={{ height: 120 }} />

      {address && address.toLowerCase() === '0x4c91D3BEd372C11795b9Ce9a9017dFE447Bf050a'.toLowerCase() && (
        <div style={{ marginTop: 10, background: '#FEF2F2', padding: 20, borderRadius: 16, border: '1px solid #FCA5A5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 800, color: '#DC2626' }}>🛠 Admin Panel</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>
              Vault: {vaultBalanceData ? parseFloat(vaultBalanceData.formatted).toFixed(2) : '0.00'} USDC
            </div>
          </div>

          {/* Refund */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid #FCA5A5' }}>
            <input
              type="number"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="Rescue USDC"
              style={{ flex: 1, padding: 12, borderRadius: 30, border: '1px solid #FCA5A5', background: '#fff', fontSize: 14, outline: 'none' }}
            />
            <button
              onClick={rescueMyFunds}
              style={{ padding: '10px 20px', background: '#DC2626', color: '#fff', borderRadius: 30, fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: 13 }}
            >
              Refund
            </button>
          </div>

          {/* Bot Management */}
          <div style={{ color: '#000' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#4B5563' }}>🤖 LEADERBOARD SIMULATION</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF' }}>Total Bots: <span style={{ color: '#4F46E5' }}>{bots.length}</span></div>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', marginBottom: 4 }}>COUNT</div>
                <input type="number" value={botCountInput} onChange={e => setBotCountInput(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #DEE1E7', fontSize: 12 }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', marginBottom: 4 }}>MIN HP</div>
                <input type="number" step="any" value={botMinPoints} onChange={e => setBotMinPoints(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #DEE1E7', fontSize: 12 }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', marginBottom: 4 }}>MAX HP</div>
                <input type="number" step="any" value={botMaxPoints} onChange={e => setBotMaxPoints(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #DEE1E7', fontSize: 12 }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 15 }}>
              <button onClick={handleCreateBots} disabled={isCreatingBots} style={{ flex: 1, padding: 10, background: '#4F46E5', color: '#fff', borderRadius: 8, fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 12 }}>
                {isCreatingBots ? 'Creating...' : `+ Add ${botCountInput} Bots`}
              </button>
              <button onClick={handleDeleteBots} style={{ padding: 10, background: 'none', border: '1px solid #DC2626', color: '#DC2626', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                Reset All
              </button>
            </div>

            <div style={{ maxHeight: 200, overflowY: 'auto', background: '#fff', borderRadius: 12, border: '1px solid #DEE1E7', padding: 8 }}>
              {bots.map(bot => (
                <div key={bot.address} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button 
                      onClick={() => handleDeleteBot(bot.address)}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        cursor: 'pointer', 
                        fontSize: 14, 
                        padding: '4px 8px',
                        borderRadius: 6,
                        opacity: 0.6
                      }}
                    >
                      🗑️
                    </button>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#6B7280' }}>{short(bot.address)}</div>
                  </div>

                  {editingBot?.address === bot.address ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input 
                        autoFocus
                        type="number" 
                        step="any"
                        defaultValue={bot.points} 
                        onBlur={e => handleUpdateBotPoints(bot.address, e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleUpdateBotPoints(bot.address, e.currentTarget.value)}
                        style={{ width: 70, padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid #4F46E5' }} 
                      />
                    </div>
                  ) : (
                    <div 
                      onClick={() => setEditingBot(bot)}
                      style={{ fontSize: 12, fontWeight: 800, color: '#111827', cursor: 'pointer', padding: '2px 8px', borderRadius: 4, background: '#F9FAFB' }}
                    >
                      {bot.points.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} HP ✏️
                    </div>
                  )}
                </div>
              ))}
              {bots.length === 0 && <div style={{ textAlign: 'center', fontSize: 11, color: '#9CA3AF', padding: 10 }}>No bots created yet</div>}
            </div>
          </div>
        </div>
      )}

      {txModal === 'checkin' && (
        <TxModal
          title="Daily Check-In"
          subtitle="Keep your streak daily · Earn streak bonus"
          amount={CHECKIN_AMOUNT}
          isPending={isPending}
          isConfirming={isConfirming}
          isSuccess={isSuccess}
          error={writeError}
          onConfirm={sendCheckin}
          onCancel={() => {
            setTxModal(false)
            reset()
          }}
        />
      )}

      {txModal === 'boost' && (
        <TxModal
          title="Daily HP Boost"
          subtitle="Get +2 HP instantly"
          amount={BOOST_AMOUNT}
          isPending={isPendingBoost}
          isConfirming={isConfirmingBoost}
          isSuccess={isSuccessBoost}
          error={boostWriteError}
          onConfirm={sendBoost}
          onCancel={() => {
            setTxModal(false)
            resetBoost()
          }}
        />
      )}

      {txModal === 'upgrade' && selectedLevel && (
        <TxModal
          title={`Upgrade to ${selectedLevel.name}`}
          subtitle={`Permanent ${selectedLevel.mult}x multiplier for all HP you earn.`}
          amount={selectedLevel.price}
          isPending={isPendingUpgrade}
          isConfirming={isConfirmingUpgrade}
          isSuccess={isSuccessUpgrade}
          error={upgradeWriteError}
          onConfirm={sendUpgrade}
          onCancel={() => {
            setTxModal(false)
            setSelectedLevel(null)
            resetUpgrade()
          }}
        />
      )}
    </div>
  )
}
