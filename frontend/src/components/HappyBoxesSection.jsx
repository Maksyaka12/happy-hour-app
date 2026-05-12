import React, { useState, useEffect } from 'react'
import { useChainId, useSwitchChain } from 'wagmi'
import { parseUnits } from 'viem'
import { base } from 'wagmi/chains'
import { CHECKIN_TARGET, USDC_ADDRESS, USDC_ABI } from '../config/constants'
import { db } from '../config/supabase'
import { useBuilderWrite } from '../hooks/useBuilderWrite'
import { TxModal } from './TxModal'

const BOX_CONFIG = {
  common: {
    label: 'Common',
    badge: 'ENTRY',
    hp: '4 – 8 HP',
    boost: null,
    accent: '#6B7280',
    glow: 'rgba(107,114,128,0.25)',
    border: 'rgba(107,114,128,0.3)',
    cardBg: 'linear-gradient(145deg, #1C1D1F 0%, #252628 100%)',
    btnBg: 'linear-gradient(135deg, #4B5563, #374151)',
    btnGlow: 'rgba(75,85,99,0.4)',
    badgeBg: 'rgba(107,114,128,0.15)',
    badgeColor: '#9CA3AF',
  },
  epic: {
    label: 'Epic',
    badge: 'HOT 🔥',
    hp: '10 – 20 HP',
    boost: '+ Chance for 2x Boost',
    accent: '#8B5CF6',
    glow: 'rgba(139,92,246,0.3)',
    border: 'rgba(139,92,246,0.4)',
    cardBg: 'linear-gradient(145deg, #1A1525 0%, #221B35 100%)',
    btnBg: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
    btnGlow: 'rgba(139,92,246,0.5)',
    badgeBg: 'rgba(139,92,246,0.15)',
    badgeColor: '#A78BFA',
  },
  legendary: {
    label: 'Legendary',
    badge: '⚡ JACKPOT',
    hp: '21 – 40 HP',
    boost: '+ Chance for 5x Boost',
    accent: '#F59E0B',
    glow: 'rgba(245,158,11,0.35)',
    border: 'rgba(245,158,11,0.45)',
    cardBg: 'linear-gradient(145deg, #1C1500 0%, #261C00 100%)',
    btnBg: 'linear-gradient(135deg, #D97706, #B45309)',
    btnGlow: 'rgba(245,158,11,0.5)',
    badgeBg: 'rgba(245,158,11,0.15)',
    badgeColor: '#FCD34D',
  },
}

export function HappyBoxesSection({ address, profile, onUpdate }) {
  const [selectedBox, setSelectedBox] = useState(null)
  const [isOpening, setIsOpening] = useState(false)
  const [openResult, setOpenResult] = useState(null)
  const [animPhase, setAnimPhase] = useState(0)
  const [displayHp, setDisplayHp] = useState(0)
  const [hoveredBox, setHoveredBox] = useState(null)

  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const wrongChain = chainId !== base.id

  const { data: txHash, writeContract, isPending, isConfirming, isSuccess, error: writeError, reset } = useBuilderWrite()

  const boxes = [
    { id: 'common',    name: 'Common Box',    price: 0.20, img: '/box1.png' },
    { id: 'epic',      name: 'Epic Box',      price: 0.45, img: '/box2.png' },
    { id: 'legendary', name: 'Legendary Box', price: 0.95, img: '/box3.png' },
  ]

  useEffect(() => {
    async function processBox() {
      if (isSuccess && selectedBox && txHash && !isOpening) {
        setIsOpening(true)
        try {
          const { data, error } = await db.rpc('open_happy_box', {
            p_address: address.toLowerCase(),
            p_box_type: selectedBox.id,
            p_tx_hash: txHash
          })
          if (error) throw error
          if (data?.ok) {
            await new Promise(r => setTimeout(r, 2000))
            const baseHp = Math.round(data.hp_won / data.applied_multiplier)
            setOpenResult({ hp: data.hp_won, mult: data.applied_multiplier, wonNewMult: data.multiplier_won > 1, baseHp, boxId: selectedBox.id })
            if (onUpdate) onUpdate()
          } else {
            alert(data?.error || 'Failed to open box')
          }
        } catch (err) {
          alert('Something went wrong opening the box.')
        } finally {
          setIsOpening(false)
          setSelectedBox(null)
          reset()
        }
      }
    }
    processBox()
  }, [isSuccess, txHash, selectedBox, address, onUpdate, reset, isOpening])

  useEffect(() => {
    if (openResult && animPhase === 0) {
      if (openResult.mult > 1) {
        setDisplayHp(openResult.baseHp)
        setAnimPhase(1)
        setTimeout(() => {
          setAnimPhase(2)
          setTimeout(() => {
            setAnimPhase(3)
            const target = openResult.hp
            const duration = 1200
            const start = Date.now()
            const timer = setInterval(() => {
              const timePassed = Date.now() - start
              if (timePassed >= duration) { setDisplayHp(target); setAnimPhase(4); clearInterval(timer) }
              else {
                const p = timePassed / duration
                setDisplayHp(Math.round(openResult.baseHp + (target - openResult.baseHp) * (p * (2 - p))))
              }
            }, 16)
          }, 800)
        }, 800)
      } else {
        setDisplayHp(openResult.hp)
        setAnimPhase(4)
      }
    }
  }, [openResult, animPhase])

  const handleConfirm = () => {
    if (wrongChain) { switchChain({ chainId: base.id }); return }
    if (!selectedBox) return
    writeContract({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: 'transfer', args: [CHECKIN_TARGET, parseUnits(selectedBox.price.toString(), 6)], chainId: base.id })
  }

  const closeResultModal = () => { setOpenResult(null); setAnimPhase(0); setDisplayHp(0) }

  return (
    <div style={{ padding: '0 16px 120px', animation: 'hbFadeIn 0.4s ease' }}>
      <style>{`
        @keyframes hbFadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes hbBob { 0%,100% { transform:translateY(0) scale(1); } 50% { transform:translateY(-8px) scale(1.03); } }
        @keyframes hbShake { 0%,100%{transform:rotate(0) scale(1)} 20%{transform:rotate(-9deg) scale(1.12)} 40%{transform:rotate(9deg) scale(1.15)} 60%{transform:rotate(-7deg) scale(1.12)} 80%{transform:rotate(7deg) scale(1.08)} }
        @keyframes hbGlow { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes hbPop { 0%{transform:scale(0.7);opacity:0} 70%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
        @keyframes hbCountUp { from{transform:scale(1.3);color:#fff} to{transform:scale(1)} }
        @keyframes hbFloat { 0%,100%{transform:translateY(0) rotate(var(--r,0deg))} 50%{transform:translateY(-10px) rotate(var(--r,0deg))} }
        .hb-card { transition: transform 0.25s cubic-bezier(.34,1.56,.64,1), box-shadow 0.25s ease; cursor: pointer; }
        .hb-card:hover { transform: translateY(-3px) scale(1.01); }
        .hb-card:active { transform: scale(0.98); }
        .hb-open-btn { transition: all 0.2s ease; }
        .hb-open-btn:hover { filter: brightness(1.1); transform: scale(1.02); }
        .hb-open-btn:active { transform: scale(0.97); }
      `}</style>

      {/* Wrong Chain Banner */}
      {wrongChain && (
        <div style={{ background: 'rgba(217,119,6,0.1)', border: '1px solid rgba(217,119,6,0.4)', borderRadius: 14, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#F59E0B', fontWeight: 700 }}>⚠ Switch to Base Mainnet</span>
          <button onClick={() => switchChain({ chainId: base.id })} style={{ background: '#D97706', color: '#fff', borderRadius: 50, padding: '5px 14px', fontSize: 11, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
            {isSwitching ? 'Switching…' : 'Switch'}
          </button>
        </div>
      )}

      {/* ═══ HERO BANNER ═══ */}
      <div style={{
        backgroundImage: 'url(/banner.jpg)', backgroundColor: '#0000FF',
        backgroundSize: 'cover', backgroundPosition: 'center',
        borderRadius: 24, padding: '28px 20px', marginBottom: 16,
        position: 'relative', overflow: 'hidden', minHeight: 150,
        boxShadow: '0 16px 48px rgba(0,0,255,0.3), 0 0 0 1px rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(0,0,60,0.55) 0%, rgba(0,0,0,0.65) 100%)', zIndex: 0 }} />

        {/* Floating parachute boxes */}
        {[
          { top: -8, right: '8%',  w: 68, o: 0.55, r: '-14deg', blur: 1.5 },
          { top: 35, right: '26%', w: 48, o: 0.38, r: '10deg',  blur: 0.5 },
          { top: -18,left: '48%', w: 44, o: 0.45, r: '22deg',  blur: 1 },
          { bottom: -10, right:'3%', w:58, o: 0.38, r:'4deg',  blur: 1.2 },
          { bottom: -8, right:'38%', w:82, o:0.25, r:'-22deg', blur:3 },
        ].map((s, i) => (
          <div key={i} style={{
            position: 'absolute', top: s.top, right: s.right, left: s.left, bottom: s.bottom,
            width: s.w, opacity: s.o, zIndex: 1,
            animation: `hbFloat ${2.5 + i * 0.4}s ease-in-out infinite`,
            '--r': s.r
          }}>
            <img src="/background_box.png" alt="" style={{ width: '100%', transform: `rotate(${s.r})`, filter: `blur(${s.blur}px)` }} />
            <div style={{
              position: 'absolute', bottom: '28%', left: '50%', transform: 'translateX(-50%)',
              fontSize: s.w * 0.14, fontWeight: 900, color: '#fff',
              textShadow: '0 1px 6px rgba(0,0,0,0.9)', opacity: 0.85, whiteSpace: 'nowrap'
            }}>HP</div>
          </div>
        ))}

        {/* Glow orb */}
        <div style={{ position:'absolute', top:-40, right:-40, width:200, height:200, background:'rgba(100,100,255,0.15)', borderRadius:'50%', filter:'blur(70px)', zIndex:1 }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Happy Hour</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', lineHeight: 1.1, textShadow: '0 4px 20px rgba(0,0,0,0.7)', letterSpacing: '-0.5px' }}>
            Open your Happy Boxes
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 600, marginTop: 5, textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
            to win HP and Boosts
          </div>
        </div>
      </div>

      {/* ═══ BOX CARDS (Dark Glassmorphic) ═══ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {boxes.map((box) => {
          const cfg = BOX_CONFIG[box.id]
          const isHovered = hoveredBox === box.id
          return (
            <div
              key={box.id}
              className="hb-card"
              onMouseEnter={() => setHoveredBox(box.id)}
              onMouseLeave={() => setHoveredBox(null)}
              style={{
                background: cfg.cardBg,
                border: `1.5px solid ${isHovered ? cfg.accent : cfg.border}`,
                borderRadius: 22,
                padding: '14px 14px 14px 14px',
                boxShadow: isHovered
                  ? `0 12px 40px ${cfg.glow}, 0 0 0 1px ${cfg.accent}40`
                  : `0 4px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)`,
                display: 'flex', alignItems: 'center', gap: 14,
                position: 'relative', overflow: 'hidden',
              }}
            >
              {/* Subtle inner glow when hovered */}
              {isHovered && (
                <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 30% 50%, ${cfg.glow} 0%, transparent 70%)`, zIndex: 0, pointerEvents: 'none' }} />
              )}

              {/* Tier badge */}
              <div style={{
                position: 'absolute', top: 0, right: 0,
                background: cfg.badgeBg, color: cfg.badgeColor,
                fontSize: 8, fontWeight: 900,
                padding: '4px 10px', borderBottomLeftRadius: 12,
                letterSpacing: '0.5px', zIndex: 3,
                border: `1px solid ${cfg.border}`,
                borderTop: 'none', borderRight: 'none',
              }}>
                {cfg.badge}
              </div>

              {/* Box image */}
              <div style={{
                width: 88, height: 88, flexShrink: 0, position: 'relative', zIndex: 2,
                animation: `hbBob ${box.id === 'legendary' ? 2 : box.id === 'epic' ? 2.6 : 3.2}s ease-in-out infinite`,
                filter: isHovered ? `drop-shadow(0 0 16px ${cfg.accent}99)` : `drop-shadow(0 4px 12px rgba(0,0,0,0.5))`,
                transition: 'filter 0.3s ease'
              }}>
                <img src={box.img} alt={box.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>

              {/* Info + button */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, position: 'relative', zIndex: 2 }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: '#F1F5F9', letterSpacing: '-0.3px' }}>{box.name}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                    <span style={{
                      background: cfg.badgeBg, color: cfg.badgeColor,
                      border: `1px solid ${cfg.border}`,
                      padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 800
                    }}>⚡ {cfg.hp}</span>
                    {cfg.boost && (
                      <span style={{
                        background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.55)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 700
                      }}>{cfg.boost}</span>
                    )}
                  </div>
                </div>

                <button
                  className="hb-open-btn"
                  onClick={() => setSelectedBox(box)}
                  disabled={isPending || isConfirming || isOpening}
                  style={{
                    background: cfg.btnBg,
                    color: '#fff', border: 'none', borderRadius: 50,
                    padding: '9px 14px', fontSize: 11, fontWeight: 900,
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: `0 4px 16px ${cfg.btnGlow}`,
                    opacity: (isPending || isConfirming || isOpening) ? 0.5 : 1,
                    letterSpacing: '0.3px'
                  }}
                >
                  Open Box
                  <span style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 20, padding: '1px 8px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.85)' }}>
                    {box.price.toFixed(2)}
                    <img src="/usdc-logo.png" alt="USDC" style={{ width: 12, height: 12 }} />
                  </span>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ═══ HOW IT WORKS ═══ */}
      <div style={{ marginTop: 16, background: '#111214', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 20, padding: '16px 18px' }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>How it works</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            ['How do Happy Boxes work?', 'Choose a box to try your luck and win HP instantly. Each box has a different range of possible rewards.'],
            ['What can I win?', 'Every box contains HP. Epic and Legendary boxes also give you a chance to win a 2x or 5x boost.'],
            ['Are rewards guaranteed?', 'Yes, every box contains at least the minimum amount of HP shown in the description.'],
            ['How does the multiplier work?', 'If you have an active multiplier, it will be applied to your boxes. If you win a higher boost, it activates instantly and lasts 24h. Once it expires, your permanent multiplier resumes.'],
          ].map(([q, a], i) => (
            <div key={i} style={{ paddingBottom: 12, borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.8)', marginBottom: 3 }}>{q}</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, fontWeight: 500 }}>{a}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ TX MODAL ═══ */}
      {selectedBox && !isSuccess && !isOpening && (
        <TxModal
          title={`Open ${selectedBox.name}`}
          subtitle="Try your luck!"
          amount={selectedBox.price.toFixed(2)}
          isPending={isPending}
          isConfirming={isConfirming}
          isSuccess={isSuccess}
          error={writeError}
          onConfirm={handleConfirm}
          onCancel={() => { setSelectedBox(null); reset() }}
        />
      )}

      {/* ═══ OPENING ANIMATION ═══ */}
      {isOpening && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,5,10,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(12px)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{ animation: 'hbShake 0.6s infinite' }}>
              <img src={selectedBox?.img} style={{ width: 130, height: 130, objectFit: 'contain', filter: 'drop-shadow(0 0 30px rgba(255,255,255,0.4))' }} alt="" />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: 2, textTransform: 'uppercase' }}>Opening…</div>
          </div>
        </div>
      )}

      {/* ═══ RESULT MODAL ═══ */}
      {openResult && (() => {
        const cfg = BOX_CONFIG[openResult.boxId] || BOX_CONFIG.common
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(5,5,10,0.88)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(14px)' }}>
            <div style={{
              background: 'linear-gradient(160deg, #18191C 0%, #111214 100%)',
              border: `1.5px solid ${cfg.border}`,
              borderRadius: 28, padding: '36px 28px', width: '88%', maxWidth: 360,
              textAlign: 'center', animation: 'hbPop 0.5s cubic-bezier(.34,1.56,.64,1)',
              boxShadow: `0 30px 80px rgba(0,0,0,0.6), 0 0 60px ${cfg.glow}`,
              position: 'relative', overflow: 'hidden'
            }}>
              {/* Glow bg */}
              <div style={{ position: 'absolute', top: -60, left: '50%', transform: 'translateX(-50%)', width: 300, height: 200, background: cfg.glow, filter: 'blur(80px)', borderRadius: '50%', zIndex: 0 }} />

              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 56, marginBottom: 8, animation: 'hbBob 1.5s ease-in-out infinite' }}>🎉</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: cfg.badgeColor, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>{cfg.label} Box</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#F1F5F9', marginBottom: 20 }}>You Won!</div>

                <div style={{
                  fontSize: 52, fontWeight: 900, lineHeight: 1,
                  color: cfg.accent,
                  textShadow: `0 0 30px ${cfg.glow}`,
                  marginBottom: 18,
                  animation: animPhase === 3 ? 'hbCountUp 0.1s ease' : 'none'
                }}>
                  +{displayHp}
                  <span style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginLeft: 6 }}>HP</span>
                </div>

                {openResult.mult > 1 && animPhase >= 2 && (
                  <div style={{
                    display: 'inline-block',
                    background: cfg.badgeBg, color: cfg.badgeColor,
                    border: `1px solid ${cfg.border}`,
                    padding: '6px 18px', borderRadius: 50, fontSize: 13, fontWeight: 800,
                    marginBottom: 20, animation: 'hbPop 0.4s ease'
                  }}>
                    {openResult.wonNewMult ? `⭐ You won a ${openResult.mult}x Boost!` : `⭐ ${openResult.mult}x Boost Applied!`}
                  </div>
                )}

                {animPhase < 4 && openResult.mult > 1 && <div style={{ height: 43, marginBottom: 20 }} />}

                <button
                  onClick={closeResultModal}
                  disabled={animPhase < 4}
                  className="hb-open-btn"
                  style={{
                    width: '100%',
                    background: animPhase < 4 ? 'rgba(255,255,255,0.1)' : cfg.btnBg,
                    color: '#fff', border: 'none', borderRadius: 50,
                    padding: '14px', fontSize: 14, fontWeight: 800,
                    cursor: animPhase < 4 ? 'default' : 'pointer',
                    boxShadow: animPhase < 4 ? 'none' : `0 6px 20px ${cfg.btnGlow}`,
                    transition: 'all 0.3s', fontFamily: 'inherit'
                  }}
                >
                  {animPhase < 4 ? '…' : 'Awesome!'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
