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
import { FOUNDATION, USDC_ADDRESS, USDC_ABI, HH_ADDRESS, HH_ABI, BET_OPTS, TICKET_UNIT, CLOSE_BEFORE_MS, WINNER_SHARE, HH_RAFFLE_VAULT_ADDRESS } from '../config/constants'
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

export function RaffleSection({ address, basename }) {
  const [raffleType, setRaffleType] = useState('hh') // 'hh' | 'usdc'
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
          db.functions.invoke('draw-round').catch(console.error)
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

  const timerColor = isClosed ? '#FC401F' : '#FFFFFF'

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
    setTxModal({ amount })
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 12px 120px', animation: 'fadeIn 0.3s ease-out' }}>

      {/* USDC / HH Raffle Switcher */}
      <div style={{ padding: '0 4px' }}>
        <div style={{
          display: 'flex',
          background: 'rgba(255, 255, 255, 0.06)',
          padding: 3,
          borderRadius: 12,
          marginBottom: 16,
          maxWidth: 380,
          margin: '0 auto 16px',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          gap: 6
        }}>
          <button
            onClick={() => setRaffleType('hh')}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: 10,
              border: 'none',
              background: raffleType === 'hh' 
                ? 'linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%)' 
                : 'transparent',
              color: raffleType === 'hh' ? '#fff' : 'rgba(255, 255, 255, 0.55)',
              fontWeight: 800,
              fontSize: 11.5,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: raffleType === 'hh' 
                ? '0 2px 8px rgba(139,92,246,0.15)' 
                : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              outline: 'none'
            }}
          >
            <img src="/logo.jfif" alt="$HH" style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }} />
            $HH Raffle
          </button>
          <button
            onClick={() => setRaffleType('usdc')}
            style={{
              flex: 1,
              padding: '8px 10px',
              borderRadius: 10,
              border: 'none',
              background: raffleType === 'usdc' 
                ? 'linear-gradient(135deg, #0052FF 0%, #3B82F6 100%)' 
                : 'transparent',
              color: raffleType === 'usdc' ? '#fff' : 'rgba(255, 255, 255, 0.55)',
              fontWeight: 800,
              fontSize: 11.5,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: raffleType === 'usdc' 
                ? '0 2px 8px rgba(0,82,255,0.15)' 
                : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              outline: 'none'
            }}
          >
            <img src="/usdc-logo.png" alt="USDC" style={{ width: 14, height: 14 }} />
            USDC Raffle
          </button>
        </div>
      </div>

      {/* Hero card */}
      <div style={{
        background: 'linear-gradient(145deg, rgba(20, 20, 25, 0.95) 0%, rgba(38, 39, 48, 0.90) 50%, rgba(12, 12, 16, 0.98) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 20,
        padding: '20px 18px 16px',
        marginBottom: 12,
        boxShadow: '0 8px 32px rgba(10, 10, 15, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Background image overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/banner.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: raffleType === 'hh'
            ? 'hue-rotate(275deg) brightness(0.35) contrast(1.15)'
            : 'hue-rotate(200deg) brightness(0.28) contrast(1.15)',
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

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 14.5, fontWeight: 900, color: '#FFFFFF', letterSpacing: '0.2px', textTransform: 'uppercase', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
            Round #{displayRound?.id ?? '—'} Raffle
          </div>
          <span style={{
            background: isClosed ? 'rgba(252, 64, 31, 0.1)' : 'rgba(16, 185, 129, 0.08)',
            color: isClosed ? '#FC401F' : '#10B981',
            padding: '3px 8px',
            borderRadius: 8,
            fontSize: 10,
            fontWeight: 800,
            border: isClosed ? '1px solid rgba(252, 64, 31, 0.25)' : '1px solid rgba(16, 185, 129, 0.25)'
          }}>
            {isClosed ? 'DEPOSITS CLOSED' : 'ACTIVE'}
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
            <span style={{ fontSize: 10, fontWeight: 800, color: '#A0AEC0', letterSpacing: '0.5px' }}>
              PRIZE POOL
            </span>
            <div style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 14,
              height: 52,
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
            }}>
              <img src={raffleType === 'hh' ? "/logo.jfif" : "/usdc-logo.png"} alt="" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: '#FFFFFF', fontFamily: "'Outfit', 'Inter', sans-serif", lineHeight: 1.1 }}>
                  {raffleType === 'hh' ? `${formatConcise(displayTotalPot)} $HH` : `${displayTotalPot.toFixed(2)} USDC`}
                </span>
                <span style={{ fontSize: 9.5, color: 'rgba(255, 255, 255, 0.45)', fontWeight: 700 }}>
                  {raffleType === 'hh' ? `≈$${(displayTotalPot * hhPrice).toFixed(2)}` : `≈$${displayTotalPot.toFixed(2)}`}
                </span>
              </div>
            </div>
          </div>

          {/* Right Plate: Timer */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 10, fontWeight: 800, color: '#A0AEC0', letterSpacing: '0.5px' }}>
              {isClosed ? 'DRAWS IN' : 'TIME LEFT'}
            </span>
            <div style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 14,
              height: 52,
              padding: '0 12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
            }}>
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 24,
                fontWeight: 900,
                color: timerColor,
                fontVariantNumeric: 'tabular-nums'
              }}>
                {fmt(msLeft)}
              </span>
            </div>
          </div>
        </div>

        <div style={{ position: 'relative', zIndex: 2 }}>
          <PBar participants={displayParticipants} totalPot={displayTotalPot} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, flexWrap: 'wrap', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600 }}>
              👥 {displayParticipants.length} players · {displayParticipants.reduce((s, p) => s + (p.tickets || 0), 0)} tickets
            </span>
            {displayMyEntry && (
              <span style={{ fontSize: 11, color: '#FFFFFF', fontWeight: 800 }}>
                Your chance: <span style={{ color: raffleType === 'hh' ? '#D946EF' : '#3B82F6' }}>{displayMyChance}%</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Closed warning */}
      {isClosed && (
        <div style={{
          background: 'rgba(252, 64, 31, 0.08)',
          border: '1px solid rgba(252, 64, 31, 0.3)',
          borderRadius: 14,
          padding: '10px 16px',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FC401F', animation: 'blinkDot 1s infinite' }} />
          <span style={{ fontSize: 12, color: '#FC401F', fontWeight: 700 }}>
            Deposits closed · Draw in {fmt(msLeft)}
          </span>
        </div>
      )}

      {/* Wrong chain warning */}
      {wrongChain && (
        <div style={{
          background: 'rgba(217, 119, 6, 0.08)',
          border: '1px solid rgba(217, 119, 6, 0.3)',
          borderRadius: 14,
          padding: '10px 16px',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}>
          <span style={{ fontSize: 12, color: '#FBBF24', fontWeight: 700 }}>Switch to Base Mainnet</span>
          <button
            onClick={() => switchChain({ chainId: base.id })}
            style={{
              background: '#D97706',
              color: '#fff',
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: 11,
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              outline: 'none',
              transition: 'background 0.2s'
            }}
          >
            {isSwitching ? 'Switching…' : 'Switch'}
          </button>
        </div>
      )}

      {/* My position */}
      {displayMyEntry && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255, 255, 255, 0.1)', 
          borderLeft: `4px solid ${raffleType === 'hh' ? '#D946EF' : '#3B82F6'}`,
          borderRadius: 14,
          padding: '12px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 9, color: '#A0AEC0', fontWeight: 800, marginBottom: 4, letterSpacing: '0.5px', textTransform: 'uppercase' }}>YOUR POSITION</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
              {displayMyTickets} tickets · <span style={{ color: raffleType === 'hh' ? '#D946EF' : '#3B82F6' }}>
                {raffleType === 'hh' ? `${formatConcise(displayMyAmount)} $HH` : `${displayMyAmount.toFixed(2)} USDC`}
              </span>
              <span style={{ fontSize: 10.5, color: '#A0AEC0', marginLeft: 6, fontWeight: 500 }}>
                {raffleType === 'hh' ? `≈$${(displayMyAmount * hhPrice).toFixed(2)}` : `≈$${displayMyAmount.toFixed(2)}`}
              </span>
            </div>
          </div>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 26,
            fontWeight: 900,
            color: raffleType === 'hh' ? '#D946EF' : '#3B82F6'
          }}>
            {displayMyChance}%
          </div>
        </div>
      )}

      {/* Bet buttons */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 9.5, color: '#A0AEC0', fontWeight: 800, letterSpacing: '0.5px', marginBottom: 10, textTransform: 'uppercase' }}>
          Place Your Bet
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {BET_OPTS.map(a => (
            <button
              key={a}
              onClick={() => onBetClick(a)}
              disabled={isClosed || isPending || isConfirming}
              style={{
                background: raffleType === 'hh'
                  ? 'linear-gradient(135deg, #8B5CF6 0%, #D946EF 100%)'
                  : 'linear-gradient(135deg, #0052FF 0%, #3B82F6 100%)', 
                border: 'none',
                borderRadius: 12,
                padding: '12px 6px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                boxShadow: raffleType === 'hh' 
                  ? '0 4px 14px rgba(139, 92, 246, 0.25)' 
                  : '0 4px 14px rgba(0, 82, 255, 0.25)', 
                cursor: 'pointer',
                opacity: isClosed ? 0.45 : 1,
                transition: 'all 0.2s',
                outline: 'none'
              }}
            >
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14.5, fontWeight: 900, color: '#FFFFFF', whiteSpace: 'nowrap', letterSpacing: '0.2px' }}>
                {raffleType === 'hh' ? `${formatConcise(a / hhPrice)} $HH` : `${a} USDC`}
              </div>
              <div style={{ fontSize: 8.5, color: raffleType === 'hh' ? '#F5D0FE' : '#BFDBFE', fontWeight: 800 }}>
                {raffleType === 'hh' ? `≈$${a} · ` : ''}{Math.round(a / TICKET_UNIT)} TICKET{Math.round(a / TICKET_UNIT) > 1 ? 'S' : ''}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Participants */}
      {displayParticipants.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 9.5, color: '#A0AEC0', fontWeight: 800, letterSpacing: '0.5px', marginBottom: 8, textTransform: 'uppercase' }}>
            Participants
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderTop: `3px solid ${raffleType === 'hh' ? '#D946EF' : '#3B82F6'}`,
            borderRadius: 14,
            overflow: 'hidden'
          }}>
            {displayParticipants.map((p, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                background: i % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'rgba(255, 255, 255, 0.005)',
                borderBottom: i < displayParticipants.length - 1 ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
                borderLeft: `3px solid ${pColor(p.address)}`,
              }}>
                <UserAvatar address={p.address} size={28} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#FFFFFF' }}>{p.name || short(p.address)}</div>
                  <div style={{ fontSize: 9.5, color: '#A0AEC0', fontWeight: 600, marginTop: 1 }}>
                    {p.tickets || Math.round(p.amount / TICKET_UNIT)} tickets
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14.5, fontWeight: 900, color: raffleType === 'hh' ? '#D946EF' : '#3B82F6' }}>
                    {raffleType === 'hh' ? `${formatConcise(p.amount)} $HH` : `${p.amount.toFixed(2)} USDC`}
                  </div>
                  <div style={{ fontSize: 9.5, color: '#A0AEC0', fontWeight: 650, marginTop: 1 }}>
                    {raffleType === 'hh' && `≈$${(p.amount * hhPrice).toFixed(2)} · `}
                    <span style={{ color: raffleType === 'hh' ? '#D946EF' : '#3B82F6', fontWeight: 800 }}>
                      {displayTotalPot > 0 ? (p.amount / displayTotalPot * 100).toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last winner */}
      {lastWinner && (
        <div style={{
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderTop: `3px solid ${raffleType === 'hh' ? '#D946EF' : '#3B82F6'}`,
          borderRadius: 14,
          padding: '14px 16px',
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
        }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: raffleType === 'hh' 
              ? 'rgba(217, 70, 239, 0.15)' 
              : 'rgba(59, 130, 246, 0.15)',
            border: `1.5px solid ${raffleType === 'hh' ? '#D946EF' : '#3B82F6'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0,
          }}>🏆</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 9, color: raffleType === 'hh' ? '#D946EF' : '#3B82F6', fontWeight: 800, marginBottom: 3, letterSpacing: '0.5px' }}>LAST WINNER</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#FFFFFF' }}>{lastWinner.name}</div>
            <div style={{ fontSize: 9.5, color: '#A0AEC0', fontWeight: 700, marginTop: 1 }}>
              Win chance: <span style={{ color: raffleType === 'hh' ? '#D946EF' : '#3B82F6', fontWeight: 800 }}>{lastWinner.chance}%</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, fontWeight: 900, color: '#FFFFFF' }}>
              +{raffleType === 'hh' ? `${formatConcise(parseFloat(lastWinner.amount))} $HH` : `${lastWinner.amount} USDC`}
            </div>
            {raffleType === 'hh' && (
              <div style={{ fontSize: 10, color: '#10B981', fontWeight: 800, marginTop: 1 }}>
                ≈${(parseFloat(lastWinner.amount) * hhPrice).toFixed(2)}
              </div>
            )}
            <div style={{ fontSize: 9, color: '#A0AEC0', fontWeight: 600, marginTop: 2 }}>
              of {raffleType === 'hh' ? `${formatConcise(parseFloat(lastWinner.pot))} $HH` : `${lastWinner.pot} USDC`}
            </div>
          </div>
        </div>
      )}

      {/* How it works */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        padding: '16px 18px'
      }}>
        <div style={{ fontSize: 9.5, fontWeight: 900, color: '#A0AEC0', letterSpacing: '0.5px', marginBottom: 14, textTransform: 'uppercase' }}>
          How it works
        </div>
        {[
          ['How long does each round last?',   'Each round runs exactly 60 minutes.'],
          ['When do deposits close?',           'Deposits close 3 minutes before the draw.'],
          ['How is the winner selected?',       'Secure random selection, lucky-based. Anyone with 1+ ticket can win. More tickets = more chances.'],
          ['How many points do I get for playing?', (
            <>
              You earn <strong style={{ color: '#10B981' }}>HP</strong> for participating in the raffle. The winner of the round receives the main prize pool.
            </>
          )],
          ['What happens if I’m the only player in a round?', (
            <>
              You will receive a 100% refund and <strong style={{ color: '#10B981' }}>1 HP</strong> as the winner.
            </>
          )],
          ['How much does the winner receive?', raffleType === 'hh' ? `Winner takes 85% of the total pot. The remaining 15% is burned.` : `Winner takes 85% of the total pot. The remaining 15% goes to the foundation for future rewards.`],
          ['When are winnings paid?',           'Automatically after the draw, directly to the winner\'s wallet.'],
          ['Can I deposit multiple times?',     'Yes! Multiple deposits per round are allowed and all contribute to your ticket count.'],
        ].map(([q, a], i, arr) => (
          <div key={i} style={{ marginBottom: i < arr.length - 1 ? 14 : 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#FFFFFF', marginBottom: 4 }}>{q}</div>
            <div style={{ fontSize: 10, color: '#A0AEC0', lineHeight: 1.6, fontWeight: 500 }}>{a}</div>
          </div>
        ))}
      </div>

      {/* TxModal */}
      {txModal && (
        <TxModal
          title={raffleType === 'hh' ? (hhAllowance < txModal.amount / hhPrice ? "Approve $HH" : "Place Raffle Bet") : "Place Raffle Bet"}
          subtitle={
            raffleType === 'hh'
              ? (hhAllowance < txModal.amount / hhPrice 
                  ? "Approve unlimited $HH spending to buy tickets" 
                  : `+${Math.round(txModal.amount / TICKET_UNIT)} ${Math.round(txModal.amount / TICKET_UNIT) === 1 ? 'ticket' : 'tickets'} · Simulated Entry`
                )
              : `+${Math.round(txModal.amount / TICKET_UNIT)} ${Math.round(txModal.amount / TICKET_UNIT) === 1 ? 'ticket' : 'tickets'} · + HP Points`
          }
          amount={raffleType === 'hh' ? (hhAllowance < txModal.amount / hhPrice ? "0.00" : Math.round(txModal.amount / hhPrice).toString()) : txModal.amount.toString()}
          currency={raffleType === 'hh' ? (hhAllowance < txModal.amount / hhPrice ? "Approve" : "$HH") : "USDC"}
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
          currency={raffleType === 'hh' ? 'HH' : 'USDC'}
          onComplete={() => { setSpinData(null); refetch() }}
        />
      )}
    </div>
  )
}
