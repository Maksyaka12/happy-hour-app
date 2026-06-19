import { useState, useEffect } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { db } from '../config/supabase'
import { HH_ADDRESS, STAKING_ADDRESS, HH_ABI, STAKING_ABI } from '../config/constants'

const formatNumber = (num, decimals = 2) => {
  return parseFloat(num || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

export function AirdropChecklist() {
  const { address, isConnected } = useAccount()
  const [hhPrice, setHhPrice] = useState(0.00025)
  const [checklistStats, setChecklistStats] = useState({
    checkins: 7,
    raids: 12,
    boxes: 18
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

  // Fetch real stats from Supabase for checklist
  useEffect(() => {
    if (!address || !isConnected) return

    const fetchUserStats = async () => {
      try {
        const userAddr = address.toLowerCase()
        
        // 1. Fetch checkins count
        const { count: checkinsCount } = await db
          .from('checkins')
          .select('*', { count: 'exact', head: true })
          .eq('address', userAddr)

        // 2. Fetch raids count (bets)
        const { count: raidsCount } = await db
          .from('bets')
          .select('*', { count: 'exact', head: true })
          .eq('address', userAddr)

        // 3. Fetch opened boxes count
        const { count: boxesCount } = await db
          .from('opened_boxes')
          .select('*', { count: 'exact', head: true })
          .eq('address', userAddr)

        setChecklistStats({
          checkins: checkinsCount || 0,
          raids: raidsCount || 0,
          boxes: boxesCount || 0
        })
      } catch (err) {
        console.warn('Error loading user stats from db, using fallback:', err)
      }
    }

    fetchUserStats()
  }, [address, isConnected])

  // Real Staked Balance read
  const { data: stakedBalanceRaw } = useReadContract({
    address: STAKING_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'totalActiveStaked',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 }
  })

  // Fallback to simulated staking balance from localStorage if contract read is not active
  const stakedBalance = stakedBalanceRaw !== undefined
    ? parseFloat(formatUnits(stakedBalanceRaw, 18))
    : (() => {
        try {
          return parseFloat(localStorage.getItem('hh_simulated_staked') || '0')
        } catch {
          return 0
        }
      })()

  const stakedUsdValue = stakedBalance * hhPrice

  // Checklist configuration
  const checklistItems = [
    {
      id: 'checkins',
      title: 'Daily Check-ins',
      desc: 'Complete 15 daily check-ins to qualify',
      progress: checklistStats.checkins,
      target: 15,
      icon: '📆'
    },
    {
      id: 'raids',
      title: 'Happy Raids',
      desc: 'Participate in 20 raids to qualify',
      progress: checklistStats.raids,
      target: 20,
      icon: '⚔️'
    },
    {
      id: 'boxes',
      title: 'Happy Box Openings',
      desc: 'Open 30 premium boxes to qualify',
      progress: checklistStats.boxes,
      target: 30,
      icon: '🎁'
    },
    {
      id: 'staking',
      title: 'Active $HH Staking',
      desc: 'Stake at least $10.00 worth of $HH to qualify',
      progress: stakedUsdValue,
      target: 10,
      isUsd: true,
      icon: '💎'
    }
  ]

  const completedTasks = checklistItems.filter(item => item.progress >= item.target).length
  const totalTasks = checklistItems.length

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
        boxShadow: '0 12px 40px rgba(0,82,255,0.25)',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.15)',
        boxSizing: 'border-box'
      }}>
        {/* Background overlays */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 80, 0.35)', zIndex: 0 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,82,255,0.1) 100%)', zIndex: 0 }} />

        {/* Floating $HH Logos (Tokens) & Parachutes on Banner Background */}
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

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 42,
            fontWeight: 900,
            color: '#FFFFFF',
            lineHeight: 1.1,
            textShadow: '0 4px 15px rgba(0,0,0,0.6)',
            letterSpacing: '-0.5px'
          }}>
            Airdrop Eligibility
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            borderRadius: 50,
            padding: '6px 16px',
            fontSize: 10,
            fontWeight: 800,
            color: '#FFFFFF',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            display: 'inline-block',
            marginTop: 12,
            letterSpacing: '0.5px'
          }}>
            Complete all criteria below to be eligible
          </div>
        </div>
      </div>

      {/* Criteria Card (Lighter Blue Theme) */}
      <div style={{
        borderRadius: 20,
        padding: '20px 18px',
        marginBottom: 16,
        boxShadow: '0 8px 32px rgba(59, 130, 246, 0.2)',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(59, 130, 246, 0.35)',
        background: '#041733',
        animation: 'fadeIn 0.3s ease-out'
      }}>
        {/* Grayscaled background image overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/banner.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'grayscale(100%) brightness(0.32) contrast(1.15)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />

        {/* Blue/light gradient overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(29, 78, 216, 0.1) 100%)',
          zIndex: 1,
          pointerEvents: 'none'
        }} />

        {/* Content Container */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* Eligibility progress bar */}
          <div style={{ marginTop: 4, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 850, color: '#FFFFFF', marginBottom: 6 }}>
              <span>Progress</span>
              <span style={{ color: '#FBBF24' }}>{completedTasks} / {totalTasks} Completed</span>
            </div>
            <div style={{ height: 10, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${(completedTasks / totalTasks) * 100}%`,
                background: 'linear-gradient(90deg, #3B82F6 0%, #10B981 100%)',
                borderRadius: 6
              }} />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {checklistItems.map((item) => {
              const isCompleted = item.progress >= item.target
              return (
                <div key={item.id} style={{
                  display: 'flex', gap: 14, padding: 16, borderRadius: 14,
                  border: isCompleted ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(255, 255, 255, 0.12)',
                  background: isCompleted ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.06)',
                  backdropFilter: 'blur(8px)',
                  transition: 'all 0.2s'
                }}>
                  <span style={{ fontSize: 24, alignSelf: 'center' }}>{item.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: 13, fontWeight: 850, color: '#FFFFFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{item.title}</h4>
                      <span style={{
                        fontSize: 10, fontWeight: 900,
                        color: isCompleted ? '#10B981' : 'rgba(255, 255, 255, 0.7)',
                        background: isCompleted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.1)',
                        padding: '2px 8px', borderRadius: 10,
                        flexShrink: 0
                      }}>
                        {item.isUsd ? '$' : ''}{formatNumber(item.progress, item.isUsd ? 2 : 0)} / {item.isUsd ? '$' : ''}{item.target}
                      </span>
                    </div>
                    <p style={{
                      fontSize: 10.5,
                      color: 'rgba(255, 255, 255, 0.6)',
                      marginTop: 2,
                      lineHeight: 1.4,
                      whiteSpace: 'nowrap',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden'
                    }}>{item.desc}</p>
                    
                    {/* Tiny item progress bar */}
                    <div style={{ height: 4, background: 'rgba(255, 255, 255, 0.1)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${Math.min(100, (item.progress / item.target) * 100)}%`,
                        background: isCompleted ? '#10B981' : '#3B82F6', borderRadius: 2
                      }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {completedTasks === totalTasks ? (
            <div style={{
              marginTop: 24, padding: 16, borderRadius: 16,
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: '#FFFFFF', textAlign: 'center', fontWeight: 900, fontSize: 14,
              boxShadow: '0 4px 14px rgba(16,185,129,0.3)',
            }}>
              🎉 Congratulations! You are eligible for the Airdrop!
            </div>
          ) : (
            <div style={{
              marginTop: 24, padding: 14, borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.12)',
              color: 'rgba(255, 255, 255, 0.6)', textAlign: 'center', fontSize: 11.5, fontWeight: 750
            }}>
              🔒 Complete all 4 conditions to unlock your allocation badge
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
