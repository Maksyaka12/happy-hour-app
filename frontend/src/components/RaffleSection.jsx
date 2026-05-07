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
import { useWaitForTransactionReceipt, useChainId, useSwitchChain } from 'wagmi'
import { parseUnits } from 'viem'
import { base } from 'wagmi/chains'
import { FOUNDATION, USDC_ADDRESS, USDC_ABI, BET_OPTS, TICKET_UNIT, CLOSE_BEFORE_MS, WINNER_SHARE } from '../config/constants'
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

export function RaffleSection({ address }) {
  const { round, participants, lastWinner, myTickets, myAmount, refetch } = useRoundState(address)
  const [msLeft,       setMsLeft]       = useState(0)
  const [txModal,      setTxModal]      = useState(null) // { amount }
  const [spinData, setSpinData] = useState(null)

  // ── Chain check ──────────────────────────────────────────
  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const wrongChain = chainId !== base.id

  // ── Builder write contract ───────────────────────────────
  const { data: txHash, writeContract, isPending, isConfirming, isSuccess, error: writeError, reset } = useBuilderWrite()

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
        const FALLBACK_THRESHOLD_MS = 5 * 60 * 1000 // 5 хвилин

        if (
          overdueMs > FALLBACK_THRESHOLD_MS &&
          round.status === 'open' &&
          !fallbackRef.current
        ) {
          // pg_cron не спрацював — браузер підстрахує
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
        participants: participants,
        totalPot: participants.reduce((s, p) => s + p.amount, 0),
        winner: round.winner,
        prize: round.prize
      })
    }
  }, [round?.status])

  // After tx confirmed — close modal, refetch
  useEffect(() => {
    if (isSuccess) {
      setTxModal(null)
      reset()
      setTimeout(() => refetch(), 3000) // Alchemy webhook ~2-3s
    }
  }, [isSuccess])

  const totalPot = useMemo(() => participants.reduce((s, p) => s + p.amount, 0), [participants])
  const isClosed = msLeft <= CLOSE_BEFORE_MS || round?.status === 'closed' || round?.status === 'spinning'
  const myEntry  = participants.find(p => p.address?.toLowerCase() === address?.toLowerCase())
  const myChance = totalPot > 0 ? (((myEntry?.amount || 0) / totalPot) * 100).toFixed(1) : '0.0'
  const timerColor = isClosed ? '#FC401F' : '#0A0B0D'

  // ── Send USDC ────────────────────────────────────────────
  const sendBet = useCallback((amount) => {
    if (isClosed || !address) return

    // Switch chain if needed
    if (wrongChain) { switchChain({ chainId: base.id }); return }

    // useWriteContract sends the tx
    // dataSuffix (Builder Code) is added automatically by wagmi config
    writeContract({
      address:      USDC_ADDRESS,
      abi:          USDC_ABI,
      functionName: 'transfer',
      args:         [FOUNDATION, parseUnits(amount.toFixed(6), 6)],
      chainId:      base.id,
    })
  }, [isClosed, address, wrongChain, writeContract, switchChain])

  const onBetClick = (amount) => {
    setTxModal({ amount })
  }

  return (
    <div style={{ paddingBottom: 120, padding: '0 12px 120px' }}>

      {/* Hero card */}
      <div style={{
        background: '#0000FF', borderRadius: 20, padding: '22px 20px 18px',
        marginBottom: 12, position: 'relative', overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,255,0.3)',
      }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.1,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1.5px, transparent 1.5px)',
          backgroundSize: '20px 20px',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: 'rgba(255,255,255,0.65)', letterSpacing: 1.5, marginBottom: 4 }}>
                ROUND #{round?.id ?? '—'} · PRIZE POOL
              </div>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 48, fontWeight: 900, lineHeight: 0.95, color: '#fff' }}>
                {totalPot.toFixed(2)}<span style={{ fontSize: 20, marginLeft: 6, opacity: 0.75 }}>USDC</span>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 10, color: 'rgba(255,255,255,0.65)', letterSpacing: 1, marginBottom: 4 }}>
                {isClosed ? 'DRAWS IN' : 'TIME LEFT'}
              </div>
              <div style={{
                fontFamily: "'Barlow Condensed',sans-serif", fontSize: 34, fontWeight: 900,
                background: '#fff', borderRadius: 8, padding: '4px 10px',
                color: timerColor, display: 'inline-block', fontVariantNumeric: 'tabular-nums',
              }}>
                {fmt(msLeft)}
              </div>
            </div>
          </div>
          <PBar participants={participants} totalPot={totalPot} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, flexWrap: 'wrap', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
              👥 {participants.length} players · {participants.reduce((s, p) => s + (p.tickets || 0), 0)} tickets
            </span>
            {myEntry && <span style={{ fontSize: 12, color: '#fff', fontWeight: 700 }}>Your chance: {myChance}%</span>}
          </div>
        </div>
      </div>

      {/* Closed warning */}
      {isClosed && (
        <div style={{
          background: '#FEE2E2', border: '1px solid #FC401F',
          borderRadius: 12, padding: '10px 16px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FC401F', animation: 'blinkDot 1s infinite' }} />
          <span style={{ fontSize: 13, color: '#FC401F', fontWeight: 600 }}>
            Deposits closed · Draw in {fmt(msLeft)}
          </span>
        </div>
      )}

      {/* Wrong chain warning */}
      {wrongChain && (
        <div style={{
          background: '#FEF3C7', border: '1px solid #D97706',
          borderRadius: 12, padding: '10px 16px', marginBottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span style={{ fontSize: 13, color: '#D97706', fontWeight: 600 }}>Switch to Base Mainnet</span>
          <button
            onClick={() => switchChain({ chainId: base.id })}
            style={{ background: '#D97706', color: '#fff', borderRadius: 50, padding: '6px 14px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >
            {isSwitching ? 'Switching…' : 'Switch'}
          </button>
        </div>
      )}

      {/* My position */}
      {myEntry && (
        <div style={{
          background: '#EEF0F3', border: '1px solid #DEE1E7', borderLeft: '4px solid #0000FF',
          borderRadius: 12, padding: '12px 16px', marginBottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#717886', fontWeight: 600, marginBottom: 2 }}>YOUR POSITION</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#0A0B0D' }}>{myTickets} tickets · {myAmount.toFixed(2)} USDC</div>
          </div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 30, fontWeight: 900, color: '#0000FF' }}>{myChance}%</div>
        </div>
      )}

      {/* Bet buttons */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: '#717886', fontWeight: 600, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>
          Place Your Bet
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
          {BET_OPTS.map(a => (
            <button
              key={a}
              onClick={() => onBetClick(a)}
              disabled={isClosed || isPending || isConfirming}
              style={{
                background: '#0000FF', border: 'none', borderRadius: 10, padding: '14px 8px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                boxShadow: '0 2px 8px rgba(0,0,255,0.25)', cursor: 'pointer',
                opacity: isClosed ? 0.4 : 1, transition: 'all 0.15s',
              }}
            >
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 900, color: '#fff' }}>
                {a} USDC
              </div>
              <div style={{ fontSize: 9, color: '#3C8AFF', marginTop: 1 }}>
                {Math.round(a / TICKET_UNIT)} ticket{Math.round(a / TICKET_UNIT) > 1 ? 's' : ''}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Participants */}
      {participants.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#717886', fontWeight: 600, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' }}>
            Participants
          </div>
          <div style={{ background: '#EEF0F3', border: '1px solid #DEE1E7', borderTop: '3px solid #0000FF', borderRadius: 12, overflow: 'hidden' }}>
            {participants.map((p, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                background: '#fff', borderBottom: i < participants.length - 1 ? '1px solid #DEE1E7' : 'none',
                borderLeft: `3px solid ${pColor(p.address)}`,
              }}>
                <UserAvatar address={p.address} size={30} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0A0B0D' }}>{p.name || short(p.address)}</div>
                  <div style={{ fontSize: 10, color: '#717886', marginTop: 1 }}>{p.tickets || Math.round(p.amount / TICKET_UNIT)} tickets</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 16, fontWeight: 900, color: '#0000FF' }}>
                    {p.amount.toFixed(2)} USDC
                  </div>
                  <div style={{ fontSize: 10, color: '#3C8AFF' }}>
                    {totalPot > 0 ? (p.amount / totalPot * 100).toFixed(1) : 0}%
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
          background: '#EEF0F3', border: '1px solid #DEE1E7', borderTop: '3px solid #3C8AFF',
          borderRadius: 12, padding: '14px 16px', marginBottom: 12,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', background: '#0000FF',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
          }}>🏆</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: '#3C8AFF', fontWeight: 600, marginBottom: 2 }}>LAST WINNER</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#0A0B0D' }}>{lastWinner.name}</div>
            <div style={{ fontSize: 10, color: '#3C8AFF', marginTop: 1 }}>Win chance: {lastWinner.chance}%</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 900, color: '#0000FF' }}>
              +{lastWinner.amount}
            </div>
            <div style={{ fontSize: 10, color: '#717886' }}>of {lastWinner.pot} USDC</div>
          </div>
        </div>
      )}

      {/* How it works */}
      <div style={{ background: '#EEF0F3', border: '1px solid #DEE1E7', borderRadius: 16, padding: '18px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#717886', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' }}>
          How it works
        </div>
        {[
          ['How long does each round last?',   'Each round runs exactly 60 minutes.'],
          ['When do deposits close?',           'Deposits close 3 minutes before the draw.'],
          ['How is the winner selected?',       'Secure random selection, lucky-based. Anyone with 1+ ticket can win. More tickets = more chances.'],
          ['How many points do I get for playing?', '1 ticket = 1 HP. The winner receives 5 HP.'],
          ['What happens if I’m the only player in a round?', 'You will receive a 100% refund and 5 HP as the winner.'],
          ['How much does the winner receive?', 'Winner takes 85% of the total pot. The remaining 15% goes to the foundation for future rewards.'],
          ['When are winnings paid?',           'Automatically after the draw, directly to the winner\'s wallet via the smart contract.'],
          ['Can I deposit multiple times?',     'Yes! Multiple deposits per round are allowed and all contribute to your ticket count.'],
        ].map(([q, a], i, arr) => (
          <div key={i} style={{ marginBottom: i < arr.length - 1 ? 12 : 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#32353D', marginBottom: 3 }}>{q}</div>
            <div style={{ fontSize: 12, color: '#717886', lineHeight: 1.65 }}>{a}</div>
          </div>
        ))}
      </div>

      {/* TxModal */}
      {txModal && (
        <TxModal
          title="Place Raffle Bet"
          subtitle={`+${Math.round(txModal.amount / TICKET_UNIT)} tickets · +${Math.round(txModal.amount / TICKET_UNIT)} HP`}
          amount={txModal.amount}
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
          onComplete={() => { setSpinData(null); refetch() }}
        />
      )}
    </div>
  )
}
