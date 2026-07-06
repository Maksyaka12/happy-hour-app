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
  const lightAccentColor = isHH ? '#60A5FA' : '#34D399'
  const timerColor = isClosed ? '#FC401F' : '#FFFFFF'
  const gradientColor = isHH 
    ? 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)' 
    : 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
  const glowColor = isHH ? 'rgba(59, 130, 246, 0.25)' : 'rgba(16, 185, 129, 0.25)'
  const hueFilter = isHH
    ? 'hue-rotate(0deg) brightness(0.4) contrast(1.15)' 
    : 'hue-rotate(200deg) brightness(0.4) contrast(1.15)'

  const heroHueFilter = isHH
    ? 'hue-rotate(0deg) brightness(0.68) contrast(1.1)' 
    : 'hue-rotate(200deg) brightness(0.68) contrast(1.1)'

  const cardBg = 'rgba(23, 25, 35, 0.65)'
  const heroCardBg = 'rgba(23, 25, 35, 0.65)'
  const cardBorder = '1px solid rgba(255, 255, 255, 0.05)'
  const cardShadow = 'none'

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
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 12px 120px', animation: 'fadeIn 0.3s ease-out' }}>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'fadeIn 0.3s ease-out' }}>
          {/* Daily Raffle Hero Card */}
          <div style={{
            background: heroCardBg,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: cardBorder,
            borderRadius: 20,
            padding: '20px 18px 16px',
            marginBottom: 12,
            boxShadow: cardShadow,
            position: 'relative',
            overflow: 'hidden'
          }}>

            {/* Colored radial gradient glow removed as per strict specs */}

            <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontSize: 14.5, fontWeight: 900, color: '#FFFFFF', letterSpacing: '0.2px', textTransform: 'uppercase', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                Daily Raffle · Round #{dailyRound}
              </div>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34D399',
                padding: '3px 8px',
                borderRadius: 8,
                fontSize: 10,
                fontWeight: 800,
                border: '1px solid rgba(16, 185, 129, 0.25)',
                fontFamily: "'Outfit', 'Inter', sans-serif"
              }}>
                VRF PROVED
              </span>
            </div>

            {/* Two Plates Layout */}
            <div style={{
              position: 'relative',
              zIndex: 2,
              display: 'grid',
              gridTemplateColumns: '1.2fr 0.8fr',
              gap: 12,
              marginBottom: 16
            }}>
              {/* Left Plate: Prize Pool */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#A0AEC0', letterSpacing: '0.5px', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                  ESTIMATED PRIZE
                </span>
                <div style={{
                  background: 'rgba(23, 25, 35, 0.65)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: 16,
                  height: 52,
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: 'none'
                }}>
                  <img src="/logo.jfif" alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#FFFFFF', fontFamily: "'Outfit', 'Inter', sans-serif", lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>
                      {formatConcise(dailyPool)} $HH
                    </span>
                    <span style={{ fontSize: 9.5, color: 'rgba(255, 255, 255, 0.45)', fontWeight: 700, fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                      ≈${(dailyPool * hhPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Plate: Timer */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#A0AEC0', letterSpacing: '0.5px', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                  TIME LEFT
                </span>
                <div style={{
                  background: 'rgba(23, 25, 35, 0.65)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: 16,
                  height: 52,
                  padding: '0 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'none'
                }}>
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 24,
                    fontWeight: 700,
                    color: '#FFFFFF',
                    fontVariantNumeric: 'tabular-nums'
                  }}>
                    {dailyTimeRemaining > 0 ? new Date(dailyTimeRemaining * 1000).toISOString().substr(11, 8) : '00:00:00'}
                  </span>
                </div>
              </div>
            </div>

            {/* Sponsor block */}
            <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600, fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                🤝 Sponsor: <span style={{ color: '#FFFFFF', fontWeight: 800 }}>{dailySponsor}</span>
              </span>
            </div>
          </div>

          {/* Eligibility Card */}
          <div style={{
            background: 'rgba(23, 25, 35, 0.65)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            borderRadius: 16,
            padding: '16px 18px 14px',
            marginBottom: 12,
            boxShadow: 'none',
            border: isDailyEligible ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(255, 255, 255, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 900, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{isDailyEligible ? '🟢 Eligible' : '⚪ Not Eligible'}</span>
                </div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.6)', marginTop: 4, fontWeight: 650, lineHeight: 1.3 }}>
                  {isDailyEligible 
                    ? "You are automatically entered into today's daily draw!" 
                    : "Buy at least 1 ticket in the hourly raffle today to qualify for the daily draw."
                  }
                </div>
              </div>
              {isDailyEligible && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#10B981', fontFamily: "'Barlow Condensed', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                    {dailyUserTickets} TICKET{dailyUserTickets > 1 ? 'S' : ''}
                  </div>
                  <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
                    weighted weight
                  </div>
                </div>
              )}
            </div>

            {!isDailyEligible && (
              <button
                type="button"
                onClick={() => {}}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 16,
                  border: 'none',
                  background: '#0000FF',
                  color: '#FFFFFF',
                  fontSize: 12.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                Buy Ticket in $HH Raffle
              </button>
            )}
          </div>

          {/* Trigger draw button (Overdue state check) */}
          {dailyTimeRemaining === 0 && (
            <button
              type="button"
              onClick={triggerDailyDraw}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: 16,
                border: '1px solid rgba(255, 255, 255, 0.05)',
                background: '#0000FF',
                color: '#FFFFFF',
                fontSize: 13.5,
                fontWeight: 500,
                cursor: 'pointer',
                textAlign: 'center',
                boxShadow: 'none'
              }}
            >
              🎯 Trigger Daily Draw (VRF)
            </button>
          )}

          {/* Local simulation button for dev testing */}
          <div style={{ textAlign: 'center', marginTop: 4 }}>
            <span 
              onClick={simulateDailyEligibility}
              style={{ 
                fontSize: 8.5, 
                fontWeight: 800, 
                color: 'rgba(255,255,255,0.3)', 
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              [Dev] Simulate eligibility (10 tickets)
            </span>
          </div>
        </div>
      )}

      {/* Last winner */}
      {lastWinner && (
        <div style={{ marginBottom: 16 }}>
          <div style={{
            fontFamily: "'Outfit', 'Inter', sans-serif",
            fontSize: 11.5,
            color: '#4A5568',
            fontWeight: 800,
            letterSpacing: '0.6px',
            marginBottom: 8,
            textTransform: 'uppercase'
          }}>
            Last Winner
          </div>
          <div style={{
            background: cardBg,
            border: cardBorder,
            borderTop: `3px solid ${accentColor}`,
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: cardShadow,
          }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: glowColor.replace('0.25', '0.15'),
              border: `1.5px solid ${accentColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              flexShrink: 0,
            }}>🏆</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 9, color: '#A0AEC0', fontWeight: 800, marginBottom: 3, letterSpacing: '0.5px', fontFamily: "'Outfit', 'Inter', sans-serif" }}>LAST WINNER</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#FFFFFF', fontFamily: "'Outfit', 'Inter', sans-serif" }}>{lastWinner.name}</div>
              <div style={{ fontSize: 9.5, color: '#A0AEC0', fontWeight: 700, marginTop: 1, fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                Win chance: <span style={{ color: '#FFFFFF', fontWeight: 800 }}>{lastWinner.chance}%</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 700, color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>
                +{isHH ? `${formatConcise(parseFloat(lastWinner.amount))} $HH` : `${lastWinner.amount} USDC`}
              </div>
              {isHH && (
                <div style={{ fontSize: 10, color: '#10B981', fontWeight: 500, marginTop: 1, fontFamily: "'Outfit', 'Inter', sans-serif", fontVariantNumeric: 'tabular-nums' }}>
                  ≈$${(parseFloat(lastWinner.amount) * hhPrice).toFixed(2)}
                </div>
              )}
              <div style={{ fontSize: 9, color: '#A0AEC0', fontWeight: 600, marginTop: 2, fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                of {isHH ? `${formatConcise(parseFloat(lastWinner.pot))} $HH` : `${lastWinner.pot} USDC`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* How it works */}
      <div style={{ marginBottom: 16 }}>
        <div style={{
          fontFamily: "'Outfit', 'Inter', sans-serif",
          fontSize: 11.5,
          color: '#4A5568',
          fontWeight: 800,
          letterSpacing: '0.6px',
          marginBottom: 8,
          textTransform: 'uppercase'
        }}>
          How it works
        </div>
        <div style={{
          background: cardBg,
          border: cardBorder,
          borderRadius: 16,
          padding: '16px 18px',
          boxShadow: cardShadow,
        }}>
          {[
            ['How long does each round last?',   'Each round runs exactly 60 minutes.'],
            ['When do deposits close?',           'Deposits close 3 minutes before the draw.'],
            ['How is the winner selected?',       'Secure random selection, lucky-based. Anyone with 1+ ticket can win. More tickets = more chances.'],
            ['How many points do I get?', (
              <>
                Raffle winner receives <strong style={{ color: '#10B981' }}>1 HP</strong> 
              </>
            )],
            ['What happens if I’m the only player in a round?', (
              <>
                You will receive a 100% refund and <strong style={{ color: '#10B981' }}>1 HP</strong> as the winner.
              </>
            )],
            ['How much does the winner receive?', isHH ? `Winner takes 85% of the total pot. The remaining 15% is burned.` : `Winner takes 85% of the total pot. The remaining 15% goes to the foundation for future rewards.`],
            ['When are winnings paid?',           'Automatically after the draw, directly to the winner\'s wallet.'],
            ['Can I deposit multiple times?',     'Yes! Multiple deposits per round are allowed and all contribute to your ticket count.'],
          ].map(([q, a], i, arr) => (
            <div key={i} style={{ marginBottom: i < arr.length - 1 ? 14 : 0 }}>
              <div style={{ fontSize: 11.5, fontWeight: 500, color: '#FFFFFF', marginBottom: 4, fontFamily: "'Outfit', 'Inter', sans-serif" }}>{q}</div>
              <div style={{ fontSize: 10, color: '#A0AEC0', lineHeight: 1.6, fontWeight: 400, fontFamily: "'Outfit', 'Inter', sans-serif" }}>{a}</div>
            </div>
          ))}
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
