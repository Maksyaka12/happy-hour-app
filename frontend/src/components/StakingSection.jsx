import { useState, useEffect } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { HH_ADDRESS, STAKING_ADDRESS, HH_ABI, STAKING_ABI } from '../config/constants'

// Format helper
const formatNumber = (num, decimals = 2) => {
  return parseFloat(num || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

const formatConcise = (num) => {
  const n = parseFloat(num || 0)
  if (n >= 1e9) {
    const val = (n / 1e9).toFixed(2)
    return val.endsWith('.00') ? val.slice(0, -3) + 'b' : val.endsWith('0') ? val.slice(0, -1) + 'b' : val + 'b'
  }
  if (n >= 1e6) {
    const val = (n / 1e6).toFixed(2)
    return val.endsWith('.00') ? val.slice(0, -3) + 'm' : val.endsWith('0') ? val.slice(0, -1) + 'm' : val + 'm'
  }
  if (n >= 1e3) {
    const val = (n / 1e3).toFixed(2)
    return val.endsWith('.00') ? val.slice(0, -3) + 'k' : val.endsWith('0') ? val.slice(0, -1) + 'k' : val + 'k'
  }
  return n.toFixed(2).replace(/\.00$/, '')
}

export function StakingSection({ setTab }) {
  const { address, isConnected } = useAccount()
  const [hhPrice, setHhPrice] = useState(0.00025) // Fallback price
  const [priceChange, setPriceChange] = useState(8.4) // 24h price change mock %
  const [stakingAmount, setStakingAmount] = useState('')
  const [unstakeAmount, setUnstakeAmount] = useState('')
  const [stakeActionTab, setStakeActionTab] = useState('stake') // 'stake' or 'unstake'
  const [lockPeriod, setLockPeriod] = useState('7') // '7' or '14'
  const [stakedPeriod, setStakedPeriod] = useState(() => {
    try {
      return localStorage.getItem('hh_simulated_staked_period') || '7'
    } catch {
      return '7'
    }
  })

  useEffect(() => {
    localStorage.setItem('hh_simulated_staked_period', stakedPeriod)
  }, [stakedPeriod])
  
  // Custom Transaction UX Simulation States
  const [txStep, setTxStep] = useState(null) // 'approve_signing', 'approve_pending', 'action_signing', 'action_pending', 'success'
  const [txError, setTxError] = useState('')
  const [simulatedAllowance, setSimulatedAllowance] = useState(() => {
    try {
      return parseFloat(localStorage.getItem('hh_simulated_allowance') || '0')
    } catch {
      return 0
    }
  })
  const [simulatedStakedBalance, setSimulatedStakedBalance] = useState(() => {
    try {
      return parseFloat(localStorage.getItem('hh_simulated_staked') || '0')
    } catch {
      return 0
    }
  })
  const [simulatedWalletBalance, setSimulatedWalletBalance] = useState(() => {
    try {
      return parseFloat(localStorage.getItem('hh_simulated_wallet') || '250000') // default mock balance for testing
    } catch {
      return 250000
    }
  })

  // Simulated Pending Withdrawals (3-day cooldown)
  const [pendingWithdrawals, setPendingWithdrawals] = useState(() => {
    try {
      const saved = localStorage.getItem('hh_pending_withdrawals')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Sync simulated states to localStorage
  useEffect(() => {
    localStorage.setItem('hh_simulated_allowance', simulatedAllowance.toString())
  }, [simulatedAllowance])

  useEffect(() => {
    localStorage.setItem('hh_simulated_staked', simulatedStakedBalance.toString())
  }, [simulatedStakedBalance])

  useEffect(() => {
    localStorage.setItem('hh_simulated_wallet', simulatedWalletBalance.toString())
  }, [simulatedWalletBalance])

  useEffect(() => {
    localStorage.setItem('hh_pending_withdrawals', JSON.stringify(pendingWithdrawals))
  }, [pendingWithdrawals])

  // Fetch real $HH price from DexScreener
  useEffect(() => {
    const getPrice = async () => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${HH_ADDRESS}`)
        const data = await res.json()
        const pair = data.pairs?.[0]
        if (pair) {
          setHhPrice(parseFloat(pair.priceUsd) || 0.00025)
          setPriceChange(parseFloat(pair.priceChange?.h24) || 8.4)
        }
      } catch (err) {
        console.error('DexScreener API error, using fallback:', err)
      }
    }
    getPrice()
    const interval = setInterval(getPrice, 30000)
    return () => clearInterval(interval)
  }, [])

  // Real Web3 Contract reads (using WAGMI)
  const { data: hhBalanceRaw } = useReadContract({
    address: HH_ADDRESS,
    abi: HH_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 }
  })

  const { data: stakedBalanceRaw } = useReadContract({
    address: STAKING_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'stakedBalances',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 }
  })

  const { data: allowanceRaw } = useReadContract({
    address: HH_ADDRESS,
    abi: HH_ABI,
    functionName: 'allowance',
    args: address && STAKING_ADDRESS ? [address, STAKING_ADDRESS] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 }
  })

  // Format balances
  const walletBalance = hhBalanceRaw !== undefined
    ? parseFloat(formatUnits(hhBalanceRaw, 18))
    : simulatedWalletBalance

  const stakedBalance = stakedBalanceRaw !== undefined
    ? parseFloat(formatUnits(stakedBalanceRaw, 18))
    : simulatedStakedBalance

  const allowance = allowanceRaw !== undefined
    ? parseFloat(formatUnits(allowanceRaw, 18))
    : simulatedAllowance

  // USD Calculations
  const walletUsdValue = walletBalance * hhPrice
  const stakedUsdValue = stakedBalance * hhPrice

  // Daily HP Earnings Calculations (10% of USD value for hold, 20% for stake, locked periods scale yields)
  const holdHpEarned = Math.min(10.0, walletUsdValue * 0.10)
  const stakeHpEarned = Math.min(20.0, stakedUsdValue * (stakedPeriod === '14' ? 0.30 : 0.15))
  const totalDailyPassiveHp = holdHpEarned + stakeHpEarned

  // Progress to caps ($100 USD holds/stakes)
  const holdCapPercent = Math.min(100, (walletUsdValue / 100) * 100)
  const stakeCapPercent = Math.min(100, (stakedUsdValue / 100) * 100)

  // Infinite Approval UX flow
  const handleApprove = async () => {
    setTxError('')
    setTxStep('approve_signing')
    
    setTimeout(() => {
      setTxStep('approve_pending')
      setTimeout(() => {
        setSimulatedAllowance(999999999)
        setTxStep('action_signing')
        setTxStep(null)
      }, 2000)
    }, 1500)
  }

  // Handle Stake Action
  const handleStake = async () => {
    const amount = parseFloat(stakingAmount)
    if (isNaN(amount) || amount <= 0) {
      setTxError('Please enter a valid amount to stake.')
      return
    }
    if (amount > walletBalance) {
      setTxError('Insufficient $HH balance in your wallet.')
      return
    }

    setTxError('')
    
    // Check if allowance is sufficient
    if (allowance < amount) {
      await handleApprove()
      return
    }

    setTxStep('action_signing')
    
    setTimeout(() => {
      setTxStep('action_pending')
      setTimeout(() => {
        setSimulatedStakedBalance(prev => prev + amount)
        setSimulatedWalletBalance(prev => prev - amount)
        setStakedPeriod(lockPeriod)
        setStakingAmount('')
        setTxStep('success')
      }, 2000)
    }, 1500)
  }

  // Handle Unstake Action
  const handleUnstake = async () => {
    const amount = parseFloat(unstakeAmount)
    if (isNaN(amount) || amount <= 0) {
      setTxError('Please enter a valid amount to unstake.')
      return
    }
    if (amount > stakedBalance) {
      setTxError('You cannot unstake more than your staked balance.')
      return
    }

    setTxError('')
    setTxStep('action_signing')

    setTimeout(() => {
      setTxStep('action_pending')
      setTimeout(() => {
        const unlockTime = Date.now() + 3 * 24 * 60 * 60 * 1000 // 3 days from now
        const newWithdrawal = {
          id: Math.random().toString(36).substring(2, 9),
          amount: amount,
          unlockTime: unlockTime
        }
        
        setSimulatedStakedBalance(prev => prev - amount)
        setPendingWithdrawals(prev => [...prev, newWithdrawal])
        setUnstakeAmount('')
        setTxStep('success')
      }, 2000)
    }, 1500)
  }

  // Complete a pending withdrawal (after 3 days cooldown)
  const claimWithdrawal = (id, amount) => {
    setSimulatedWalletBalance(prev => prev + amount)
    setPendingWithdrawals(prev => prev.filter(w => w.id !== id))
  }

  // Mock Leaderboard for Top Stakers
  const topStakers = [
    { rank: 1, address: '0x32A4…F98c', username: 'BaseWhale.base', staked: 1250000, hp: 20.00 },
    { rank: 2, address: '0x8bF1…91Cd', username: '0xDegen.base', staked: 645000, hp: 16.12 },
    { rank: 3, address: '0x1C2D…E4f0', username: 'StakingKing', staked: 400000, hp: 10.00 },
    { rank: 4, address: '0x7e86…A56d', username: 'Maksyaka.base', staked: 120000, hp: 3.00 },
    { rank: 5, address: address ? `${address.slice(0, 6)}…${address.slice(-4)}` : 'You', username: 'Your Account', staked: stakedBalance, hp: stakeHpEarned, isUser: true }
  ].sort((a, b) => b.staked - a.staked).map((s, idx) => ({ ...s, rank: idx + 1 }))

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      
      {/* Card 1: Holding Rewards (Premium Light Grey Theme with Brand Glow) */}
      <div style={{
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.6)',
        borderRadius: 20,
        padding: '16px 18px',
        boxShadow: '0 8px 32px rgba(10, 10, 15, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* 1. Brand background image underneath */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/banner.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'hue-rotate(50deg) brightness(0.65) contrast(1.15)', // signature purple brand background
          zIndex: 0,
          pointerEvents: 'none'
        }} />

        {/* 2. Light grey semi-transparent overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(145deg, rgba(165, 170, 185, 0.85) 0%, rgba(135, 140, 155, 0.82) 50%, rgba(110, 115, 130, 0.88) 100%)',
          zIndex: 1,
          pointerEvents: 'none'
        }} />

        {/* Shimmer glow */}
        <div style={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, transparent 70%)',
          zIndex: 1,
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13.5, fontWeight: 900, color: '#0F172A', letterSpacing: '0.2px' }}>
            Holding Rewards
          </span>
          <span style={{
            background: 'rgba(15, 23, 42, 0.06)',
            color: '#475569',
            padding: '3px 8px',
            borderRadius: 8,
            fontSize: 10,
            fontWeight: 800,
            border: '1px solid rgba(15, 23, 42, 0.08)'
          }}>
            Passive
          </span>
        </div>

        {/* Two Plates Layout (Mockup-inspired side-by-side design) */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 12,
          marginTop: 2
        }}>
          {/* Left Plate: Holder Balance */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.5px', textAlign: 'center' }}>
              Holder Balance
            </span>
            <div style={{
              background: 'rgba(255, 255, 255, 0.6)',
              border: '1px solid rgba(15, 23, 42, 0.08)',
              borderRadius: 14,
              height: 48,
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)'
            }}>
              <img src="/logo.jfif" alt="$HH" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {walletBalance === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: '#0F172A', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                      0
                    </span>
                    {setTab && (
                      <button
                        onClick={() => setTab('home')}
                        style={{
                          background: 'linear-gradient(135deg, #A78BFA 0%, #7C3AED 100%)',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: 6,
                          padding: '2px 6px',
                          fontSize: 8,
                          fontWeight: 900,
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px',
                          boxShadow: '0 2px 4px rgba(124,58,237,0.3)',
                          outline: 'none'
                        }}
                      >
                        Buy $HH
                      </button>
                    )}
                  </div>
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 900, color: '#0F172A', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                    {formatNumber(walletBalance, 0)}
                  </span>
                )}
                <span style={{ fontSize: 9, color: 'rgba(15, 23, 42, 0.6)', fontWeight: 600 }}>
                  ≈${formatNumber(walletUsdValue, 2)}
                </span>
              </div>
            </div>
          </div>

          {/* Right Plate: Holder HP Earnings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#475569', letterSpacing: '0.5px', textAlign: 'center' }}>
              Holder HP Earnings
            </span>
            <div style={{
              background: 'rgba(16, 185, 129, 0.06)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 14,
              height: 48,
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: 'inset 0 1px 0 rgba(16, 185, 129, 0.05)'
            }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#065F46', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                  +{formatNumber(holdHpEarned, 2)} HP
                </span>
                <span style={{ fontSize: 9, color: 'rgba(6, 95, 70, 0.7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2px' }}>
                  per day
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Card 2: Staking Rewards (Premium Slate/Graphite Dark Grey Theme) */}
      <div style={{
        background: 'linear-gradient(145deg, rgba(20, 20, 25, 0.95) 0%, rgba(38, 39, 48, 0.90) 50%, rgba(12, 12, 16, 0.98) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 20,
        padding: 16,
        boxShadow: '0 8px 32px rgba(10, 10, 15, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Grayscaled background image overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/banner.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'grayscale(100%) brightness(0.28) contrast(1.1)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />

        {/* Shimmer glow */}
        <div style={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 255, 255, 0.06) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 900, color: '#FFFFFF', letterSpacing: '0.2px' }}>Staking Rewards</div>
          </div>
          <span style={{
            background: 'rgba(255,255,255,0.08)',
            color: '#A0AEC0',
            padding: '3px 8px',
            borderRadius: 8,
            fontSize: 10,
            fontWeight: 800,
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            Active Pool
          </span>
        </div>

        {/* Three Plates Layout (Staked, Period, HP Earnings) */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          display: 'grid',
          gridTemplateColumns: '1.1fr 0.9fr 1fr',
          gap: 8,
          marginTop: 2,
          marginBottom: 12
        }}>
          {/* Column 1: Staked */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#A0AEC0', letterSpacing: '0.3px', textAlign: 'center' }}>
              Staked
            </span>
            <div style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 14,
              height: 48,
              padding: '0 8px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
            }}>
              <img src="/logo.jfif" alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 11.5, fontWeight: 900, color: '#FFFFFF', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                  {formatConcise(stakedBalance)}
                </span>
                <span style={{ fontSize: 8.5, color: 'rgba(255, 255, 255, 0.45)', fontWeight: 600 }}>
                  ≈${formatConcise(stakedUsdValue)}
                </span>
              </div>
            </div>
          </div>

          {/* Column 2: Period */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#A0AEC0', letterSpacing: '0.3px', textAlign: 'center' }}>
              Period
            </span>
            <div style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 14,
              height: 48,
              padding: '0 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
            }}>
              <span style={{ fontSize: 11.5, fontWeight: 900, color: '#FFFFFF', textAlign: 'center' }}>
                {stakedBalance > 0 ? `${stakedPeriod}d lock` : '—'}
              </span>
            </div>
          </div>

          {/* Column 3: HP Earnings */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#A0AEC0', letterSpacing: '0.3px', textAlign: 'center' }}>
              HP Earnings
            </span>
            <div style={{
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: 14,
              height: 48,
              padding: '0 6px',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              boxShadow: 'inset 0 1px 0 rgba(16, 185, 129, 0.05)'
            }}>
              <span style={{ fontSize: 13 }}>⚡</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 11.5, fontWeight: 900, color: '#10B981', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                  +{formatNumber(stakeHpEarned, 2)} HP
                </span>
                <span style={{ fontSize: 8.5, color: 'rgba(16, 185, 129, 0.7)', fontWeight: 700, textTransform: 'uppercase' }}>
                  per day
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tab switcher inside */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          background: 'rgba(255,255,255,0.06)',
          padding: 3,
          borderRadius: 10,
          marginBottom: 12,
          border: '1px solid rgba(255,255,255,0.08)'
        }}>
          <button
            onClick={() => setStakeActionTab('stake')}
            style={{
              flex: 1, padding: '6px 10px', border: 'none', borderRadius: 7, fontSize: 11.5, fontWeight: 800,
              background: stakeActionTab === 'stake' ? '#FFFFFF' : 'transparent',
              color: stakeActionTab === 'stake' ? '#090514' : 'rgba(255,255,255,0.5)',
              boxShadow: stakeActionTab === 'stake' ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            Stake
          </button>
          <button
            onClick={() => setStakeActionTab('unstake')}
            style={{
              flex: 1, padding: '6px 10px', border: 'none', borderRadius: 7, fontSize: 11.5, fontWeight: 800,
              background: stakeActionTab === 'unstake' ? '#FFFFFF' : 'transparent',
              color: stakeActionTab === 'unstake' ? '#090514' : 'rgba(255,255,255,0.5)',
              boxShadow: stakeActionTab === 'unstake' ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            Unstake
          </button>
        </div>

        {stakeActionTab === 'stake' ? (
          <div style={{ position: 'relative', zIndex: 2 }}>
            {/* Lock Period Selector */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
              <button
                onClick={() => setLockPeriod('7')}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: lockPeriod === '7' ? '1.5px solid #A78BFA' : '1px solid rgba(255,255,255,0.15)',
                  background: lockPeriod === '7' ? 'rgba(167, 139, 250, 0.15)' : 'rgba(255,255,255,0.03)',
                  color: lockPeriod === '7' ? '#FFFFFF' : 'rgba(255,255,255,0.6)',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.15s'
                }}
              >
                7 Days (20% APR)
              </button>
              <button
                onClick={() => setLockPeriod('14')}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: lockPeriod === '14' ? '1.5px solid #A78BFA' : '1px solid rgba(255,255,255,0.15)',
                  background: lockPeriod === '14' ? 'rgba(167, 139, 250, 0.15)' : 'rgba(255,255,255,0.03)',
                  color: lockPeriod === '14' ? '#FFFFFF' : 'rgba(255,255,255,0.6)',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.15s'
                }}
              >
                14 Days (45% APR)
              </button>
            </div>

            <div style={{ position: 'relative', marginBottom: 10 }}>
              <input
                type="number"
                value={stakingAmount}
                onChange={(e) => setStakingAmount(e.target.value)}
                placeholder="Amount to stake"
                style={{
                  width: '100%', padding: '10px 115px 10px 12px', borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.25)',
                  color: '#FFFFFF', fontSize: 13, fontWeight: 700, outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                display: 'flex', gap: 4, alignItems: 'center'
              }}>
                <button
                  onClick={() => setStakingAmount((walletBalance * 0.25).toFixed(0))}
                  style={{
                    background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: 900,
                    padding: '3px 5px', borderRadius: 5, cursor: 'pointer', outline: 'none'
                  }}
                >
                  25%
                </button>
                <button
                  onClick={() => setStakingAmount((walletBalance * 0.5).toFixed(0))}
                  style={{
                    background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: 900,
                    padding: '3px 5px', borderRadius: 5, cursor: 'pointer', outline: 'none'
                  }}
                >
                  50%
                </button>
                <button
                  onClick={() => setStakingAmount(walletBalance.toString())}
                  style={{
                    background: 'rgba(255,255,255,0.15)', border: 'none', color: '#A78BFA', fontSize: 9, fontWeight: 900,
                    padding: '3px 6px', borderRadius: 5, cursor: 'pointer', outline: 'none'
                  }}
                >
                  MAX
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
              <span>Available: {formatConcise(walletBalance)} $HH</span>
              <span>Est: +{formatNumber(Math.min(20.0, (stakedUsdValue + (parseFloat(stakingAmount || 0) * hhPrice)) * (lockPeriod === '14' ? 0.30 : 0.15)), 1)} HP/day</span>
            </div>

            <button
              onClick={handleStake}
              disabled={!!txStep}
              style={{
                width: '100%', padding: '11px', border: 'none', borderRadius: 100,
                background: allowance < parseFloat(stakingAmount || 0) 
                  ? 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)'
                  : 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                color: '#FFFFFF', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(139, 92, 246, 0.25)'
              }}
            >
              {allowance < parseFloat(stakingAmount || 0) ? 'Approve $HH' : 'Stake'}
            </button>
          </div>
        ) : (
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ position: 'relative', marginBottom: 10 }}>
              <input
                type="number"
                value={unstakeAmount}
                onChange={(e) => setUnstakeAmount(e.target.value)}
                placeholder="Amount to unstake"
                style={{
                  width: '100%', padding: '10px 115px 10px 12px', borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.25)',
                  color: '#FFFFFF', fontSize: 13, fontWeight: 700, outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
              <div style={{
                position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                display: 'flex', gap: 4, alignItems: 'center'
              }}>
                <button
                  onClick={() => setUnstakeAmount((stakedBalance * 0.25).toFixed(0))}
                  style={{
                    background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: 900,
                    padding: '3px 5px', borderRadius: 5, cursor: 'pointer', outline: 'none'
                  }}
                >
                  25%
                </button>
                <button
                  onClick={() => setUnstakeAmount((stakedBalance * 0.5).toFixed(0))}
                  style={{
                    background: 'rgba(255,255,255,0.08)', border: 'none', color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: 900,
                    padding: '3px 5px', borderRadius: 5, cursor: 'pointer', outline: 'none'
                  }}
                >
                  50%
                </button>
                <button
                  onClick={() => setUnstakeAmount(stakedBalance.toString())}
                  style={{
                    background: 'rgba(255,255,255,0.15)', border: 'none', color: '#A78BFA', fontSize: 9, fontWeight: 900,
                    padding: '3px 6px', borderRadius: 5, cursor: 'pointer', outline: 'none'
                  }}
                >
                  MAX
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
              <span>Staked: {formatConcise(stakedBalance)} $HH</span>
              <span style={{ color: '#EF4444', fontWeight: 700 }}>3d Cooldown</span>
            </div>

            <button
              onClick={handleUnstake}
              disabled={!!txStep}
              style={{
                width: '100%', padding: '11px', border: 'none', borderRadius: 100,
                background: 'rgba(255,255,255,0.15)',
                color: '#FFFFFF', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
            >
              Unstake
            </button>
          </div>
        )}

        {txError && (
          <div style={{ position: 'relative', zIndex: 2, marginTop: 10, padding: 10, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 8, color: '#EF4444', fontSize: 11, fontWeight: 750 }}>
            ⚠️ {txError}
          </div>
        )}
      </div>

      {/* Pending Withdrawals list (3-day cooldown tracker) */}
      {pendingWithdrawals.length > 0 && (
        <div style={{
          background: 'linear-gradient(145deg, rgba(20, 20, 25, 0.95) 0%, rgba(38, 39, 48, 0.90) 50%, rgba(12, 12, 16, 0.98) 100%)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 20,
          padding: 16,
          boxShadow: '0 8px 32px rgba(10, 10, 15, 0.4)'
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 900, color: '#FFFFFF', marginBottom: 10, margin: 0, letterSpacing: '0.2px' }}>Pending Withdrawals</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            {pendingWithdrawals.map((w) => {
              const isReady = Date.now() >= w.unlockTime
              const secondsLeft = Math.max(0, Math.floor((w.unlockTime - Date.now()) / 1000))
              const days = Math.floor(secondsLeft / (24 * 3600))
              const hours = Math.floor((secondsLeft % (24 * 3600)) / 3600)
              const minutes = Math.floor((secondsLeft % 3600) / 60)
              
              return (
                <div key={w.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: 'rgba(255,255,255,0.04)', padding: 10, borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)'
                }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 850, color: '#FFFFFF' }}>
                      {formatConcise(w.amount)} $HH
                    </div>
                    <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                      {isReady ? 'Ready to claim!' : `Unlocks in: ${days}d ${hours}h ${minutes}m`}
                    </div>
                  </div>
                  <button
                    onClick={() => claimWithdrawal(w.id, w.amount)}
                    disabled={!isReady}
                    style={{
                      background: isReady ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : 'rgba(255,255,255,0.1)',
                      color: isReady ? '#FFFFFF' : 'rgba(255,255,255,0.4)', border: 'none', borderRadius: 8, padding: '5px 10px',
                      fontSize: 10.5, fontWeight: 900, cursor: isReady ? 'pointer' : 'not-allowed',
                      boxShadow: isReady ? '0 2px 6px rgba(16,185,129,0.15)' : 'none'
                    }}
                  >
                    Claim
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Custom Simulated Transaction Modal Overlay */}
      {txStep && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10,11,13,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 24, padding: 28, maxWidth: 360, width: '100%',
            boxShadow: '0 12px 48px rgba(0,0,0,0.15)', textAlign: 'center',
            animation: 'bounceIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>
            {/* Spinning Loader / Icons */}
            <div style={{ marginBottom: 20 }}>
              {txStep === 'success' ? (
                <span style={{ fontSize: 54 }}>🎉</span>
              ) : (
                <div style={{
                  width: 50, height: 50, border: '4px solid #F0F5FF', borderTopColor: '#0052FF',
                  borderRadius: '50%', margin: '0 auto', animation: 'spin 1s linear infinite'
                }} />
              )}
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0A0B0D', marginBottom: 8 }}>
              {txStep === 'approve_signing' && 'Confirming Allowance'}
              {txStep === 'approve_pending' && 'Approving $HH Token'}
              {txStep === 'action_signing' && 'Signing Contract Call'}
              {txStep === 'action_pending' && 'Executing Staking transaction'}
              {txStep === 'success' && 'Transaction Confirmed!'}
            </h3>

            <p style={{ fontSize: 12.5, color: '#717886', lineHeight: 1.5, marginBottom: 20 }}>
              {txStep === 'approve_signing' && 'Please sign the one-time approval in your wallet to enable staking.'}
              {txStep === 'approve_pending' && 'Approving spending limit on Base Network...'}
              {txStep === 'action_signing' && 'Please confirm the transaction to lock your $HH tokens in the staking pool.'}
              {txStep === 'action_pending' && 'Processing transaction on Base blockchain...'}
              {txStep === 'success' && 'Your transaction has been processed. Your balances and daily HP stats have updated successfully.'}
            </p>

            {txStep === 'success' && (
              <button
                onClick={() => setTxStep(null)}
                style={{
                  background: 'linear-gradient(135deg, #0052FF 0%, #0043D0 100%)',
                  color: '#FFFFFF', border: 'none', borderRadius: 12, padding: '10px 24px',
                  fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  width: '100%'
                }}
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
