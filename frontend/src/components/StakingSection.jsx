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

export function StakingSection() {
  const { address, isConnected } = useAccount()
  const [hhPrice, setHhPrice] = useState(0.00025) // Fallback price
  const [priceChange, setPriceChange] = useState(8.4) // 24h price change mock %
  const [stakingAmount, setStakingAmount] = useState('')
  const [unstakeAmount, setUnstakeAmount] = useState('')
  const [stakeActionTab, setStakeActionTab] = useState('stake') // 'stake' or 'unstake'
  
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

  // Daily HP Earnings Calculations (10% of USD value for hold, 20% for stake, capped at $100 equivalent)
  const holdHpEarned = Math.min(10.0, walletUsdValue * 0.10)
  const stakeHpEarned = Math.min(20.0, stakedUsdValue * 0.20)
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
    <div style={{ padding: '0 16px 80px', maxWidth: 480, margin: '0 auto', animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* Header Info Block */}
      <div style={{
        background: 'linear-gradient(135deg, #0052FF 0%, #1D4ED8 100%)',
        borderRadius: 24,
        padding: '20px 24px',
        color: '#FFFFFF',
        boxShadow: '0 8px 32px rgba(0, 82, 255, 0.25)',
        marginBottom: 20,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background glow lines */}
        <div style={{
          position: 'absolute', top: '-50%', right: '-50%', width: '120%', height: '120%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 60%)',
          pointerEvents: 'none'
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>
              Active Price $HH
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 900, fontFamily: 'monospace' }}>
                ${formatNumber(hhPrice, 5)}
              </span>
              <span style={{
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#10B981',
                fontSize: 10,
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 20,
                border: '1.5px solid rgba(16, 185, 129, 0.3)'
              }}>
                ▲ +{priceChange}%
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, color: 'rgba(255,255,255,0.75)', marginBottom: 4 }}>
              Daily HP Yield
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#FCD34D' }}>
              +{formatNumber(totalDailyPassiveHp, 2)} HP
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        
        {/* Card 1: Holding Status */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #DEE1E7',
          borderRadius: 20,
          padding: 20,
          boxShadow: '0 4px 16px rgba(10,11,13,0.04)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0A0B0D', margin: 0 }}>💼 Wallet Hold Rewards</h3>
              <p style={{ fontSize: 11, color: '#717886', marginTop: 2, marginBottom: 0 }}>Earn passive HP simply by holding $HH</p>
            </div>
            <span style={{
              background: '#F0F5FF', color: '#0052FF', fontSize: 10, fontWeight: 900,
              padding: '2px 8px', borderRadius: 12
            }}>
              10% HP / Day
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#0A0B0D' }}>
                {formatNumber(walletBalance, 0)}
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#717886', marginLeft: 4 }}>$HH</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#32353D' }}>
              ${formatNumber(walletUsdValue, 2)} USD
            </span>
          </div>

          {/* Hold progress to cap */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 800, color: '#717886', marginBottom: 4 }}>
              <span>Hold Reward Cap Progress</span>
              <span>${formatNumber(walletUsdValue, 2)} / $100.00</span>
            </div>
            <div style={{ height: 6, background: '#EEF0F3', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${holdCapPercent}%`, background: '#3B82F6', borderRadius: 4 }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8F9FC', padding: '10px 14px', borderRadius: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#717886' }}>Daily HP Earnings:</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#059669' }}>
              +{formatNumber(holdHpEarned, 2)} HP/day
            </span>
          </div>
        </div>

        {/* Card 2: Hard Staking Status */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #DEE1E7',
          borderRadius: 20,
          padding: 20,
          boxShadow: '0 4px 16px rgba(10,11,13,0.04)',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute', top: -1, right: 24,
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            color: '#FFFFFF', fontSize: '8.5px', fontWeight: 900,
            padding: '4px 10px', borderRadius: '0 0 8px 8px',
            textTransform: 'uppercase', letterSpacing: 0.5,
            boxShadow: '0 2px 8px rgba(16,185,129,0.2)'
          }}>
            🔥 45.8% APR (Yield in $HH)
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0A0B0D', margin: 0 }}>🥩 Lock Staking Rewards</h3>
              <p style={{ fontSize: 11, color: '#717886', marginTop: 2, marginBottom: 0 }}>Lock tokens on contract for double HP yield</p>
            </div>
            <span style={{
              background: '#D1FAE5', color: '#059669', fontSize: 10, fontWeight: 900,
              padding: '2px 8px', borderRadius: 12, marginRight: 85
            }}>
              20% HP / Day
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <div>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#0A0B0D' }}>
                {formatNumber(stakedBalance, 0)}
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#717886', marginLeft: 4 }}>$HH</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: '#32353D' }}>
              ${formatNumber(stakedUsdValue, 2)} USD
            </span>
          </div>

          {/* Stake progress to cap */}
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 800, color: '#717886', marginBottom: 4 }}>
              <span>Stake Reward Cap Progress</span>
              <span>${formatNumber(stakedUsdValue, 2)} / $100.00</span>
            </div>
            <div style={{ height: 6, background: '#EEF0F3', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${stakeCapPercent}%`, background: '#10B981', borderRadius: 4 }} />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F8F9FC', padding: '10px 14px', borderRadius: 12 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#717886' }}>Daily HP Earnings:</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#059669' }}>
              +{formatNumber(stakeHpEarned, 2)} HP/day
            </span>
          </div>
        </div>

        {/* Interactive Staking Form */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #DEE1E7',
          borderRadius: 20,
          padding: 20,
          boxShadow: '0 4px 16px rgba(10,11,13,0.04)'
        }}>
          <div style={{ display: 'flex', background: '#F8F9FC', padding: 4, borderRadius: 12, marginBottom: 16 }}>
            <button
              onClick={() => setStakeActionTab('stake')}
              style={{
                flex: 1, padding: '8px 12px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800,
                background: stakeActionTab === 'stake' ? '#FFFFFF' : 'transparent',
                color: stakeActionTab === 'stake' ? '#0052FF' : '#717886',
                boxShadow: stakeActionTab === 'stake' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer'
              }}
            >
              Stake $HH
            </button>
            <button
              onClick={() => setStakeActionTab('unstake')}
              style={{
                flex: 1, padding: '8px 12px', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 800,
                background: stakeActionTab === 'unstake' ? '#FFFFFF' : 'transparent',
                color: stakeActionTab === 'unstake' ? '#0052FF' : '#717886',
                boxShadow: stakeActionTab === 'unstake' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                cursor: 'pointer'
              }}
            >
              Unstake $HH
            </button>
          </div>

          {stakeActionTab === 'stake' ? (
            <div>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <input
                  type="number"
                  value={stakingAmount}
                  onChange={(e) => setStakingAmount(e.target.value)}
                  placeholder="Enter amount to stake"
                  style={{
                    width: '100%', padding: '12px 75px 12px 14px', borderRadius: 12,
                    border: '1px solid #DEE1E7', fontSize: 14, fontWeight: 700, outline: 'none'
                  }}
                />
                <button
                  onClick={() => setStakingAmount(walletBalance.toString())}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: '#F0F5FF', border: 'none', color: '#0052FF', fontSize: 11, fontWeight: 900,
                    padding: '5px 10px', borderRadius: 8, cursor: 'pointer'
                  }}
                >
                  MAX
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#717886', marginBottom: 16 }}>
                <span>Available: {formatNumber(walletBalance, 0)} $HH</span>
                <span>Est: +{formatNumber(Math.min(20.0, (stakedUsdValue + (parseFloat(stakingAmount || 0) * hhPrice)) * 0.20), 1)} HP/day</span>
              </div>

              <button
                onClick={handleStake}
                disabled={!!txStep}
                style={{
                  width: '100%', padding: '14px', border: 'none', borderRadius: 14,
                  background: allowance < parseFloat(stakingAmount || 0) 
                    ? 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)'
                    : 'linear-gradient(135deg, #0052FF 0%, #0043D0 100%)',
                  color: '#FFFFFF', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,82,255,0.15)'
                }}
              >
                {allowance < parseFloat(stakingAmount || 0) ? 'Approve $HH (One-time)' : 'Stake $HH'}
              </button>
            </div>
          ) : (
            <div>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <input
                  type="number"
                  value={unstakeAmount}
                  onChange={(e) => setUnstakeAmount(e.target.value)}
                  placeholder="Enter amount to unstake"
                  style={{
                    width: '100%', padding: '12px 75px 12px 14px', borderRadius: 12,
                    border: '1px solid #DEE1E7', fontSize: 14, fontWeight: 700, outline: 'none'
                  }}
                />
                <button
                  onClick={() => setUnstakeAmount(stakedBalance.toString())}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: '#F0F5FF', border: 'none', color: '#0052FF', fontSize: 11, fontWeight: 900,
                    padding: '5px 10px', borderRadius: 8, cursor: 'pointer'
                  }}
                >
                  MAX
                </button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#717886', marginBottom: 16 }}>
                <span>Staked: {formatNumber(stakedBalance, 0)} $HH</span>
                <span style={{ color: '#FC401F', fontWeight: 700 }}>⚠️ 3d Unstaking Cooldown</span>
              </div>

              <button
                onClick={handleUnstake}
                disabled={!!txStep}
                style={{
                  width: '100%', padding: '14px', border: 'none', borderRadius: 14,
                  background: 'linear-gradient(135deg, #32353D 0%, #1A1C20 100%)',
                  color: '#FFFFFF', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
              >
                Unstake & Begin Cooldown
              </button>
            </div>
          )}

          {txError && (
            <div style={{ marginTop: 12, padding: 12, background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 10, color: '#DC2626', fontSize: 12, fontWeight: 750 }}>
              ⚠️ {txError}
            </div>
          )}
        </div>

        {/* Pending Withdrawals list (3-day cooldown tracker) */}
        {pendingWithdrawals.length > 0 && (
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #DEE1E7',
            borderRadius: 20,
            padding: 20,
            boxShadow: '0 4px 16px rgba(10,11,13,0.04)'
          }}>
            <h3 style={{ fontSize: 14, fontWeight: 800, color: '#0A0B0D', marginBottom: 12, margin: 0 }}>⏳ Pending Withdrawals</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
              {pendingWithdrawals.map((w) => {
                const isReady = Date.now() >= w.unlockTime
                const secondsLeft = Math.max(0, Math.floor((w.unlockTime - Date.now()) / 1000))
                const days = Math.floor(secondsLeft / (24 * 3600))
                const hours = Math.floor((secondsLeft % (24 * 3600)) / 3600)
                const minutes = Math.floor((secondsLeft % 3600) / 60)
                
                return (
                  <div key={w.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: '#F8F9FC', padding: 12, borderRadius: 12, border: '1px solid #EEF0F3'
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 850, color: '#0A0B0D' }}>
                        {formatNumber(w.amount, 0)} $HH
                      </div>
                      <div style={{ fontSize: 10, color: '#717886', marginTop: 2 }}>
                        {isReady ? 'Ready to claim!' : `Unlocks in: ${days}d ${hours}h ${minutes}m`}
                      </div>
                    </div>
                    <button
                      onClick={() => claimWithdrawal(w.id, w.amount)}
                      disabled={!isReady}
                      style={{
                        background: isReady ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : '#DEE1E7',
                        color: '#FFFFFF', border: 'none', borderRadius: 8, padding: '6px 12px',
                        fontSize: 11, fontWeight: 900, cursor: isReady ? 'pointer' : 'not-allowed',
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

        {/* Stakers Leaderboard */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #DEE1E7',
          borderRadius: 20,
          padding: 20,
          boxShadow: '0 4px 16px rgba(10,11,13,0.04)'
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#0A0B0D', marginBottom: 12, margin: 0 }}>🏆 Top Stakers Community</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {topStakers.map((staker) => (
              <div key={staker.rank} style={{
                display: 'flex', alignItems: 'center', justifyStyle: 'stretch',
                background: staker.isUser ? '#F0F5FF' : 'transparent',
                border: staker.isUser ? '1px solid rgba(0, 82, 255, 0.2)' : '1px solid transparent',
                padding: '8px 12px', borderRadius: 12,
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    width: 20, height: 20, background: staker.rank === 1 ? '#FCD34D' : staker.rank === 2 ? '#B1B7C3' : staker.rank === 3 ? '#F59E0B' : '#EEF0F3',
                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 900, color: staker.rank <= 3 ? '#FFFFFF' : '#717886'
                  }}>
                    {staker.rank}
                  </span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#0A0B0D' }}>
                      {staker.username}
                    </div>
                    <div style={{ fontSize: 9, color: '#717886' }}>{staker.address}</div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: '#0052FF' }}>
                    {formatNumber(staker.staked, 0)} $HH
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#059669' }}>
                    +{formatNumber(staker.hp, 1)} HP/day
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

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
