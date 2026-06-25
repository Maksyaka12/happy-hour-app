// src/components/RouletteModal.jsx
import { useState, useEffect, useRef } from 'react'
import { UserAvatar } from './UserAvatar'

const TICKET_W = 80
const MAX_STRIP = 300 // Max DOM nodes in strip — prevents lag with many participants/tickets
const COLORS = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#C77DFF", "#FF9F1C", "#00B4D8", "#F72585", "#3A86FF", "#8338EC"]
const pColor = (addr) => COLORS[parseInt(addr?.slice(2, 4) || '0', 16) % COLORS.length]
const short = (a) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—'
const fmtPrize = (n) => {
  if (!n) return '0'
  const v = parseFloat(n)
  if (v >= 1e9) return (v / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'b'
  if (v >= 1e6) return (v / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'm'
  if (v >= 1e3) return (v / 1e3).toFixed(2).replace(/\.?0+$/, '') + 'k'
  return v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)
}

export function RouletteModal({ participants, totalPot, winner: supabaseWinner, prize, currency = 'USDC', onComplete }) {
  const [offset, setOffset] = useState(0)
  const [done, setDone] = useState(false)
  const [showWinner, setShowWinner] = useState(false)
  const [winner, setWinner] = useState(null)
  const rafRef = useRef(null)

  // Build capped ticket pool — proportional weights but never more than MAX_STRIP total
  // Prevents millions of DOM nodes which causes severe lag for HH (large token amounts)
  const rawStrip = []
  participants.forEach(p => {
    const ticketCount = Math.max(1, p.tickets || 1)
    for (let j = 0; j < ticketCount; j++) rawStrip.push(p)
  })
  // Repeat proportionally to fill ~300 slots
  const repeats = Math.max(1, Math.floor(MAX_STRIP / rawStrip.length))
  const strip = []
  for (let i = 0; i < repeats; i++) {
    rawStrip.forEach(p => strip.push(p))
  }

  // Ensure spin is long by finding a matching ticket near the end of the strip
  let winIdx = Math.floor(strip.length * 0.8)
  if (supabaseWinner) {
    while (winIdx >= 0 && strip[winIdx]?.address?.toLowerCase() !== supabaseWinner.toLowerCase()) {
      winIdx--
    }
  }
  const WIN_IDX = Math.max(0, winIdx)

  const finalOffset = -(WIN_IDX * TICKET_W - 140)

  useEffect(() => {
    const totalMs = 6000
    const start = performance.now()
    const startOff = offset

    const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

    const animate = (now) => {
      const t = Math.min((now - start) / totalMs, 1)
      const e = ease(t)
      setOffset(startOff + (finalOffset - startOff) * e)

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setDone(true)
        const w = participants.find(p => p.address?.toLowerCase() === supabaseWinner?.toLowerCase())
          || participants[Math.floor(Math.random() * participants.length)]
        setWinner(w)
        setTimeout(() => setShowWinner(true), 400)
      }
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(10,11,13,0.85)', zIndex: 300,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ color: '#fff', fontSize: 13, letterSpacing: 2, marginBottom: 16, opacity: 0.7 }}>
        🎰 SPINNING…
      </div>

      {/* Roulette strip */}
      <div style={{
        width: 360, height: 110, overflow: 'hidden', position: 'relative',
        background: 'rgba(255,255,255,0.06)', borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.12)',
      }}>
        <div style={{ position: 'absolute', left: '50%', top: -1, zIndex: 12, transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderTop: '12px solid #FFD700' }} />
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: '#FFD700', zIndex: 10, transform: 'translateX(-50%)', boxShadow: '0 0 10px #FFD700' }} />
        <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0, transform: `translateX(${offset}px)`, willChange: 'transform' }}>
          {strip.map((tk, i) => (
            <div key={i} style={{
              width: TICKET_W, height: 110, flexShrink: 0,
              background: done && i === WIN_IDX ? '#0000FF' : pColor(tk.address) + '33',
              borderRight: '1px solid rgba(0,0,0,0.3)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              opacity: done && i !== WIN_IDX ? 0.25 : 1,
            }}>
              <UserAvatar address={tk.address} size={28} />
              <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.6)', textAlign: 'center', padding: '0 4px' }}>
                {(tk.name || short(tk.address)).slice(0, 8)}
              </span>
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none', background: 'linear-gradient(90deg,rgba(10,11,13,0.8) 0%,transparent 25%,transparent 75%,rgba(10,11,13,0.8) 100%)' }} />
      </div>

      {/* Winner reveal */}
      {showWinner && winner && (
        <div style={{ textAlign: 'center', marginTop: 32, animation: 'fadeIn 0.5s ease' }}>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', letterSpacing: 1, marginBottom: 8 }}>WINNER</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
            {winner.name || short(winner.address)}
          </div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 48, fontWeight: 900, color: '#FFD700', lineHeight: 1 }}>
            +{fmtPrize(prize || (participants.length === 1 ? totalPot : totalPot * 0.85))} {currency}
          </div>
          <button onClick={onComplete} style={{
            marginTop: 24, background: '#0000FF', color: '#fff',
            borderRadius: 50, padding: '14px 44px', fontSize: 15, fontWeight: 700,
            border: 'none', cursor: 'pointer', boxShadow: '0 6px 24px rgba(0,0,255,0.5)',
          }}>Next Round →</button>
        </div>
      )}
    </div>
  )
}
