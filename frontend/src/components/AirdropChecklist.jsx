import { useState, useEffect } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { db } from '../config/supabase'
import { HH_ADDRESS, STAKING_ADDRESS, HH_ABI, STAKING_ABI } from '../config/constants'

// Number formatting helpers
const formatNumber = (num, decimals = 0) => {
  return parseFloat(num || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

const formatTokenAmount = (num) => {
  const n = parseFloat(num || 0)
  if (n >= 1e9) {
    return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B'
  }
  if (n >= 1e6) {
    return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
  }
  if (n >= 1e3) {
    return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K'
  }
  return n.toFixed(0)
}

export function AirdropChecklist() {
  const { address, isConnected } = useAccount()
  const [hhPrice, setHhPrice] = useState(0.00025)
  const [loading, setLoading] = useState(true)
  const [checklistStats, setChecklistStats] = useState({
    checkins: 0,
    boosts: 0,
    boxes: 0,
    holdingDays: 0,
    stakedCumulative: 0,
    referrals: 0
  })

  // Fetch HH price from DexScreener
  useEffect(() => {
    const getPrice = async () => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${HH_ADDRESS}`)
        const data = await res.json()
        const pair = data.pairs?.[0]
        if (pair) {
          setHhPrice(parseFloat(pair.priceUsd) || 0.00025)
        }
      } catch (err) {
        console.error('DexScreener API error in AirdropChecklist:', err)
      }
    }
    getPrice()
    const interval = setInterval(getPrice, 30000)
    return () => clearInterval(interval)
  }, [])

  // Fetch stats from Supabase
  useEffect(() => {
    if (!address || !isConnected) {
      setLoading(false)
      return
    }

    const fetchUserStats = async () => {
      try {
        const userAddr = address.toLowerCase()
        let checkins = 0
        let boosts = 0
        let boxes = 0
        let holdingDays = 0
        let stakedCumulative = 0
        let referrals = 0

        // Attempt RPC call first for performance
        const { data, error } = await db.rpc('get_user_distribution_criteria', { p_address: userAddr })
        if (!error && data) {
          checkins = data.checkins || 0
          boosts = data.boosts || 0
          boxes = data.boxes || 0
          holdingDays = data.holding_days || 0
          stakedCumulative = parseFloat(data.staked_cumulative || 0)
          referrals = data.referrals || 0
        } else {
          console.warn('RPC failed or not deployed, running fallback queries:', error)
          
          // Fallback 1: Count check-ins
          const { count: checkinsCount } = await db
            .from('checkins')
            .select('*', { count: 'exact', head: true })
            .eq('address', userAddr)
          checkins = checkinsCount || 0

          // Fallback 2: Count daily boosts
          const { count: boostsCount } = await db
            .from('hp_boosts')
            .select('*', { count: 'exact', head: true })
            .eq('address', userAddr)
          boosts = boostsCount || 0

          // Fallback 3: Count box openings
          const { count: boxesCount } = await db
            .from('opened_boxes')
            .select('*', { count: 'exact', head: true })
            .eq('address', userAddr)
            .not('box_type', 'in', '("standard_bundle","happy_bundle","shield","extra_attempt")')
          boxes = boxesCount || 0

          // Fallback 4: Fetch holding days & cumulative staking
          const { data: criteriaData } = await db
            .from('hh_distribution_criteria')
            .select('holding_days, staked_cumulative')
            .eq('address', userAddr)
            .maybeSingle()
          
          holdingDays = criteriaData?.holding_days || 0
          stakedCumulative = parseFloat(criteriaData?.staked_cumulative || 0)

          // Fallback 5: Count active referrals
          const { data: refUsers } = await db
            .from('users')
            .select('address')
            .eq('referrer', userAddr)

          if (refUsers) {
            let activeRefs = 0
            for (const r of refUsers) {
              const { data: stats } = await db
                .from('daily_stats')
                .select('tx_count')
                .eq('address', r.address)
              
              const txSum = stats?.reduce((acc, curr) => acc + (curr.tx_count || 0), 0) || 0
              if (txSum >= 5) activeRefs++
            }
            referrals = activeRefs
          }
        }

        setChecklistStats({
          checkins,
          boosts,
          boxes,
          holdingDays,
          stakedCumulative,
          referrals
        })
      } catch (err) {
        console.warn('Error loading user stats from db:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUserStats()
  }, [address, isConnected])

  // Real-time On-chain Staking positions read
  const { data: contractPositionsRaw } = useReadContract({
    address: STAKING_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'getUserPositions',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 }
  })

  // Calculate cumulative staked balance from on-chain positions
  const onChainCumulativeStaking = contractPositionsRaw !== undefined
    ? contractPositionsRaw.reduce((acc, pos) => {
        const amount = pos.amount !== undefined ? pos.amount : pos[0]
        return acc + parseFloat(formatUnits(amount || 0n, 18))
      }, 0)
    : (() => {
        // Simulated fallback positions
        try {
          const saved = localStorage.getItem('hh_simulated_stakes_list')
          if (saved) {
            const list = JSON.parse(saved)
            return list.reduce((acc, s) => acc + s.amount, 0)
          }
        } catch {}
        return 0
      })()

  // Use the greater of on-chain sum and DB sum (which has offline events/triggers)
  const totalStakedCumulative = Math.max(onChainCumulativeStaking, checklistStats.stakedCumulative)

  // Configure Required Criteria
  const requiredItems = [
    {
      id: 'checkins',
      title: 'Daily Check-ins',
      desc: 'Check in 10+ times in total',
      progress: checklistStats.checkins,
      target: 10,
      icon: '📆'
    },
    {
      id: 'boosts',
      title: 'Daily HP Boosts',
      desc: 'Activate daily HP boost 5+ times',
      progress: checklistStats.boosts,
      target: 5,
      icon: '⚡'
    },
    {
      id: 'boxes',
      title: 'Happy Box Openings',
      desc: 'Open 12+ boxes (USDC or $HH)',
      progress: checklistStats.boxes,
      target: 12,
      icon: '🎁'
    },
    {
      id: 'holding',
      title: 'HH Holding Duration',
      desc: 'Hold 17M+ $HH for 10+ days (checked at 00:00 UTC)',
      progress: checklistStats.holdingDays,
      target: 10,
      icon: '⏳'
    }
  ]

  // Configure Optional/Multiplier Criteria
  const optionalItems = [
    {
      id: 'staking',
      title: 'Cumulative $HH Staking',
      desc: 'Stake 40M+ $HH in total (sum of all positions)',
      progress: totalStakedCumulative,
      target: 40000000,
      isToken: true,
      icon: '💎'
    },
    {
      id: 'referrals',
      title: 'Active Referrals',
      desc: 'Invite 3+ active referrals (users with 5+ transactions)',
      progress: checklistStats.referrals,
      target: 3,
      icon: '👥'
    }
  ]

  const completedRequired = requiredItems.filter(item => item.progress >= item.target).length
  const completedOptional = optionalItems.filter(item => item.progress >= item.target).length
  const totalRequired = requiredItems.length

  const isEligible = completedRequired === totalRequired
  const hasMultiplier = isEligible && completedOptional > 0

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'rgba(255, 255, 255, 0.48)' }}>
        Loading criteria…
      </div>
    )
  }

  return (
    <div style={{ padding: '0 16px 120px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes floatingLogo {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-8px) rotate(3deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        @keyframes subtlePulseGlow {
          0%, 100% { box-shadow: 0 0 15px rgba(56, 189, 248, 0.2), inset 0 1px 1px rgba(255,255,255,0.1); }
          50% { box-shadow: 0 0 30px rgba(56, 189, 248, 0.45), inset 0 1px 1px rgba(255,255,255,0.25); }
        }
        @keyframes goldPulseGlow {
          0%, 100% { box-shadow: 0 0 15px rgba(245, 158, 11, 0.25), inset 0 1px 1px rgba(255,255,255,0.15); }
          50% { box-shadow: 0 0 30px rgba(245, 158, 11, 0.55), inset 0 1px 1px rgba(255,255,255,0.3); }
        }
      ` }} />

      {/* Season 2 Airdrop Eligibility Banner */}
      <div style={{
        backgroundImage: 'url(/banner.jpg)',
        backgroundColor: '#040d21', // Fallback
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderRadius: 24,
        padding: '32px 20px',
        marginBottom: 16,
        position: 'relative',
        minHeight: 160,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
        overflow: 'hidden',
        border: '1px solid rgba(56, 189, 248, 0.15)',
        boxSizing: 'border-box'
      }}>
        {/* Background overlays */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(4, 13, 33, 0.45)', zIndex: 0 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(56, 189, 248, 0.1) 100%)', zIndex: 0 }} />

        {/* Floating $HH Logos & Parachutes */}
        {[
          { type: 'logo', top: '8%', left: '4%', size: 38, opacity: 0.35, r: '-15deg', dur: 4.5 },
          { type: 'logo', bottom: '8%', right: '4%', size: 44, opacity: 0.38, r: '12deg', dur: 5.2 },
          { type: 'logo', top: '50%', left: '12%', size: 28, opacity: 0.32, r: '-10deg', dur: 4.0 },
          { type: 'parachute', top: '45%', right: '12%', size: 30, opacity: 0.35, r: '15deg', dur: 4.8 },
          { type: 'parachute', top: '10%', right: '8%', size: 34, opacity: 0.3, r: '-8deg', dur: 5.5 },
          { type: 'parachute', bottom: '12%', left: '6%', size: 24, opacity: 0.28, r: '10deg', dur: 6.0 }
        ].map((s, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: s.top,
            right: s.right,
            left: s.left,
            bottom: s.bottom,
            zIndex: 1,
            pointerEvents: 'none',
            userSelect: 'none',
            animation: `floatingLogo ${s.dur}s ease-in-out infinite`,
          }}>
            {s.type === 'logo' ? (
              <img
                src="/logo.jfif"
                alt=""
                style={{
                  width: s.size,
                  height: s.size,
                  borderRadius: '50%',
                  opacity: s.opacity,
                  transform: `rotate(${s.r})`,
                  objectFit: 'cover'
                }}
              />
            ) : (
              <span style={{
                fontSize: s.size,
                opacity: s.opacity,
                display: 'inline-block',
                transform: `rotate(${s.r})`
              }}>
                🪂
              </span>
            )}
          </div>
        ))}

        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 42,
            fontWeight: 900,
            color: '#FFFFFF',
            lineHeight: 1.1,
            textShadow: '0 4px 15px rgba(0,0,0,0.8)',
            letterSpacing: '-0.5px'
          }}>
            $HH Distribution
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            borderRadius: 50,
            padding: '6px 16px',
            fontSize: 10,
            fontWeight: 800,
            color: 'rgba(255, 255, 255, 0.9)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'inline-block',
            marginTop: 12,
            letterSpacing: '0.5px'
          }}>
            Season 2 Airdrop Eligibility Checklist
          </div>
        </div>
      </div>

      {/* Info Card (Earn Section Style) */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 20,
        padding: '16px 20px',
        marginBottom: 16,
        color: 'rgba(255, 255, 255, 0.7)'
      }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 16 }}>ℹ️</span>
          <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, fontWeight: 500 }}>
            Ці умови є мінімальними критеріями. Чим більше чекінів, бустів, відкритих боксів та рефералів ви зробите, тим більшою буде ваша фінальна аллокація. Обов'язкові умови необхідні для допуску до розподілу, а додаткові — активують мультиплікатор нагороди.
          </p>
        </div>
      </div>

      {/* Eligibility Status Banner (ONLY visible when eligible) */}
      {isEligible && (
        <div style={{
          marginBottom: 16,
          padding: '18px 24px',
          borderRadius: 20,
          background: hasMultiplier 
            ? 'linear-gradient(135deg, #78350F 0%, #451A03 100%)' 
            : 'linear-gradient(135deg, #064E3B 0%, #022C22 100%)',
          border: hasMultiplier
            ? '1px solid rgba(245, 158, 11, 0.35)'
            : '1px solid rgba(16, 185, 129, 0.35)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          animation: hasMultiplier ? 'goldPulseGlow 3s infinite' : 'subtlePulseGlow 3s infinite',
        }}>
          <div style={{
            fontSize: 32,
            background: hasMultiplier ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
            width: 52,
            height: 52,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: hasMultiplier ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
          }}>
            {hasMultiplier ? '🏆' : '✅'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 800,
              color: hasMultiplier ? '#FBBF24' : '#34D399',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Ваш статус
            </div>
            <h3 style={{
              fontSize: 18,
              fontWeight: 900,
              color: '#FFFFFF',
              margin: '2px 0 0',
              fontFamily: "'Montserrat', sans-serif"
            }}>
              {hasMultiplier ? 'Eligible with Multiplier' : 'Eligible'}
            </h3>
          </div>
        </div>
      )}

      {/* Required Criteria Section */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(4, 23, 51, 0.45) 0%, rgba(4, 23, 51, 0.2) 100%)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(56, 189, 248, 0.15)',
        borderRadius: 24,
        padding: 20,
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{
            fontSize: 11,
            fontWeight: 900,
            color: '#38BDF8',
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            margin: 0
          }}>
            Обов'язкові критерії (Required)
          </h3>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: '#FFFFFF' }}>
            {completedRequired} / {totalRequired} Виконано
          </span>
        </div>

        {/* Required items list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {requiredItems.map((item) => {
            const isCompleted = item.progress >= item.target
            return (
              <div key={item.id} style={{
                display: 'flex', gap: 12, padding: 14, borderRadius: 16,
                background: 'rgba(255, 255, 255, 0.02)',
                border: isCompleted ? '1px solid rgba(16, 185, 129, 0.18)' : '1px solid rgba(255, 255, 255, 0.05)',
                transition: 'all 0.2s'
              }}>
                <span style={{ fontSize: 22, alignSelf: 'center' }}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: 13, fontWeight: 800, color: '#FFFFFF', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 900,
                        color: isCompleted ? '#10B981' : 'rgba(255, 255, 255, 0.5)',
                        background: isCompleted ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.06)',
                        padding: '1.5px 7px', borderRadius: 8
                      }}>
                        {formatNumber(item.progress)} / {item.target}
                      </span>
                      {isCompleted && <span style={{ color: '#10B981', fontSize: 12, fontWeight: 900 }}>Done</span>}
                    </div>
                  </div>
                  <p style={{
                    fontSize: 10.5,
                    color: 'rgba(255, 255, 255, 0.48)',
                    margin: '3px 0 0',
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden'
                  }}>{item.desc}</p>
                  
                  {/* Progress bar */}
                  <div style={{ height: 4, background: 'rgba(255, 255, 255, 0.06)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${Math.min(100, (item.progress / item.target) * 100)}%`,
                      background: isCompleted ? '#10B981' : '#38BDF8', borderRadius: 2
                    }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Additional Criteria Section */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.00) 100%)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 24,
        padding: 20
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{
            fontSize: 11,
            fontWeight: 900,
            color: '#FBBF24',
            letterSpacing: '1.2px',
            textTransform: 'uppercase',
            margin: 0
          }}>
            Додаткові критерії (Optional - Multipliers)
          </h3>
          <span style={{ fontSize: 11.5, fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>
            {completedOptional} / {optionalItems.length} Виконано
          </span>
        </div>

        {/* Optional items list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {optionalItems.map((item) => {
            const isCompleted = item.progress >= item.target
            return (
              <div key={item.id} style={{
                display: 'flex', gap: 12, padding: 14, borderRadius: 16,
                background: 'rgba(255, 255, 255, 0.01)',
                border: isCompleted ? '1px solid rgba(245, 158, 11, 0.22)' : '1px solid rgba(255, 255, 255, 0.04)',
                transition: 'all 0.2s'
              }}>
                <span style={{ fontSize: 22, alignSelf: 'center' }}>{item.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: 13, fontWeight: 800, color: '#FFFFFF', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</h4>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 900,
                        color: isCompleted ? '#FBBF24' : 'rgba(255, 255, 255, 0.5)',
                        background: isCompleted ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                        padding: '1.5px 7px', borderRadius: 8
                      }}>
                        {item.isToken ? `${formatTokenAmount(item.progress)} / ${formatTokenAmount(item.target)} HH` : `${formatNumber(item.progress)} / ${item.target}`}
                      </span>
                      {isCompleted && <span style={{ color: '#FBBF24', fontSize: 12, fontWeight: 900 }}>Done</span>}
                    </div>
                  </div>
                  <p style={{
                    fontSize: 10.5,
                    color: 'rgba(255, 255, 255, 0.48)',
                    margin: '3px 0 0',
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden'
                  }}>{item.desc}</p>
                  
                  {/* Progress bar */}
                  <div style={{ height: 4, background: 'rgba(255, 255, 255, 0.06)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${Math.min(100, (item.progress / item.target) * 100)}%`,
                      background: isCompleted ? '#FBBF24' : '#94A3B8', borderRadius: 2
                    }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
