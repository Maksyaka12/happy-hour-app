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
    active_multiplier: data?.active_multiplier ?? 1.0,
    multiplier_expires_at: data?.multiplier_expires_at ?? null,
  }
}

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
    ref_code: null
  })
  const [checkedToday, setCheckedToday] = useState(false)
  const [boostedToday, setBoostedToday] = useState(false)
  const [activeMultiplier, setActiveMultiplier] = useState(1.0)
  const [multiplierExpiresAt, setMultiplierExpiresAt] = useState(null)
  const [timeLeft, setTimeLeft] = useState('')
  const [checkinError, setCheckinError] = useState('')
  const [boostError, setBoostError] = useState('')
  const [multError, setMultError] = useState('')
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

  const loadProfile = async () => {
    if (!address) return
    const { data, error } = await db
      .from('users')
      .select('streak, streak_last, boost_last, points, wins, entries, referral_count, referral_points, ref_code, active_multiplier, multiplier_expires_at')
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
    setUserStats({
      points: user.points,
      wins: user.wins,
      entries: user.entries,
      referral_count: user.referral_count,
      referral_points: user.referral_points,
      ref_code: user.ref_code
    })
  }

  useEffect(() => {
    loadProfile()
  }, [address, today])

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
  const { data: multTxHash, writeContract: writeMult, isPending: isPendingMult, isConfirming: isConfirmingMult, isSuccess: isSuccessMult, error: multWriteError, reset: resetMult } = useBuilderWrite()

  const [selectedBoost, setSelectedBoost] = useState(null)

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

  // --- Multiplier Effect ---
  useEffect(() => {
    if (!isSuccessMult || !multTxHash || processedMultTxRef.current === multTxHash || !address || !selectedBoost) return

    processedMultTxRef.current = multTxHash
    setMultError('')

    db.rpc('buy_multiplier', {
      p_address: address.toLowerCase(),
      p_tx_hash: multTxHash,
      p_multiplier: selectedBoost.multiplier,
    }).then(async ({ data, error }) => {
      if (error) {
        console.error('buy_multiplier:', error)
        setMultError('Transaction saved onchain, but database sync failed.')
        await loadProfile()
        return
      }

      if (!data?.ok) {
        setMultError(data?.error || 'Multiplier purchase was not accepted.')
        await loadProfile()
        return
      }

      await loadProfile() // Reload to get new expiry time and multiplier
      setTxModal(false)
      setSelectedBoost(null)
    }).finally(() => {
      resetMult()
    })
  }, [address, isSuccessMult, multTxHash, selectedBoost, resetMult])

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

  const sendMultiplier = () => {
    if (!selectedBoost) return
    setMultError('')
    if (chainId !== base.id) {
      switchChain({ chainId: base.id })
      return
    }

    writeMult({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [CHECKIN_TARGET, parseUnits(selectedBoost.price.toFixed(6), 6)],
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

  return (
    <div style={{ paddingBottom: 120, padding: '0 12px 120px' }}>
      <div
        style={{
          background: 'linear-gradient(135deg,#0000FF 0%,#0041CC 45%,#3C8AFF 100%)',
          borderRadius: 24,
          padding: '22px 18px 18px',
          marginBottom: 12,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 36px rgba(0,0,255,0.4)',
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
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
            <UserAvatar address={address} size={54} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {basename ? basename : short(address)}
              </div>
              {basename && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2, fontFamily: "'DM Mono',monospace" }}>
                  {short(address)}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>Base Mainnet</div>
            </div>
            <button
              onClick={() => disconnect()}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.25)',
                color: '#fff',
                borderRadius: 50,
                padding: '7px 14px',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Disconnect
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
            {[
              { l: 'HP', v: userStats.points.toLocaleString() },
              { l: 'Wins', v: userStats.wins },
              { l: 'Entries', v: userStats.entries },
            ].map((s) => (
              <div key={s.l} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 14, padding: '12px 8px', textAlign: 'center' }}>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 26, fontWeight: 900, lineHeight: 1, color: '#fff' }}>{s.v}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>{s.l}</div>
              </div>
            ))}
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
          Get an extra <span style={{ color: '#0000FF', fontWeight: 700 }}>+11 HP</span> per day · Boost your rank
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

      <div style={{ background: '#fff', border: '1px solid #DEE1E7', borderRadius: 20, padding: 18, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0A0B0D' }}>Happy Bar (Boosts)</div>
          {activeMultiplier > 1 && timeLeft && (
            <div style={{ background: activeMultiplier >= 5 ? 'rgba(147, 51, 234, 0.1)' : 'rgba(5, 150, 105, 0.1)', color: activeMultiplier >= 5 ? '#9333EA' : '#059669', padding: '4px 8px', borderRadius: 50, fontSize: 11, fontWeight: 800, display: 'flex', gap: 6, alignItems: 'center' }}>
              <span>{activeMultiplier}x Active</span>
              <span style={{ opacity: 0.7 }}>{timeLeft}</span>
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#717886', marginBottom: 14, lineHeight: 1.6 }}>
          Multiply <span style={{ fontWeight: 700, color: '#0000FF' }}>all HP earned</span> for 24h · Except referrals HP
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {/* 2x Boost Card */}
          <div
            style={{
              flex: 1,
              background: 'rgba(5, 150, 105, 0.08)',
              border: '1px solid rgba(5, 150, 105, 0.2)',
              borderRadius: 16,
              padding: '12px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {/* Top row: icon + label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>🍷</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#059669', lineHeight: 1 }}>2x Boost</div>
            </div>
            {/* Blue buy button */}
            <button
              onClick={() => {
                setSelectedBoost({ type: '2x', multiplier: 2.0, price: 0.50 })
                setTxModal('multiplier')
              }}
              style={{
                background: '#0000FF',
                border: 'none',
                borderRadius: 50,
                padding: '8px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: '#A5B4FC' }}>0.50</span>
              <img src="/usdc-logo.png" alt="USDC" style={{ width: 14, height: 14 }} />
            </button>
          </div>

          {/* 5x Boost Card */}
          <div
            style={{
              flex: 1,
              background: 'rgba(147, 51, 234, 0.08)',
              border: '1px solid rgba(147, 51, 234, 0.2)',
              borderRadius: 16,
              padding: '12px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {/* Top row: icon + label */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 26, lineHeight: 1, flexShrink: 0 }}>🍾</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#9333EA', lineHeight: 1 }}>5x Boost</div>
            </div>
            {/* Blue buy button */}
            <button
              onClick={() => {
                setSelectedBoost({ type: '5x', multiplier: 5.0, price: 1.00 })
                setTxModal('multiplier')
              }}
              style={{
                background: '#0000FF',
                border: 'none',
                borderRadius: 50,
                padding: '8px 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: '#A5B4FC' }}>1.00</span>
              <img src="/usdc-logo.png" alt="USDC" style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>

        {multError && (
          <div style={{ color: '#DC2626', fontSize: 12, marginTop: 10, textAlign: 'center' }}>{multError}</div>
        )}
      </div>

      <div style={{ background: '#fff', border: '1px solid #DEE1E7', borderRadius: 20, padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: '#0A0B0D' }}>Referral Program</div>
        <div style={{ fontSize: 12, color: '#717886', marginBottom: 14, lineHeight: 1.6 }}>
          Invite friends and earn <span style={{ color: '#D97706', fontWeight: 700 }}>50% of their points</span> forever.
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <div style={{ flex: 1, background: '#EEF0F3', border: '1px solid #DEE1E7', borderRadius: 12, padding: '12px 14px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 11, color: '#717886', overflow: 'hidden', textOverflow: 'ellipsis' }}>{referralLink}</span>
          </div>
          <button
            onClick={copyRef}
            style={{
              background: copied ? 'rgba(5,150,105,0.1)' : 'rgba(217,119,6,0.1)',
              border: `1px solid ${copied ? '#059669' : '#D97706'}`,
              color: copied ? '#059669' : '#D97706',
              borderRadius: 12,
              padding: '0 16px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.2s'
            }}
          >
            {copied ? '✓ Copied!' : 'Copy'}
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
      </div>

      <HistorySection address={address} />

      {/* Spacer to push Admin Refund lower */}
      <div style={{ height: 120 }} />

      {address && address.toLowerCase() === '0x4c91D3BEd372C11795b9Ce9a9017dFE447Bf050a'.toLowerCase() && (
        <div style={{ marginTop: 10, background: '#FEF2F2', padding: 20, borderRadius: 16, border: '1px solid #FCA5A5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 800, color: '#DC2626' }}>🛠 Refund Contract</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>
              Vault: {vaultBalanceData ? parseFloat(vaultBalanceData.formatted).toFixed(2) : '0.00'} USDC
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="number"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="Amount in USDC"
              style={{ flex: 1, padding: 15, borderRadius: 30, border: '1px solid #FCA5A5', background: '#fff', fontSize: 16, outline: 'none' }}
            />
            <button
              onClick={rescueMyFunds}
              style={{ padding: '15px 30px', background: '#DC2626', color: '#fff', borderRadius: 30, fontWeight: 800, border: 'none', cursor: 'pointer' }}
            >
              Refund
            </button>
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
          subtitle="Get +100 HP instantly"
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

      {txModal === 'multiplier' && selectedBoost && (
        <TxModal
          title={`${selectedBoost.type} Point Multiplier`}
          subtitle={`Multiply all earned HP by ${selectedBoost.multiplier}x for 24 hours.`}
          amount={selectedBoost.price}
          isPending={isPendingMult}
          isConfirming={isConfirmingMult}
          isSuccess={isSuccessMult}
          error={multWriteError}
          onConfirm={sendMultiplier}
          onCancel={() => {
            setTxModal(false)
            setSelectedBoost(null)
            resetMult()
          }}
        />
      )}
    </div>
  )
}
