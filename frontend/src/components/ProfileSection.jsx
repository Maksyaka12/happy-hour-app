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
  { level: 1, name: 'Standard', mult: 1.0, price: 0.00 },
  { level: 2, name: 'Bronze',   mult: 1.2, price: 0.95 },
  { level: 3, name: 'Silver',   mult: 1.5, price: 1.75 },
  { level: 4, name: 'Gold',     mult: 1.7, price: 3.00 },
  { level: 5, name: 'Elite',    mult: 2.0, price: 5.00 },
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
    await db.rpc('update_bot_points', {
      p_admin_address: address.toLowerCase(),
      p_bot_address: botAddr,
      p_new_points: Number(newPts)
    })
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

      {/* Compact Profile Badge */}
      <div
        style={{
          background: 'linear-gradient(135deg,#0000FF 0%,#0041CC 45%,#3C8AFF 100%)',
          borderRadius: 24,
          padding: '16px',
          marginBottom: 12,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,255,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 6, // Small gap after the title row
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            opacity: 0.1,
            backgroundImage: 'radial-gradient(circle,rgba(255,255,255,0.9) 1.5px,transparent 1.5px)',
            backgroundSize: '20px 20px',
          }}
        />
        
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
          <UserAvatar address={address} size={54} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {basename ? basename : short(address)}
            </div>
            
            {/* Multipliers Display */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              {/* Permanent Multiplier Badge */}
              <div style={{ background: 'rgba(255,255,255,0.2)', padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 800, color: '#fff' }}>
                {LEVELS.find(l => l.level === accountLevel)?.name} ({LEVELS.find(l => l.level === accountLevel)?.mult}x)
              </div>
              
              {/* Temporary Boost Badge */}
              {activeMultiplier > 1 && activeMultiplier > (LEVELS.find(l => l.level === accountLevel)?.mult || 1) && (
                <div style={{ 
                  background: '#F4C81B', 
                  color: '#000', 
                  padding: '3px 8px', 
                  borderRadius: 6, 
                  fontSize: 10, 
                  fontWeight: 800,
                  boxShadow: '0 4px 10px rgba(244, 200, 27, 0.3)'
                }}>
                  🔥 {activeMultiplier}x Boost {timeLeft ? `(${timeLeft})` : ''}
                </div>
              )}
            </div>
          </div>

          {/* HP Points (Compact Box) */}
          <div style={{ 
            background: 'rgba(0,0,0,0.2)', 
            borderRadius: 16, 
            height: 54, 
            minWidth: 70, 
            padding: '0 12px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 24, fontWeight: 900, lineHeight: 1, color: '#fff' }}>
              {userStats.points.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2, fontWeight: 700 }}>HP</div>
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', border: '1px solid #DEE1E7', borderRadius: 20, padding: 18, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 3, color: '#0A0B0D' }}>Daily Check-in</div>
            <div style={{ fontSize: 12, color: '#717886' }}>Earn <span style={{ color: '#0000FF', fontWeight: 700 }}>+1 HP</span> per day · Build your streak</div>
          </div>
          <div style={{ background: '#0000FF', borderRadius: 50, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 13 }}>🔥</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{streak.count} day{streak.count !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div style={{ position: 'relative', marginBottom: 18 }}>
          <div style={{ position: 'absolute', top: 12, left: 12, right: 12, height: 2, background: '#DEE1E7', borderRadius: 1, zIndex: 0 }} />
          <div
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              height: 2,
              background: '#0000FF',
              borderRadius: 1,
              zIndex: 1,
              width: `${(() => {
                const c = streak.count;
                if (c >= 30) return 100;
                if (c <= 1) return 0;
                const m = [1, 3, 7, 14, 21, 30];
                for (let i = 0; i < 5; i++) {
                  if (c >= m[i] && c < m[i + 1]) {
                    return (i * 20) + (((c - m[i]) / (m[i + 1] - m[i])) * 20);
                  }
                }
                return 0;
              })()}%`,
              transition: 'width 0.5s ease',
            }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
            {[1, 3, 7, 14, 21, 30].map((day) => {
              const reached = streak.count >= day
              const milestone = STREAK_REWARDS.find((r) => r.days === day)
              return (
                <div key={day} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div
                    style={{
                      width: milestone ? 26 : 22,
                      height: milestone ? 26 : 22,
                      borderRadius: '50%',
                      background: reached ? '#0000FF' : '#fff',
                      border: reached ? '3px solid #0000FF' : '2px solid #DEE1E7',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {reached ? <span style={{ fontSize: 11, color: '#fff', fontWeight: 900 }}>✓</span> : <span style={{ fontSize: 8, color: '#717886', fontWeight: 600 }}>{day}</span>}
                  </div>
                  {milestone ? (
                    <div style={{ fontSize: 9, fontWeight: 700, textAlign: 'center', lineHeight: 1.2 }}>
                      <div style={{ color: reached ? '#0000FF' : '#717886' }}>Day {day}</div>
                      <div style={{ color: reached ? '#059669' : '#3C8AFF', fontWeight: 800 }}>+{milestone.pts} HP</div>
                    </div>
                  ) : (
                    <div style={{ fontSize: 9, color: '#717886' }}>{day}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>



        {checkinError && (
          <div style={{ background: '#FEF3C7', border: '1px solid #D97706', borderRadius: 12, padding: '10px 12px', marginBottom: 12, fontSize: 12, color: '#B45309' }}>
            {checkinError}
          </div>
        )}

        {canCheckin ? (
          <button
            onClick={() => setTxModal('checkin')}
            style={{
              width: '100%',
              background: '#0000FF',
              color: '#fff',
              borderRadius: 50,
              padding: '14px',
              fontSize: 15,
              fontWeight: 700,
              border: 'none',
              boxShadow: '0 4px 16px rgba(0,0,255,0.3)',
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            ✓ Check-in Today <span style={{ color: '#A5B4FC', marginLeft: 4 }}>free</span>
          </button>
        ) : (
          <div style={{ textAlign: 'center', padding: 13, background: '#EEF0F3', borderRadius: 50, border: '1px solid #DEE1E7', fontSize: 13, color: '#717886' }}>
            Next check-in at 00:00 UTC
          </div>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid #DEE1E7', borderRadius: 20, padding: 18, marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: '#0A0B0D' }}>Daily HP Boost</div>
        <div style={{ fontSize: 12, color: '#717886', marginBottom: 14, lineHeight: 1.6 }}>
          Get an extra <span style={{ color: '#0000FF', fontWeight: 700 }}>+2 HP</span> per day · Boost your rank
        </div>
        {canBoost ? (
          <button
            onClick={() => setTxModal('boost')}
            style={{
              width: '100%',
              background: '#0000FF',
              color: '#fff',
              borderRadius: 50,
              padding: '14px',
              fontSize: 15,
              fontWeight: 700,
              border: 'none',
              boxShadow: '0 4px 16px rgba(0,0,255,0.3)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ✓ Daily HP Boost <span style={{ color: '#A5B4FC', marginLeft: 8, display: 'flex', alignItems: 'center' }}>0.10<img src="/usdc-logo.png" alt="USDC" style={{ width: 18, height: 18, marginLeft: 3, display: 'inline-block', verticalAlign: 'middle' }} /></span>
          </button>
        ) : (
          <div style={{ textAlign: 'center', padding: 13, background: '#EEF0F3', borderRadius: 50, border: '1px solid #DEE1E7', fontSize: 13, color: '#717886' }}>
            Next boost at 00:00 UTC
          </div>
        )}
        {boostError && (
          <div style={{ color: '#DC2626', fontSize: 12, marginTop: 10, textAlign: 'center' }}>{boostError}</div>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid #DEE1E7', borderRadius: 20, padding: 20, marginBottom: 12, position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#0A0B0D' }}>Account Multiplier</div>
            <div style={{ fontSize: 12, color: '#717886', marginTop: 2 }}>
              <span style={{ color: '#0000FF', fontWeight: 700 }}>Permanent</span> multiplier for all earned HP
            </div>
          </div>
          <div style={{ 
            background: 'linear-gradient(135deg, #0000FF, #3C8AFF)', 
            color: '#fff', 
            padding: '6px 14px', 
            borderRadius: 12, 
            fontSize: 13, 
            fontWeight: 900,
            boxShadow: '0 4px 12px rgba(0,0,255,0.2)'
          }}>
            {LEVELS.find(l => l.level === accountLevel)?.mult}x
          </div>
        </div>

        <div style={{ 
          background: '#F9FAFB', 
          border: '1px solid #EEF0F3', 
          borderRadius: 16, 
          padding: '12px 14px', 
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#717886', textTransform: 'uppercase', letterSpacing: 0.5 }}>Current Status</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0A0B0D', marginTop: 1 }}>
              {LEVELS.find(l => l.level === accountLevel)?.name}
              {accountLevel === 5 && <span style={{ color: '#0000FF', marginLeft: 6 }}>(MAX)</span>}
            </div>
          </div>
          <div style={{ fontSize: 24 }}>
            {accountLevel === 1 ? '👤' : accountLevel === 2 ? '🥉' : accountLevel === 3 ? '🥈' : accountLevel === 4 ? '🥇' : '💎'}
          </div>
        </div>

        {/* Upgrade Next Level */}
        {accountLevel < 5 && (
          <button
            onClick={() => {
              const next = LEVELS.find(l => l.level === accountLevel + 1)
              setSelectedLevel(next)
              setTxModal('upgrade')
            }}
            style={{
              width: '100%',
              background: '#0000FF',
              color: '#fff',
              borderRadius: 50,
              padding: '16px',
              fontSize: 15,
              fontWeight: 700,
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 20px rgba(0,0,255,0.2)',
              transition: 'all 0.2s'
            }}
          >
            Upgrade to {LEVELS.find(l => l.level === accountLevel + 1)?.name} {accountLevel === 4 ? '(MAX)' : ''} ({LEVELS.find(l => l.level === accountLevel + 1)?.mult}x)
            <span style={{ color: '#A5B4FC', marginLeft: 10, display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: 20 }}>
              {LEVELS.find(l => l.level === accountLevel + 1)?.price.toFixed(2)}
              <img src="/usdc-logo.png" alt="USDC" style={{ width: 18, height: 18, marginLeft: 4 }} />
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

      <div style={{ background: '#fff', border: '1px solid #DEE1E7', borderRadius: 20, padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: '#0A0B0D' }}>Referral Program</div>
        <div style={{ fontSize: 12, color: '#717886', marginBottom: 14, lineHeight: 1.6 }}>
          Invite friends and earn <span style={{ color: '#D97706', fontWeight: 700 }}>50% of their points</span> forever.
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          <div style={{ flex: 1, background: '#EEF0F3', border: '1px solid #DEE1E7', borderRadius: 12, padding: '10px 12px', overflow: 'hidden', display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#717886', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{referralLink}</span>
          </div>
          <button
            onClick={copyRef}
            style={{
              background: copied ? 'rgba(5,150,105,0.1)' : 'rgba(0,0,255,0.05)',
              border: `1px solid ${copied ? '#059669' : '#0000FF'}`,
              color: copied ? '#059669' : '#0000FF',
              borderRadius: 12,
              padding: '0 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
              minWidth: 80
            }}
          >
            {copied ? '✓ Link' : 'Copy Link'}
          </button>
          <button
            onClick={copyCode}
            style={{
              background: copiedCode ? 'rgba(5,150,105,0.1)' : 'rgba(217,119,6,0.05)',
              border: `1px solid ${copiedCode ? '#059669' : '#D97706'}`,
              color: copiedCode ? '#059669' : '#D97706',
              borderRadius: 12,
              padding: '0 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s',
              minWidth: 80
            }}
          >
            {copiedCode ? '✓ Code' : 'Copy Code'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 12, padding: '10px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0A0B0D', lineHeight: 1 }}>{userStats.referral_count}</div>
            <div style={{ fontSize: 9, color: '#717886', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Friends</div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.03)', borderRadius: 12, padding: '10px', textAlign: 'center', border: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#0000FF', lineHeight: 1 }}>{userStats.referral_points} <span style={{ fontSize: 9 }}>HP</span></div>
            <div style={{ fontSize: 9, color: '#717886', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Earned</div>
          </div>
        </div>

        {/* Manual Referral Entry */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          {userStats.referrer ? (
            <div style={{ 
              background: 'rgba(5, 150, 105, 0.05)', 
              borderRadius: 12, 
              padding: '10px 14px', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8,
              border: '1px solid rgba(5, 150, 105, 0.15)'
            }}>
              <span style={{ fontSize: 14 }}>✅</span>
              <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>
                Successfully referred by <span style={{ fontFamily: 'monospace' }}>{short(userStats.referrer)}</span>
              </span>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#717886', marginBottom: 8, textTransform: 'uppercase' }}>Redeem Referral Code</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={refInput}
                  onChange={(e) => setRefInput(e.target.value)}
                  placeholder="Enter 8-digit code"
                  style={{
                    flex: 1,
                    background: '#EEF0F3',
                    border: '1px solid #DEE1E7',
                    borderRadius: 12,
                    padding: '10px 14px',
                    fontSize: 13,
                    outline: 'none',
                    fontFamily: "'DM Mono', monospace"
                  }}
                />
                <button
                  onClick={handleApplyRef}
                  disabled={refLoading || !refInput.trim()}
                  style={{
                    background: '#0000FF',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    padding: '0 16px',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                    opacity: (refLoading || !refInput.trim()) ? 0.6 : 1
                  }}
                >
                  {refLoading ? '...' : 'Submit'}
                </button>
              </div>
              {refError && <div style={{ color: '#DC2626', fontSize: 11, marginTop: 6, fontWeight: 600 }}>⚠️ {refError}</div>}
            </div>
          )}
        </div>
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
                <input type="number" value={botMinPoints} onChange={e => setBotMinPoints(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #DEE1E7', fontSize: 12 }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', marginBottom: 4 }}>MAX HP</div>
                <input type="number" value={botMaxPoints} onChange={e => setBotMaxPoints(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #DEE1E7', fontSize: 12 }} />
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
                      {bot.points.toLocaleString()} HP ✏️
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
