// src/components/RaffleSection.jsx
// ─────────────────────────────────────────────────────────
// USDC transfer via useWriteContract (wagmi v2)
// Per docs.base.org/get-started/build-app (Step 6)
// Builder Code added automatically via wagmi config dataSuffix
//
// Draw trigger: pg_cron (primary) fires every hour at :00.
// Browser fallback: only triggers if round is overdue by >5 min
// (safety net in case cron misses a cycle).
// ─────────────────────────────────────────────────────────

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useWaitForTransactionReceipt, useChainId, useSwitchChain, useReadContract } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { base } from 'wagmi/chains'
import { FOUNDATION, USDC_ADDRESS, USDC_ABI, HH_ADDRESS, HH_ABI, STAKING_ADDRESS, STAKING_ABI, BET_OPTS, TICKET_UNIT, CLOSE_BEFORE_MS, WINNER_SHARE, HH_RAFFLE_VAULT_ADDRESS, DAILY_ADDRESS, DAILY_ABI } from '../config/constants'
import { db } from '../config/supabase'
import { useRoundState } from '../hooks/useRoundState'
import { useBuilderWrite } from '../hooks/useBuilderWrite'
import { TxModal } from './TxModal'
import { RouletteModal } from './RouletteModal'
import { PBar } from './PBar'
import { UserAvatar } from './UserAvatar'

const short   = (a) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—'
const pColor  = (addr) => {
  const COLORS = ["#FF6B6B","#FFD93D","#6BCB77","#4D96FF","#C77DFF","#FF9F1C","#00B4D8","#F72585","#3A86FF","#8338EC","#FB5607","#FFBE0B","#06D6A0","#EF476F","#118AB2"]
  return COLORS[parseInt(addr?.slice(2, 4) || '0', 16) % COLORS.length]
}

const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
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

export function DailyRaffleSection({ address, basename, onRequireWallet }) {
  const raffleType = 'usdc' // 'hh' | 'usdc'
  const isHH = false
  const { round, participants, lastWinner, myTickets, myAmount, refetch } = useRoundState(address, raffleType.toUpperCase())
  const [msLeft,       setMsLeft]       = useState(0)
  const [txModal,      setTxModal]      = useState(null) // { amount }
  const [spinData, setSpinData] = useState(null)

  const [hhPrice, setHhPrice] = useState(0.00025)

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
        console.error('DexScreener API error in Raffle:', err)
      }
    }
    getPrice()
    const interval = setInterval(getPrice, 30000)
    return () => clearInterval(interval)
  }, [])

  // Read HH allowance
  const { data: hhAllowanceRaw } = useReadContract({
    address: HH_ADDRESS,
    abi: HH_ABI,
    functionName: 'allowance',
    args: address && HH_RAFFLE_VAULT_ADDRESS ? [address, HH_RAFFLE_VAULT_ADDRESS] : undefined,
    query: { enabled: !!address && raffleType === 'hh', refetchInterval: 10000 }
  })
  const hhAllowance = hhAllowanceRaw !== undefined ? parseFloat(formatUnits(hhAllowanceRaw, 18)) : 0

  // User balances for Win Chance Boost
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
    functionName: 'totalActiveStaked',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 }
  })

  const walletBalance = hhBalanceRaw !== undefined ? parseFloat(formatUnits(hhBalanceRaw, 18)) : 0
  const stakedBalance = stakedBalanceRaw !== undefined ? parseFloat(formatUnits(stakedBalanceRaw, 18)) : 0

  const isHolder = walletBalance >= 100_000_000
  const isStaker = stakedBalance >= 100_000_000
  const winChanceBoost = isStaker ? 5 : (isHolder ? 2 : 0)

  // HP Bonus for deposits
  const getDepositHpBonus = (usdAmount) => {
    if (usdAmount < 0.1) return 0
    if (usdAmount <= 10) return 1
    if (usdAmount <= 50) return 2
    if (usdAmount <= 100) return 3
    return 5
  }

  // Daily Raffle Hooks
  const { data: isDailyEligibleRaw } = useReadContract({
    address: DAILY_ADDRESS,
    abi: DAILY_ABI,
    functionName: 'isUserEligible',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 }
  })

  const { data: dailyUserTicketsRaw } = useReadContract({
    address: DAILY_ADDRESS,
    abi: DAILY_ABI,
    functionName: 'getUserTickets',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 }
  })

  const { data: dailyPoolRaw } = useReadContract({
    address: DAILY_ADDRESS,
    abi: DAILY_ABI,
    functionName: 'getPoolBalance',
    query: { enabled: !!address, refetchInterval: 15000 }
  })

  const { data: dailyTimeRemainingRaw } = useReadContract({
    address: DAILY_ADDRESS,
    abi: DAILY_ABI,
    functionName: 'getTimeRemaining',
    query: { enabled: !!address, refetchInterval: 15000 }
  })

  const { data: dailySponsorRaw } = useReadContract({
    address: DAILY_ADDRESS,
    abi: DAILY_ABI,
    functionName: 'sponsorName',
    query: { enabled: !!address }
  })

  const { data: dailyRoundRaw } = useReadContract({
    address: DAILY_ADDRESS,
    abi: DAILY_ABI,
    functionName: 'getCurrentRound',
    query: { enabled: !!address }
  })

  // Simulated fallback values for development/testing
  const [simulatedDailyEligible, setSimulatedDailyEligible] = useState(() => {
    try {
      return localStorage.getItem('hh_simulated_daily_eligible') === 'true'
    } catch { return false }
  })
  const [simulatedDailyTickets, setSimulatedDailyTickets] = useState(() => {
    try {
      return parseInt(localStorage.getItem('hh_simulated_daily_tickets') || '0')
    } catch { return 0 }
  })

  const isDailyEligible = isDailyEligibleRaw !== undefined ? isDailyEligibleRaw : simulatedDailyEligible
  const dailyUserTickets = dailyUserTicketsRaw !== undefined ? Number(dailyUserTicketsRaw) : simulatedDailyTickets
  const dailyPool = dailyPoolRaw !== undefined ? Number(formatUnits(dailyPoolRaw, 18)) : 10000000 // default 10M HH
  const dailyTimeRemaining = dailyTimeRemainingRaw !== undefined ? Number(dailyTimeRemainingRaw) : 0
  const dailySponsor = dailySponsorRaw || 'Happy Hour'
  const dailyRound = dailyRoundRaw !== undefined ? Number(dailyRoundRaw) : 1

  // ── Chain check ──────────────────────────────────────────
  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const wrongChain = chainId !== base.id

  // ── Builder write contract ───────────────────────────────
  const { data: txHash, writeContract, isPending, isConfirming, isSuccess, error: writeError, reset } = useBuilderWrite()

  const [lastProcessedTx, setLastProcessedTx] = useState(null)

  const fallbackRef = useRef(false)
  useEffect(() => {
    if (round?.status === 'open') fallbackRef.current = false
  }, [round?.id, round?.status])

  // Timer synced with Supabase round
  // Primary trigger: pg_cron (server-side, fires every hour at :00)
  // Fallback: browser triggers ONLY if round is overdue by >5 minutes
  useEffect(() => {
    const tick = () => {
      if (round?.ends_at) {
        const left = Math.max(0, new Date(round.ends_at).getTime() - Date.now())
        setMsLeft(left)

        const overdueMs = -( new Date(round.ends_at).getTime() - Date.now() )
        const FALLBACK_THRESHOLD_MS = 5 * 60 * 1000 // 5 minutes

        if (
          overdueMs > FALLBACK_THRESHOLD_MS &&
          round.status === 'open' &&
          !fallbackRef.current
        ) {
          // pg_cron missed - browser fallback
          console.warn('[raffle] pg_cron missed the round, browser fallback triggered')
          fallbackRef.current = true
          const functionName = isHH ? 'draw-round-hh' : 'draw-round-usdc'
          db.functions.invoke(functionName).catch(console.error)
        }
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [round?.ends_at, round?.status])

  // Roulette — triggers and FREEZES state when backend says spinning
  useEffect(() => {
    if (round?.status === 'spinning' && !spinData) {
      setSpinData({
        round: round,
        participants: participants,
        totalPot: participants.reduce((s, p) => s + p.amount, 0),
        winner: round.winner,
        prize: round.prize,
        myTickets: myTickets,
        myAmount: myAmount
      })
    }
  }, [round?.status])

  // After tx confirmed — close modal, refetch
  useEffect(() => {
    if (isSuccess && txHash && lastProcessedTx !== txHash) {
      setLastProcessedTx(txHash)
      if (raffleType === 'hh' && txModal) {
        const amountUsdc = txModal.amount
        const hhCost = amountUsdc / hhPrice
        
        if (hhAllowance < hhCost) {
          // This was approval tx. Just close modal and reset.
          setTxModal(null)
          reset()
          return
        }
      }
      
      setTxModal(null)
      reset()
      setTimeout(() => refetch(), 3000) // Alchemy webhook ~2-3s
    }
  }, [isSuccess, txHash, raffleType, txModal, hhPrice, hhAllowance, address, basename, round?.id])

  const displayRound = useMemo(() => {
    if (spinData) return spinData.round
    return round
  }, [round, spinData])

  const displayParticipants = useMemo(() => {
    if (spinData) return spinData.participants
    return participants
  }, [participants, spinData])

  const displayTotalPot = useMemo(() => {
    return displayParticipants.reduce((s, p) => s + p.amount, 0)
  }, [displayParticipants])

  const isClosed = msLeft <= CLOSE_BEFORE_MS || displayRound?.status === 'closed' || displayRound?.status === 'spinning'
  
  const displayMyEntry = useMemo(() => {
    return displayParticipants.find(p => p.address?.toLowerCase() === address?.toLowerCase())
  }, [displayParticipants, address])

  const displayMyChance = useMemo(() => {
    if (displayTotalPot <= 0 || !displayMyEntry) return '0.0'
    return (((displayMyEntry.amount || 0) / displayTotalPot) * 100).toFixed(1)
  }, [displayTotalPot, displayMyEntry])

  const displayMyTickets = useMemo(() => {
    if (spinData) return spinData.myTickets || 0
    return myTickets || 0
  }, [myTickets, spinData])

  const displayMyAmount = useMemo(() => {
    if (spinData) return spinData.myAmount || 0
    return myAmount || 0
  }, [myAmount, spinData])

  const triggerDailyDraw = () => {
    if (!address) {
      if (onRequireWallet) onRequireWallet()
      return
    }
    if (wrongChain) { switchChain({ chainId: base.id }); return }
    writeContract({
      address: DAILY_ADDRESS,
      abi: DAILY_ABI,
      functionName: 'requestDailyDraw',
      chainId: base.id
    })
  }

  const simulateDailyEligibility = () => {
    try {
      localStorage.setItem('hh_simulated_daily_eligible', 'true')
      localStorage.setItem('hh_simulated_daily_tickets', '10')
      setSimulatedDailyEligible(true)
      setSimulatedDailyTickets(10)
    } catch (e) { console.error(e) }
  }


  const accentColor = isHH ? '#3B82F6' : '#10B981'
  const cardBg = 'rgba(255, 255, 255, 0.03)'
  const cardBorder = '1px solid rgba(255, 255, 255, 0.08)'
  const cardRadius = 24

  // ── Send USDC or HH ────────────────────────────────────────
  const sendBet = useCallback((amount) => {
    if (isClosed || !address) return

    // Switch chain if needed
    if (wrongChain) { switchChain({ chainId: base.id }); return }

    if (raffleType === 'hh') {
      const hhCost = amount / hhPrice
      if (hhAllowance < hhCost) {
        // Trigger infinite approve
        writeContract({
          address: HH_ADDRESS,
          abi: HH_ABI,
          functionName: 'approve',
          args: [HH_RAFFLE_VAULT_ADDRESS, 115792089237316195423570985008687907853269984665640564039457584007913129639935n], // max uint256
          chainId: base.id,
        })
      } else {
        // Trigger deposit contract transaction
        writeContract({
          address: HH_RAFFLE_VAULT_ADDRESS,
          abi: [
            {
              name: 'depositHH',
              type: 'function',
              inputs: [{ name: '_amount', type: 'uint256' }],
              outputs: [],
              stateMutability: 'nonpayable',
            }
          ],
          functionName: 'depositHH',
          args: [parseUnits(hhCost.toFixed(18), 18)],
          chainId: base.id,
        })
      }
    } else {
      // useWriteContract sends the USDC tx
      writeContract({
        address:      USDC_ADDRESS,
        abi:          USDC_ABI,
        functionName: 'transfer',
        args:         [FOUNDATION, parseUnits(amount.toFixed(6), 6)],
        chainId:      base.id,
      })
    }
  }, [isClosed, address, wrongChain, writeContract, switchChain, raffleType, hhPrice, hhAllowance])

  const onBetClick = (amount) => {
    if (!address) {
      if (onRequireWallet) onRequireWallet()
      return
    }
    setTxModal({ amount })
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', width: '100%', maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 120, color: '#FFFFFF', fontFamily: "'Inter', sans-serif" }}>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        
        {/* Top Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Hero Banner */}
          <div style={{
            width: '100%',
            background: 'linear-gradient(135deg, rgba(16,18,27,1) 0%, rgba(20,22,35,1) 100%)',
            borderRadius: 24,
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.05)',
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: 320
          }}>
            {/* Glow Effects */}
            <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

            {/* Content Left */}
            <div className="raffle-hero-padding" style={{ flex: 1, padding: '32px 24px', position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="raffle-hero-badge" style={{
                  background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', padding: '4px 12px', borderRadius: 12, fontSize: 11, fontWeight: 700, border: '1px solid rgba(59, 130, 246, 0.3)'
                }}>Sponsored by {dailySponsor}</span>
                <span className="raffle-hero-badge" style={{
                  background: 'rgba(16, 185, 129, 0.1)', color: '#34D399', padding: '4px 12px', borderRadius: 12, fontSize: 11, fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.2)'
                }}>VRF PROVED</span>
              </div>
              <h1 className="raffle-hero-title" style={{ fontSize: 32, fontWeight: 600, color: '#FFFFFF', lineHeight: 1.2, margin: 0, fontFamily: "'Inter', sans-serif", letterSpacing: '-0.5px' }}>
                Daily Raffle · Round #{dailyRound}
              </h1>
              
              <div className="raffle-stat-gap" style={{ display: 'flex', gap: 32, marginTop: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {/* Prize Pool Plate */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: '16px 24px', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Estimated Prize</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img src="/logo.jfif" alt="" style={{ width: 36, height: 36, borderRadius: '50%', boxShadow: '0 0 12px rgba(255,255,255,0.1)' }} />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div className="raffle-stat-value" style={{ fontSize: 28, fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>
                        {formatConcise(dailyPool)} $HH
                      </div>
                      <div style={{ fontSize: 14, color: '#10B981', fontWeight: 600, marginTop: 4 }}>
                        ≈${(dailyPool * (hhPrice || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timer Plate */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 16, padding: '16px 24px', backdropFilter: 'blur(12px)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Time Left</div>
                  <div className="raffle-timer-value" style={{ fontSize: 36, fontWeight: 700, color: dailyTimeRemaining > 0 ? '#FFFFFF' : '#FC401F', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
                    {dailyTimeRemaining > 0 ? new Date(dailyTimeRemaining * 1000).toISOString().substr(11, 8) : '00:00:00'}
                  </div>
                </div>
              </div>
            </div>

            {/* Graphic Right */}
            <div className="desktop-only" style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: '50%', minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', zIndex: 1 }}>
              <img src="/staking_banner_graphic.png" alt="Raffle Graphic" style={{ height: '100%', width: '100%', objectFit: 'cover', maskImage: 'linear-gradient(to left, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)', WebkitMaskImage: 'linear-gradient(to left, rgba(0,0,0,1) 30%, rgba(0,0,0,0) 100%)' }} />
            </div>
          </div>

          {/* Eligibility Card */}
          <div style={{
            background: cardBg,
            border: isDailyEligible ? '1px solid rgba(16, 185, 129, 0.3)' : cardBorder,
            borderRadius: cardRadius,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isDailyEligible ? '🟢 Eligible for Draw' : '⚪ Not Eligible'}
                </div>
                <div style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.5, maxWidth: 280 }}>
                  {isDailyEligible 
                    ? "You are automatically entered into today's daily draw!" 
                    : "Buy at least 1 ticket in the hourly raffle today to qualify for the daily draw."
                  }
                </div>
              </div>
              
              {isDailyEligible && (
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: '#10B981' }}>
                    {dailyUserTickets} TICKET{dailyUserTickets > 1 ? 'S' : ''}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
                    Weighted chance
                  </div>
                </div>
              )}
            </div>

            {!isDailyEligible && (
              <button
                type="button"
                onClick={() => {}}
                style={{
                  width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: '#3B82F6', color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8
                }}
              >
                Buy Ticket in Hourly Raffle
              </button>
            )}

            {dailyTimeRemaining === 0 && (
              <button
                type="button"
                onClick={triggerDailyDraw}
                style={{
                  width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: '#3B82F6', color: '#FFFFFF', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 8
                }}
              >
                🎯 Trigger Daily Draw (VRF)
              </button>
            )}
            
            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <span 
                onClick={simulateDailyEligibility}
                style={{ fontSize: 11, fontWeight: 600, color: '#64748B', cursor: 'pointer', textDecoration: 'underline' }}
              >
                [Dev] Simulate eligibility (10 tickets)
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Last Winner */}
          {lastWinner && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC' }}>Last Winner</div>
              <div style={{
                background: cardBg,
                border: cardBorder,
                borderTop: `3px solid ${accentColor}`,
                borderRadius: cardRadius,
                padding: 20,
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 16
              }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>🏆</div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>{lastWinner.name}</div>
                  <div style={{ fontSize: 13, color: '#94A3B8' }}>
                    Win chance: <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{lastWinner.chance}%</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#10B981' }}>
                    +{isHH ? `${formatConcise(parseFloat(lastWinner.amount))} $HH` : `${lastWinner.amount} USDC`}
                  </div>
                  {isHH && (
                    <div style={{ fontSize: 12, color: '#34D399', fontWeight: 600 }}>
                      ≈${(parseFloat(lastWinner.amount) * (hhPrice || 0)).toFixed(2)}
                    </div>
                  )}
                  <div style={{ fontSize: 12, color: '#64748B' }}>
                    of {isHH ? `${formatConcise(parseFloat(lastWinner.pot))} $HH` : `${lastWinner.pot} USDC`}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* How it works */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC' }}>How it works</div>
            <div style={{ background: cardBg, border: cardBorder, borderRadius: cardRadius, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                ['How long does each round last?',   'Each round runs exactly 60 minutes.'],
                ['When do deposits close?',           'Deposits close 3 minutes before the draw.'],
                ['How is the winner selected?',       'Secure random selection, lucky-based. Anyone with 1+ ticket can win. More tickets = more chances.'],
                ['How many points do I get?', (
                  <>Raffle winner receives <strong style={{ color: '#10B981' }}>1 HP</strong></>
                )],
                ['What happens if I’m the only player in a round?', (
                  <>You will receive a 100% refund and <strong style={{ color: '#10B981' }}>1 HP</strong> as the winner.</>
                )],
                ['How much does the winner receive?', isHH ? `Winner takes 85% of the total pot. The remaining 15% is burned.` : `Winner takes 85% of the total pot. The remaining 15% goes to the foundation for future rewards.`],
                ['When are winnings paid?',           'Automatically after the draw, directly to the winner\'s wallet.'],
                ['Can I deposit multiple times?',     'Yes! Multiple deposits per round are allowed and all contribute to your ticket count.'],
              ].map(([q, a], i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF' }}>{q}</div>
                  <div style={{ fontSize: 13, color: '#94A3B8', lineHeight: 1.5 }}>{a}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* TxModal */}
      {txModal && (
        <TxModal
          title={isHH ? (hhAllowance < txModal.amount / hhPrice ? "Approve $HH" : "Place Raffle Bet") : "Place Raffle Bet"}
          subtitle={
            isHH
              ? (hhAllowance < txModal.amount / hhPrice 
                  ? "Approve unlimited $HH spending to buy tickets" 
                  : `+${Math.round(txModal.amount / TICKET_UNIT)} ${Math.round(txModal.amount / TICKET_UNIT) === 1 ? 'ticket' : 'tickets'} · +${getDepositHpBonus(parseFloat(txModal.amount))} HP Bonus`
                )
              : `+${Math.round(txModal.amount / TICKET_UNIT)} ${Math.round(txModal.amount / TICKET_UNIT) === 1 ? 'ticket' : 'tickets'} · +${getDepositHpBonus(parseFloat(txModal.amount))} HP Bonus`
          }
          amount={isHH ? (hhAllowance < txModal.amount / hhPrice ? "0.00" : Math.round(txModal.amount / hhPrice).toString()) : txModal.amount.toString()}
          currency={isHH ? (hhAllowance < txModal.amount / hhPrice ? "Approve" : "$HH") : "USDC"}
          isPending={isPending}
          isConfirming={isConfirming}
          isSuccess={isSuccess}
          error={writeError}
          onConfirm={() => sendBet(txModal.amount)}
          onCancel={() => { setTxModal(null); reset() }}
        />
      )}

      {spinData && spinData.participants.length >= 1 && (
        <RouletteModal
          participants={spinData.participants}
          totalPot={spinData.totalPot}
          winner={spinData.winner}
          prize={spinData.prize}
          currency={isHH ? 'HH' : 'USDC'}
          onComplete={() => { setSpinData(null); refetch() }}
        />
      )}
    </div>
  )
}
