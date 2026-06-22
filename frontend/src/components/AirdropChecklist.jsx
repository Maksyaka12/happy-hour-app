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

const calculateSeasonTimeLeft = () => {
  // Target date: July 22, 2026 at 19:52:00 UTC (exactly 30 days from June 22, 2026)
  // Month index 6 is July
  const target = new Date(Date.UTC(2026, 6, 22, 19, 52, 0))
  const now = new Date()
  const diff = target.getTime() - now.getTime()
  
  if (isNaN(diff) || diff <= 0) return '00d 00h 00m 00s'
  
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  
  return `${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
}

export function AirdropChecklist({ setTab }) {
  const { address, isConnected } = useAccount()
  const [hhPrice, setHhPrice] = useState(0.00025)
  const [loading, setLoading] = useState(true)
  const [seasonTimeLeft, setSeasonTimeLeft] = useState(calculateSeasonTimeLeft())
  const [checklistStats, setChecklistStats] = useState({
    checkins: 0,
    boosts: 0,
    boxes: 0,
    holdingDays: 0,
    stakedCumulative: 0,
    referrals: 0,
    socialTasks: 0,
    hhBurnBoxes: 0
  })

  useEffect(() => {
    const timer = setInterval(() => {
      setSeasonTimeLeft(calculateSeasonTimeLeft())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

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
        let socialTasks = 0
        let hhBurnBoxes = 0

        // Attempt RPC call first for performance
        const { data, error } = await db.rpc('get_user_distribution_criteria', { p_address: userAddr })
        if (!error && data) {
          checkins = data.checkins || 0
          boosts = data.boosts || 0
          boxes = data.boxes || 0
          holdingDays = data.holding_days || 0
          stakedCumulative = parseFloat(data.staked_cumulative || 0)
          referrals = data.referrals || 0
          socialTasks = data.social_tasks || 0
          hhBurnBoxes = data.hh_burn_boxes || 0
        } else {
          console.warn('RPC failed or not deployed, running optimized fallback queries:', error)
          
          // First, fetch holding days, cumulative staking & admin adjustments to use in all fallbacks
          const { data: criteriaData } = await db
            .from('hh_distribution_criteria')
            .select('*')
            .eq('address', userAddr)
            .maybeSingle()

          // Fallback 1: Count check-ins
          const { count: checkinsCount } = await db
            .from('checkins')
            .select('*', { count: 'exact', head: true })
            .eq('address', userAddr)
          checkins = (checkinsCount || 0) + (criteriaData?.adjust_checkins || 0)

          // Fallback 2: Count daily boosts
          const { count: boostsCount } = await db
            .from('hp_boosts')
            .select('*', { count: 'exact', head: true })
            .eq('address', userAddr)
          boosts = (boostsCount || 0) + (criteriaData?.adjust_boosts || 0)

          // Fallback 3: Count box openings
          const { count: boxesCount } = await db
            .from('opened_boxes')
            .select('*', { count: 'exact', head: true })
            .eq('address', userAddr)
            .not('box_type', 'in', '("standard_bundle","happy_bundle","shield","extra_attempt")')
          boxes = (boxesCount || 0) + (criteriaData?.adjust_boxes || 0)

          // Fallback 4: Compute holding days & cumulative staking
          holdingDays = (criteriaData?.holding_days || 0) + (criteriaData?.adjust_holding_days || 0)
          stakedCumulative = parseFloat(criteriaData?.staked_cumulative || 0) + parseFloat(criteriaData?.adjust_staked_cumulative || 0)

          // Fallback 5: Count active referrals (Optimized: 2 queries total instead of N loop queries)
          const { data: refUsers } = await db
            .from('users')
            .select('address')
            .eq('referrer', userAddr)

          if (refUsers && refUsers.length > 0) {
            const refAddresses = refUsers.map(r => r.address.toLowerCase())
            const { data: stats } = await db
              .from('daily_stats')
              .select('address, tx_count')
              .in('address', refAddresses)
            
            // Sum tx_count per address
            const txCounts = {}
            stats?.forEach(s => {
              const addr = s.address.toLowerCase()
              txCounts[addr] = (txCounts[addr] || 0) + (s.tx_count || 0)
            })
            
            let activeRefs = 0
            Object.values(txCounts).forEach(txSum => {
              if (txSum >= 5) activeRefs++
            })
            referrals = activeRefs
          }
          referrals = referrals + (criteriaData?.adjust_referrals || 0)

          // Fallback 6: Count social tasks
          const { count: socialCount } = await db
            .from('task_completions')
            .select('*', { count: 'exact', head: true })
            .eq('address', userAddr)
          socialTasks = (socialCount || 0) + (criteriaData?.adjust_social_tasks || 0)

          // Fallback 7: Count $HH box openings (burns)
          const { count: hhBoxesCount } = await db
            .from('opened_boxes')
            .select('*', { count: 'exact', head: true })
            .eq('address', userAddr)
            .eq('is_hh', true)
            .not('box_type', 'in', '("standard_bundle","happy_bundle","shield","extra_attempt")')
          hhBurnBoxes = (hhBoxesCount || 0) + (criteriaData?.adjust_hh_burn_boxes || 0)
        }

        setChecklistStats({
          checkins,
          boosts,
          boxes,
          holdingDays,
          stakedCumulative,
          referrals,
          socialTasks,
          hhBurnBoxes
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
      style: {
        background: '#0B1E3F',
        border: '1px solid rgba(59,130,246,0.25)',
        imageFilter: 'hue-rotate(200deg) brightness(0.40) contrast(1.15)',
        barColor: '#0052FF'
      }
    },
    {
      id: 'boosts',
      title: 'Daily HP Boosts',
      desc: 'Activate daily HP boost 10+ times',
      progress: checklistStats.boosts,
      target: 10,
      style: {
        background: '#081E15',
        border: '1px solid rgba(16,185,129,0.25)',
        imageFilter: 'hue-rotate(110deg) brightness(0.40) contrast(1.15)',
        barColor: '#FC401F'
      }
    },
    {
      id: 'social_tasks',
      title: 'Social Tasks',
      desc: 'Complete 20+ social tasks',
      progress: checklistStats.socialTasks,
      target: 20,
      style: {
        background: '#1F0B15',
        border: '1px solid rgba(236,72,153,0.25)',
        imageFilter: 'hue-rotate(320deg) brightness(0.40) contrast(1.15)',
        barColor: '#EC4899'
      }
    },
    {
      id: 'boxes',
      title: 'Happy Box Openings',
      desc: 'Open 20+ boxes',
      progress: checklistStats.boxes,
      target: 20,
      style: {
        background: '#090514',
        border: '1px solid rgba(139,92,246,0.25)',
        imageFilter: 'hue-rotate(50deg) brightness(0.60) contrast(1.15)',
        barColor: '#A78BFA'
      }
    },
    {
      id: 'hh_burn_boxes',
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <img src="/logo.jfif" alt="$HH" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
          <span>$HH Burn in Boxes</span>
        </div>
      ),
      desc: 'Burn $HH 10+ times in boxes',
      progress: checklistStats.hhBurnBoxes,
      target: 10,
      style: {
        background: '#1C0808',
        border: '1px solid rgba(239,68,68,0.25)',
        imageFilter: 'hue-rotate(0deg) brightness(0.35) contrast(1.2)',
        barColor: '#EF4444'
      }
    },
    {
      id: 'holding',
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <img src="/logo.jfif" alt="$HH" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
          <span>$HH Holding Duration</span>
        </div>
      ),
      desc: 'Hold 17M+ $HH for 10+ days',
      progress: checklistStats.holdingDays,
      target: 10,
      style: {
        background: 'linear-gradient(145deg, rgba(36, 36, 44, 0.95) 0%, rgba(56, 58, 68, 0.90) 50%, rgba(24, 24, 30, 0.98) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        imageFilter: 'grayscale(100%) brightness(0.40) contrast(1.1)',
        barColor: '#38BDF8'
      }
    }
  ]

  // Configure Optional/Multiplier Criteria
  const optionalItems = [
    {
      id: 'staking',
      title: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <img src="/logo.jfif" alt="$HH" style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
          <span>$HH Staking (Cumulative)</span>
        </div>
      ),
      desc: 'Stake 40M+ $HH (sum of all positions)',
      progress: totalStakedCumulative,
      target: 40000000,
      isToken: true,
      style: {
        background: 'linear-gradient(145deg, rgba(20, 20, 25, 0.95) 0%, rgba(38, 39, 48, 0.90) 50%, rgba(12, 12, 16, 0.98) 100%)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        imageFilter: 'grayscale(100%) brightness(0.28) contrast(1.1)',
        barColor: '#F59E0B'
      }
    },
    {
      id: 'referrals',
      title: 'Active Referrals',
      desc: 'Invite 3+ referrals (5+ transaction)',
      progress: checklistStats.referrals,
      target: 3,
      style: {
        background: '#1D0F02',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        imageFilter: 'grayscale(100%) brightness(0.22) contrast(1.2)',
        gradientOverlay: 'linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(239, 68, 68, 0.18) 100%)',
        barColor: '#D97706'
      }
    }
  ]

  const completedRequired = requiredItems.filter(item => item.progress >= item.target).length
  const completedOptional = optionalItems.filter(item => item.progress >= item.target).length
  const totalRequired = requiredItems.length

  const isEligible = completedRequired === totalRequired
  const hasMultiplier = isEligible && completedOptional > 0

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#717886' }}>
        Loading criteria...
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
      ` }} />

      {/* Season 2 Airdrop Eligibility Banner */}
      <div style={{
        backgroundImage: 'url(/banner.jpg)',
        backgroundColor: '#0052FF', // Fallback
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
        boxShadow: '0 8px 32px rgba(0,82,255,0.15)',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        boxSizing: 'border-box'
      }}>
        {/* Background overlays */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 80, 0.3)', zIndex: 0 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,82,255,0.1) 100%)', zIndex: 0 }} />

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

        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', paddingTop: 0, paddingBottom: 32 }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 42,
            fontWeight: 900,
            color: '#FFFFFF',
            lineHeight: 1.1,
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            letterSpacing: '-0.5px',
            marginBottom: 0
          }}>
            $HH Distribution
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.18)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            borderRadius: 50,
            padding: '6px 16px',
            fontSize: 10,
            fontWeight: 800,
            color: '#FFFFFF',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            display: 'inline-block',
            marginTop: 6,
            letterSpacing: '0.5px'
          }}>
            Season 2 Airdrop Eligibility Checklist
          </div>
        </div>

        {/* Distinct Footer for Season End Info - Identical to USDC banner */}
        <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(12px)',
          padding: '8px 0',
          textAlign: 'center',
          borderTop: '1px solid rgba(255,255,255,0.1)',
          zIndex: 2
        }}>
          <div style={{
            fontSize: 12,
            fontWeight: 800,
            color: 'rgba(255,255,255,0.75)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}>
            <span>DISTRIBUTE IN:</span>
            <span style={{ 
              color: '#3C8AFF', 
              textShadow: '0 0 10px rgba(60,138,255,0.4)',
              background: 'rgba(60,138,255,0.1)',
              padding: '1px 6px',
              borderRadius: 6,
              border: '1px solid rgba(60,138,255,0.2)',
              fontWeight: 900, 
              fontFamily: "'DM Mono', monospace",
              fontSize: 13,
              letterSpacing: '0.5px'
            }}>{seasonTimeLeft}</span>
          </div>
        </div>
      </div>

      {/* Info Card (Premium Glassmorphism Theme) */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 82, 255, 0.08) 0%, rgba(0, 82, 255, 0.03) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(0, 82, 255, 0.22)',
        borderRadius: 16,
        padding: '12px 16px',
        marginBottom: 16,
        boxShadow: '0 8px 32px rgba(0, 82, 255, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
        boxSizing: 'border-box'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          color: '#1E293B',
          fontFamily: "'Outfit', 'Inter', sans-serif",
          fontSize: 11.5,
          lineHeight: 1.4
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#0052FF', fontSize: 12 }}>•</span>
              <span>
                <strong style={{ color: '#0052FF', fontWeight: 800 }}>Required Criteria</strong>: Necessary for airdrop eligibility.
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#0052FF', fontSize: 12 }}>•</span>
              <span>
                <strong style={{ color: '#D97706', fontWeight: 800 }}>Optional Criteria</strong>: Provides allocation multiplier.
              </span>
            </div>
          </div>
          
          <p style={{
            margin: 0,
            fontSize: 10.5,
            color: '#475569',
            lineHeight: 1.4,
            fontWeight: 500,
            borderTop: '1px solid rgba(0, 82, 255, 0.1)',
            paddingTop: 6,
            marginTop: 0
          }}>
            These represent the minimum eligibility thresholds, but all progress is cumulative. Exceeding these targets will dynamically increase your final allocation.
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
            ? 'linear-gradient(135deg, #FEF3C7 0%, #FFFBEB 100%)' 
            : 'linear-gradient(135deg, #D1FAE5 0%, #F0FDF4 100%)',
          border: hasMultiplier
            ? '1px solid #FDE68A'
            : '1px solid #A7F3D0',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          boxShadow: '0 4px 12px rgba(0,0,0,0.03)'
        }}>
          <div style={{
            fontSize: 32,
            background: hasMultiplier ? '#FEF3C7' : '#D1FAE5',
            width: 52,
            height: 52,
            borderRadius: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: hasMultiplier ? '1px solid #FCD34D' : '1px solid #6EE7B7',
          }}>
            {hasMultiplier ? '🏆' : '✅'}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 10,
              fontWeight: 800,
              color: hasMultiplier ? '#B45309' : '#047857',
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Your Status
            </div>
            <h3 style={{
              fontSize: 18,
              fontWeight: 900,
              color: hasMultiplier ? '#92400E' : '#065F46',
              margin: '2px 0 0',
              fontFamily: "'Outfit', 'Inter', sans-serif"
            }}>
              {hasMultiplier ? 'Eligible with Multiplier' : 'Eligible'}
            </h3>
          </div>
        </div>
      )}

      {/* ═══ Required Section Header (Outside the card) ═══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{
            fontFamily: "'Outfit', 'Inter', sans-serif",
            fontSize: 16,
            fontWeight: 800,
            color: '#0A0B0D',
            margin: 0,
          }}>
            Eligibility Criteria
          </h3>
          <span style={{
            background: '#0052FF',
            color: '#FFFFFF',
            fontSize: 9,
            fontWeight: 900,
            padding: '2.5px 6px',
            borderRadius: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontFamily: "'Outfit', 'Inter', sans-serif"
          }}>
            Required
          </span>
        </div>
        <span style={{
          fontFamily: "'Outfit', 'Inter', sans-serif",
          fontSize: 12,
          fontWeight: 800,
          color: '#717886'
        }}>
          {completedRequired} / {totalRequired} Completed
        </span>
      </div>

      {/* Required items list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {requiredItems.map((item) => {
          const isCompleted = item.progress >= item.target
          return (
            <div 
              key={item.id} 
              onClick={() => {
                if (item.id === 'checkins') {
                  sessionStorage.setItem('scroll_to_element', 'checkin-card')
                  setTab('earn')
                } else if (item.id === 'boosts') {
                  sessionStorage.setItem('scroll_to_element', 'boost-card')
                  setTab('earn')
                } else if (item.id === 'holding') {
                  sessionStorage.setItem('scroll_to_element', 'holding-card')
                  setTab('earn')
                } else if (item.id === 'staking') {
                  sessionStorage.setItem('scroll_to_element', 'staking-card')
                  setTab('earn')
                } else if (item.id === 'boxes') {
                  setTab('boxes')
                } else if (item.id === 'hh_burn_boxes') {
                  sessionStorage.setItem('scroll_to_element', 'boxes-section-top')
                  setTab('boxes')
                } else if (item.id === 'referrals') {
                  sessionStorage.setItem('scroll_to_element', 'referrals-card')
                  setTab('home')
                } else if (item.id === 'social_tasks') {
                  sessionStorage.setItem('scroll_to_element', 'tasks-section-top')
                  setTab('tasks')
                }
              }}
              style={{
                background: item.style.background,
                border: item.style.border,
                borderRadius: 20,
                padding: '16px 18px',
                boxShadow: '0 8px 32px rgba(10, 10, 15, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                boxSizing: 'border-box',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 12px 36px rgba(10, 10, 15, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(10, 10, 15, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
              }}
            >
              {/* Background image overlay */}
              <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'url(/banner.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: item.style.imageFilter,
                zIndex: 0,
                pointerEvents: 'none'
              }} />

              {/* Optional gradient overlay */}
              {item.style.gradientOverlay && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: item.style.gradientOverlay,
                  zIndex: 1,
                  pointerEvents: 'none'
                }} />
              )}

              {/* Foreground content wrapper */}
              <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{
                    fontSize: 14.5,
                    fontWeight: 800,
                    color: '#FFFFFF',
                    fontFamily: "'Outfit', 'Inter', sans-serif"
                  }}>
                    {item.title}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: 'rgba(255, 255, 255, 0.7)',
                    marginTop: 2,
                    fontWeight: 600,
                    fontFamily: "'Outfit', 'Inter', sans-serif"
                  }}>
                    {item.desc}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 52,
                    height: 18,
                    fontSize: 9,
                    fontWeight: 900,
                    background: isCompleted ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.15)',
                    color: isCompleted ? '#10B981' : '#FFFFFF',
                    border: isCompleted ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 6,
                    fontFamily: "'Outfit', 'Inter', sans-serif",
                    boxSizing: 'border-box'
                  }}>
                    {formatNumber(item.progress)}/{item.target}
                  </span>
                  {isCompleted && <span style={{ color: '#10B981', fontSize: 11, fontWeight: 900, fontFamily: "'Outfit', 'Inter', sans-serif" }}>Done</span>}
                </div>
              </div>

              {/* Progress bar */}
              <div style={{
                position: 'relative',
                zIndex: 2,
                height: 4,
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 2,
                marginTop: 2,
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, (item.progress / item.target) * 100)}%`,
                  background: isCompleted ? '#10B981' : item.style.barColor,
                  borderRadius: 2
                }} />
              </div>
            </div>
          )
        })}
      </div>

      {/* ═══ Optional Section Header (Outside the card) ═══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 24, padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h3 style={{
            fontFamily: "'Outfit', 'Inter', sans-serif",
            fontSize: 16,
            fontWeight: 800,
            color: '#0A0B0D',
            margin: 0,
          }}>
            Allocation Multiplier
          </h3>
          <span style={{
            background: '#D97706',
            color: '#FFFFFF',
            fontSize: 9,
            fontWeight: 900,
            padding: '2.5px 6px',
            borderRadius: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontFamily: "'Outfit', 'Inter', sans-serif"
          }}>
            Optional
          </span>
        </div>
        <span style={{
          fontFamily: "'Outfit', 'Inter', sans-serif",
          fontSize: 12,
          fontWeight: 800,
          color: '#717886'
        }}>
          {completedOptional} / {optionalItems.length} Completed
        </span>
      </div>

      {/* Optional items list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {optionalItems.map((item) => {
          const isCompleted = item.progress >= item.target
          return (
            <div 
              key={item.id} 
              onClick={() => {
                if (item.id === 'checkins') {
                  sessionStorage.setItem('scroll_to_element', 'checkin-card')
                  setTab('earn')
                } else if (item.id === 'boosts') {
                  sessionStorage.setItem('scroll_to_element', 'boost-card')
                  setTab('earn')
                } else if (item.id === 'holding') {
                  sessionStorage.setItem('scroll_to_element', 'holding-card')
                  setTab('earn')
                } else if (item.id === 'staking') {
                  sessionStorage.setItem('scroll_to_element', 'staking-card')
                  setTab('earn')
                } else if (item.id === 'boxes') {
                  setTab('boxes')
                } else if (item.id === 'hh_burn_boxes') {
                  sessionStorage.setItem('scroll_to_element', 'boxes-section-top')
                  setTab('boxes')
                } else if (item.id === 'referrals') {
                  sessionStorage.setItem('scroll_to_element', 'referrals-card')
                  setTab('home')
                } else if (item.id === 'social_tasks') {
                  sessionStorage.setItem('scroll_to_element', 'tasks-section-top')
                  setTab('tasks')
                }
              }}
              style={{
                background: item.style.background,
                border: item.style.border,
                borderRadius: 20,
                padding: '16px 18px',
                boxShadow: '0 8px 32px rgba(10, 10, 15, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                boxSizing: 'border-box',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 12px 36px rgba(10, 10, 15, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'none'
                e.currentTarget.style.boxShadow = '0 8px 32px rgba(10, 10, 15, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08)'
              }}
            >
              {/* Background image overlay */}
              <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'url(/banner.jpg)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: item.style.imageFilter,
                zIndex: 0,
                pointerEvents: 'none'
              }} />

              {/* Optional gradient overlay */}
              {item.style.gradientOverlay && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: item.style.gradientOverlay,
                  zIndex: 1,
                  pointerEvents: 'none'
                }} />
              )}

              {/* Foreground content wrapper */}
              <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{
                    fontSize: 14.5,
                    fontWeight: 800,
                    color: '#FFFFFF',
                    fontFamily: "'Outfit', 'Inter', sans-serif"
                  }}>
                    {item.title}
                  </div>
                  <div style={{
                    fontSize: 10,
                    color: 'rgba(255, 255, 255, 0.7)',
                    marginTop: 2,
                    fontWeight: 600,
                    fontFamily: "'Outfit', 'Inter', sans-serif"
                  }}>
                    {item.desc}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: item.id === 'staking' ? 82 : 52,
                    height: 18,
                    fontSize: 9,
                    fontWeight: 900,
                    background: isCompleted 
                      ? (item.id === 'staking' || item.id === 'referrals' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)') 
                      : 'rgba(255, 255, 255, 0.15)',
                    color: isCompleted 
                      ? (item.id === 'staking' || item.id === 'referrals' ? '#FBBF24' : '#10B981') 
                      : '#FFFFFF',
                    border: isCompleted 
                      ? (item.id === 'staking' || item.id === 'referrals' ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255, 255, 255, 0.15)') 
                      : '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 6,
                    fontFamily: "'Outfit', 'Inter', sans-serif",
                    boxSizing: 'border-box'
                  }}>
                    {item.isToken ? `${formatTokenAmount(item.progress)}/${formatTokenAmount(item.target)}` : `${formatNumber(item.progress)}/${item.target}`}
                  </span>
                  {isCompleted && <span style={{ color: '#FBBF24', fontSize: 11, fontWeight: 900, fontFamily: "'Outfit', 'Inter', sans-serif" }}>Done</span>}
                </div>
              </div>

              {/* Progress bar */}
              <div style={{
                position: 'relative',
                zIndex: 2,
                height: 4,
                background: 'rgba(255, 255, 255, 0.08)',
                borderRadius: 2,
                marginTop: 2,
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, (item.progress / item.target) * 100)}%`,
                  background: isCompleted ? '#FBBF24' : item.style.barColor,
                  borderRadius: 2
                }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
