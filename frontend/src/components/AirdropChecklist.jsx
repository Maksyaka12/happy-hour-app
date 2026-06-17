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
          .eq('user_address', userAddr)

        // 2. Fetch raids count (bets)
        const { count: raidsCount } = await db
          .from('bets')
          .select('*', { count: 'exact', head: true })
          .eq('user_address', userAddr)

        // 3. Fetch opened boxes count
        const { count: boxesCount } = await db
          .from('opened_boxes')
          .select('*', { count: 'exact', head: true })
          .eq('user_address', userAddr)

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
    functionName: 'stakedBalances',
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
      desc: 'Complete 15 daily check-ins to secure airdrop weight',
      progress: checklistStats.checkins,
      target: 15,
      icon: '📆'
    },
    {
      id: 'raids',
      title: 'Happy Raids',
      desc: 'Participate in 20 raids to show active participation',
      progress: checklistStats.raids,
      target: 20,
      icon: '⚔️'
    },
    {
      id: 'boxes',
      title: 'Happy Box Openings',
      desc: 'Open 30 premium boxes to burn $HH and trigger game rounds',
      progress: checklistStats.boxes,
      target: 30,
      icon: '🎁'
    },
    {
      id: 'staking',
      title: 'Active $HH Staking',
      desc: 'Stake at least $10.00 worth of $HH to qualify as a holder',
      progress: stakedUsdValue,
      target: 10,
      isUsd: true,
      icon: '💎'
    }
  ]

  const completedTasks = checklistItems.filter(item => item.progress >= item.target).length
  const totalTasks = checklistItems.length
  const checklistPercentage = Math.round((completedTasks / totalTasks) * 100)

  return (
    <div style={{ padding: '0 16px 120px' }}>
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #DEE1E7',
        borderRadius: 24,
        padding: 24,
        boxShadow: '0 4px 16px rgba(10,11,13,0.04)',
        animation: 'fadeIn 0.3s ease-out'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0A0B0D' }}>🪂 Season 2 Airdrop Eligibility</h3>
          <p style={{ fontSize: 12, color: '#717886', marginTop: 4 }}>Complete all tasks below to guarantee your token allocation</p>
          
          {/* Eligibility progress bar */}
          <div style={{ marginTop: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 850, color: '#32353D', marginBottom: 6 }}>
              <span>Overall Progress</span>
              <span>{checklistPercentage}% Completed</span>
            </div>
            <div style={{ height: 10, background: '#EEF0F3', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${checklistPercentage}%`,
                background: 'linear-gradient(90deg, #3B82F6 0%, #10B981 100%)',
                borderRadius: 6
              }} />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {checklistItems.map((item) => {
            const isCompleted = item.progress >= item.target
            return (
              <div key={item.id} style={{
                display: 'flex', gap: 14, padding: 16, borderRadius: 16,
                border: isCompleted ? '1.5px solid rgba(16, 185, 129, 0.3)' : '1px solid #DEE1E7',
                background: isCompleted ? '#F0FDF4' : 'transparent',
                transition: 'all 0.2s'
              }}>
                <span style={{ fontSize: 24, alignSelf: 'center' }}>{item.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: 13, fontWeight: 850, color: '#0A0B0D' }}>{item.title}</h4>
                    <span style={{
                      fontSize: 10, fontWeight: 900,
                      color: isCompleted ? '#059669' : '#717886',
                      background: isCompleted ? '#D1FAE5' : '#EEF0F3',
                      padding: '2px 8px', borderRadius: 10
                    }}>
                      {item.isUsd ? '$' : ''}{formatNumber(item.progress, item.isUsd ? 2 : 0)} / {item.isUsd ? '$' : ''}{item.target}
                    </span>
                  </div>
                  <p style={{ fontSize: 10.5, color: '#717886', marginTop: 2, lineHeight: 1.4 }}>{item.desc}</p>
                  
                  {/* Tiny item progress bar */}
                  <div style={{ height: 4, background: '#EEF0F3', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
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

        {checklistPercentage === 100 ? (
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
            background: '#F8F9FC', border: '1px solid #DEE1E7',
            color: '#717886', textAlign: 'center', fontSize: 11.5, fontWeight: 750
          }}>
            🔒 Complete all 4 conditions to unlock your allocation badge
          </div>
        )}
      </div>
    </div>
  )
}
