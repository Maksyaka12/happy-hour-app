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
    glow: 'rgba(107,114,128,0.15)',
    border: '#DEE1E7',
    cardBg: '#ffffff',
    cardBgHover: '#F8FAFC',
    btnBg: 'linear-gradient(135deg, #4B5563, #374151)',
    btnGlow: 'rgba(75,85,99,0.3)',
    badgeBg: '#F1F5F9',
    badgeColor: '#6B7280',
    tagBg: '#F1F5F9',
    tagColor: '#6B7280',
    tagBorder: '#E2E8F0',
    hpColor: '#374151',
  },
  epic: {
    label: 'Epic',
    badge: 'HOT 🔥',
    hp: '10 – 20 HP',
    boost: '+ Chance for 2x Boost',
    accent: '#8B5CF6',
    glow: 'rgba(139,92,246,0.12)',
    border: '#DDD6FE',
    cardBg: '#FAFAFF',
    cardBgHover: '#F5F3FF',
    btnBg: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
    btnGlow: 'rgba(139,92,246,0.35)',
    badgeBg: '#EDE9FE',
    badgeColor: '#7C3AED',
    tagBg: '#EDE9FE',
    tagColor: '#7C3AED',
    tagBorder: '#DDD6FE',
    hpColor: '#6D28D9',
  },
  legendary: {
    label: 'Legendary',
    badge: '⚡ JACKPOT',
    hp: '21 – 40 HP',
    boost: '+ Chance for 5x Boost',
    accent: '#D97706',
    glow: 'rgba(217,119,6,0.12)',
    border: '#FDE68A',
    cardBg: '#FFFDF5',
    cardBgHover: '#FFFBEB',
    btnBg: 'linear-gradient(135deg, #D97706, #B45309)',
    btnGlow: 'rgba(217,119,6,0.4)',
    badgeBg: '#FEF3C7',
    badgeColor: '#B45309',
    tagBg: '#FEF3C7',
    tagColor: '#B45309',
    tagBorder: '#FDE68A',
    hpColor: '#B45309',
  },
}

const CINEMA = {
  common:    { bg:'radial-gradient(ellipse at center,#2D3748 0%,#0D1117 100%)', particle:['⚡','💫','✨','⚪'], flash:'rgba(209,213,219,0.9)',  glow:'#94A3B8', shake:'hbShakeS' },
  epic:      { bg:'radial-gradient(ellipse at center,#4C1D95 0%,#1E1B4B 100%)', particle:['✨','⭐','💜','🔮'], flash:'rgba(167,139,250,0.95)', glow:'#A78BFA', shake:'hbShakeM' },
  legendary: { bg:'radial-gradient(ellipse at center,#92400E 0%,#1C0A00 100%)', particle:['⭐','🌟','💰','✨','👑','🏆'], flash:'rgba(252,211,77,0.97)', glow:'#FCD34D', shake:'hbShakeL' },
}

export function HappyBoxesSection({ address, profile, onUpdate }) {
  const [selectedBox, setSelectedBox] = useState(null)
  const [isOpening, setIsOpening] = useState(false)
  const [hoveredBox, setHoveredBox] = useState(null)
  const [openAnimPhase, setOpenAnimPhase] = useState(0) // 0=shake 1=zoom 2=flash/open 3=hp-reveal
  const [pendingResult, setPendingResult] = useState(null) // holds RPC result during animation
  const [countDisplayHp, setCountDisplayHp] = useState(0)
  const [showAwesome, setShowAwesome] = useState(false)
  const [showBoostText, setShowBoostText] = useState(false)

  useEffect(() => {
    if (!isOpening) { setOpenAnimPhase(0); return }
    setOpenAnimPhase(0)
    const t1 = setTimeout(() => setOpenAnimPhase(2), 3500)  // shake for 3.5s then flash
    const t2 = setTimeout(() => setOpenAnimPhase(3), 4200)  // reward reveals
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [isOpening])

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
        setShowAwesome(false)
        setShowBoostText(false)
        setCountDisplayHp(0)

        try {
          // Start RPC and animation simultaneously
          const rpcCall = db.rpc('open_happy_box', {
            p_address: address.toLowerCase(),
            p_box_type: selectedBox.id,
            p_tx_hash: txHash
          })

          // Wait for phases 0+1+2 to play (4s), then await RPC
          await new Promise(r => setTimeout(r, 4000))
          const { data, error } = await rpcCall
          if (error) throw error
          
          if (data?.ok) {
            const baseHp = Math.round(data.hp_won / data.applied_multiplier)
            const result = { 
              hp: data.hp_won, 
              mult: data.applied_multiplier, 
              wonNewMult: data.multiplier_won > 1, 
              baseHp, 
              boxId: selectedBox.id 
            }
            
            setPendingResult(result)
            setCountDisplayHp(baseHp)
            if (onUpdate) onUpdate()

            // If there's a boost, wait then count up
            if (result.mult > 1) {
              await new Promise(r => setTimeout(r, 1200)) // pause on base hp
              setShowBoostText(true)
              await new Promise(r => setTimeout(r, 800)) // let boost text sink in
              
              // Count up animation
              const target = result.hp
              const duration = 2000 // slower count up
              const start = Date.now()
              await new Promise(resolve => {
                const timer = setInterval(() => {
                  const timePassed = Date.now() - start
                  if (timePassed >= duration) {
                    setCountDisplayHp(target)
                    clearInterval(timer)
                    resolve()
                  } else {
                    const p = timePassed / duration
                    setCountDisplayHp(Math.round(baseHp + (target - baseHp) * (1 - (1 - p) * (1 - p))))
                  }
                }, 16)
              })
            }
            
            await new Promise(r => setTimeout(r, 600))
            setShowAwesome(true)
          } else {
            alert(data?.error || 'Failed to open box')
            setIsOpening(false)
            setSelectedBox(null)
            reset()
          }
        } catch (err) {
          console.error(err)
          alert('Something went wrong opening the box.')
          setIsOpening(false)
          setSelectedBox(null)
          reset()
        }
      }
    }
    processBox()
  }, [isSuccess, txHash, selectedBox, address, onUpdate, reset, isOpening])

  const handleConfirm = () => {
    if (wrongChain) { switchChain({ chainId: base.id }); return }
    if (!selectedBox) return
    writeContract({ address: USDC_ADDRESS, abi: USDC_ABI, functionName: 'transfer', args: [CHECKIN_TARGET, parseUnits(selectedBox.price.toString(), 6)], chainId: base.id })
  }

  const closeAll = () => {
    setIsOpening(false)
    setPendingResult(null)
    setShowAwesome(false)
    setShowBoostText(false)
    setCountDisplayHp(0)
    setSelectedBox(null)
    reset()
  }

  return (
    <div style={{ padding: '0 16px 120px', animation: 'hbFadeIn 0.4s ease' }}>
      <style>{`
        @keyframes hbFadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes hbBob { 0%,100% { transform:translateY(0) scale(1); } 50% { transform:translateY(-8px) scale(1.03); } }
        @keyframes hbShake { 0%,100%{transform:rotate(0) scale(1)} 20%{transform:rotate(-9deg) scale(1.12)} 40%{transform:rotate(9deg) scale(1.15)} 60%{transform:rotate(-7deg) scale(1.12)} 80%{transform:rotate(7deg) scale(1.08)} }
        @keyframes hbPop { 0%{transform:scale(0.7);opacity:0} 70%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
        @keyframes hbFloat { 0%,100%{transform:translateY(0) rotate(var(--r,0deg))} 50%{transform:translateY(-10px) rotate(var(--r,0deg))} }
        @keyframes hbShakeS { 0%,100%{transform:translate(0,0)} 25%{transform:translate(-5px,3px) rotate(-2deg)} 75%{transform:translate(5px,-3px) rotate(2deg)} }
        @keyframes hbShakeM { 0%,100%{transform:translate(0,0) rotate(0)} 20%{transform:translate(-9px,6px) rotate(-5deg)} 50%{transform:translate(9px,-8px) rotate(5deg)} 80%{transform:translate(-7px,7px) rotate(-3deg)} }
        @keyframes hbShakeL { 0%,100%{transform:translate(0,0) rotate(0)} 12%{transform:translate(-14px,10px) rotate(-7deg)} 32%{transform:translate(14px,-12px) rotate(7deg)} 52%{transform:translate(-12px,14px) rotate(-6deg)} 72%{transform:translate(12px,-10px) rotate(6deg)} 90%{transform:translate(-8px,6px) rotate(-4deg)} }
        @keyframes hbZoomBox { from{transform:scale(1)} to{transform:scale(3.2) } }
        @keyframes hbFlashOut { 0%{opacity:0} 25%{opacity:1} 100%{opacity:0} }
        @keyframes hbPBurst { from{opacity:1;transform:translate(0,0) scale(1.2)} to{opacity:0;transform:translate(var(--px),var(--py)) scale(0.1)} }
        @keyframes hbBgIn { from{opacity:0} to{opacity:1} }
        @keyframes hbGlowPulse { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.15)} }
        @keyframes hbBoxExplode { 0%{transform:scale(2.8) rotate(0deg);opacity:1} 60%{transform:scale(3.8) rotate(-8deg);opacity:0.5} 100%{transform:scale(5) rotate(8deg);opacity:0} }
        @keyframes hbHpSlam { 0%{opacity:0;transform:scale(0.1) translateY(80px)} 55%{transform:scale(1.25) translateY(-20px)} 75%{transform:scale(0.92) translateY(8px)} 100%{opacity:1;transform:scale(1) translateY(0)} }
        .hb-card { transition: transform 0.25s cubic-bezier(.34,1.56,.64,1), box-shadow 0.25s ease, border-color 0.25s ease, background 0.25s ease; cursor: pointer; }
        .hb-card:hover { transform: translateY(-3px) scale(1.01); }
        .hb-card:active { transform: scale(0.98); }
        .hb-open-btn { transition: all 0.2s ease; }
        .hb-open-btn:hover { filter: brightness(1.1); transform: scale(1.02); }
        .hb-open-btn:active { transform: scale(0.97); }
      `}</style>

      {/* Wrong Chain Banner */}
      {wrongChain && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#D97706', fontWeight: 700 }}>⚠ Switch to Base Mainnet</span>
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
        position: 'relative', overflow: 'hidden', minHeight: 148,
        boxShadow: '0 16px 48px rgba(0,0,255,0.28), 0 0 0 1px rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center'
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(0,0,60,0.55) 0%, rgba(0,0,0,0.65) 100%)', zIndex: 0 }} />

        {/* Floating parachute boxes with HP label */}
        {[
          { top: -8,  right: '8%',  w: 68, o: 0.55, r: '-14deg', blur: 1.5, dur: 2.5 },
          { top: 35,  right: '26%', w: 48, o: 0.38, r: '10deg',  blur: 0.5, dur: 2.9 },
          { top: -18, left: '48%',  w: 44, o: 0.45, r: '22deg',  blur: 1,   dur: 3.3 },
          { bottom: -10, right: '3%', w: 58, o: 0.38, r: '4deg', blur: 1.2, dur: 2.7 },
          { bottom: -8, right: '38%', w: 82, o: 0.25, r: '-22deg', blur: 3, dur: 3.6 },
        ].map((s, i) => (
          <div key={i} style={{
            position: 'absolute', top: s.top, right: s.right, left: s.left, bottom: s.bottom,
            width: s.w, opacity: s.o, zIndex: 1,
            animation: `hbFloat ${s.dur}s ease-in-out infinite`,
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
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, background: 'rgba(100,100,255,0.15)', borderRadius: '50%', filter: 'blur(70px)', zIndex: 1 }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', lineHeight: 1.1, textShadow: '0 4px 20px rgba(0,0,0,0.7)', letterSpacing: '-0.5px' }}>
            Open Your Happy Boxes
          </div>
          <div style={{ fontSize: 15, color: '#F59E0B', fontWeight: 800, marginTop: 7, textShadow: '0 2px 12px rgba(0,0,0,0.6)', letterSpacing: '0.1px' }}>
            to win HP and Boosts
          </div>
        </div>
      </div>

      {/* ═══ BOX CARDS (Light Premium) ═══ */}
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
                background: isHovered ? cfg.cardBgHover : cfg.cardBg,
                border: `1.5px solid ${isHovered ? cfg.accent : cfg.border}`,
                borderRadius: 22,
                padding: '14px',
                boxShadow: isHovered
                  ? `0 8px 32px ${cfg.glow}, 0 0 0 1px ${cfg.accent}30`
                  : '0 2px 12px rgba(10,11,13,0.06)',
                display: 'flex', alignItems: 'center', gap: 14,
                position: 'relative', overflow: 'hidden',
              }}
            >
              {/* Subtle inner glow on hover */}
              {isHovered && (
                <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 30% 50%, ${cfg.glow} 0%, transparent 65%)`, zIndex: 0, pointerEvents: 'none' }} />
              )}

              {/* Tier badge */}
              <div style={{
                position: 'absolute', top: 0, right: 0,
                background: cfg.badgeBg, color: cfg.badgeColor,
                fontSize: 8, fontWeight: 900,
                padding: '4px 10px', borderBottomLeftRadius: 12,
                letterSpacing: '0.5px', zIndex: 3,
                border: `1px solid ${cfg.tagBorder}`,
                borderTop: 'none', borderRight: 'none',
              }}>
                {cfg.badge}
              </div>

              {/* Box image */}
              <div style={{
                width: 90,
                height: 90,
                flexShrink: 0, position: 'relative', zIndex: 2,
                animation: `hbBob ${box.id === 'legendary' ? 2 : box.id === 'epic' ? 2.6 : 3.2}s ease-in-out infinite`,
                filter: isHovered
                  ? `drop-shadow(0 0 14px ${cfg.accent}88)`
                  : 'drop-shadow(0 4px 10px rgba(0,0,0,0.15))',
                transition: 'filter 0.3s ease'
              }}>
                <img
                  src={box.img}
                  alt={box.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    transform: box.id === 'epic' ? 'scale(1.2)' : 'scale(1)'
                  }}
                />
              </div>

              {/* Info + button */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7, position: 'relative', zIndex: 2 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#0A0B0D', letterSpacing: '-0.2px' }}>{box.name}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                    <span style={{
                      background: cfg.tagBg, color: cfg.tagColor,
                      border: `1px solid ${cfg.tagBorder}`,
                      padding: '2px 8px', borderRadius: 20, fontSize: 9, fontWeight: 800
                    }}>⚡ {cfg.hp}</span>
                    {cfg.boost && (
                      <span style={{
                        background: '#F8FAFC', color: '#64748B',
                        border: '1px solid #E2E8F0',
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
                  <span style={{ background: 'rgba(0,0,0,0.18)', borderRadius: 20, padding: '1px 8px', fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, color: 'rgba(255,255,255,0.9)' }}>
                    {box.price.toFixed(2)}
                    <img src="/usdc-logo.png" alt="USDC" style={{ width: 12, height: 12 }} />
                  </span>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ═══ HOW IT WORKS (Light) ═══ */}
      <div style={{ marginTop: 16, background: '#F8FAFC', border: '1px solid #DEE1E7', borderRadius: 20, padding: '16px 18px' }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: '#94A3B8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>How it works</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            ['How do Happy Boxes work?', 'Choose a box to try your luck and win HP instantly. Each box has a different range of possible rewards.'],
            ['What can I win?', 'Every box contains HP. Epic and Legendary boxes also give you a chance to win a 2x or 5x boost.'],
            ['Are rewards guaranteed?', 'Yes, every box contains at least the minimum amount of HP shown in the description.'],
            ['How does the multiplier work?', 'If you have an active multiplier, it will be applied to your boxes. If you win a higher boost, it activates instantly and lasts 24h. Once it expires, your permanent multiplier resumes.'],
          ].map(([q, a], i) => (
            <div key={i} style={{ paddingBottom: 12, borderBottom: i < 3 ? '1px solid #F1F5F9' : 'none' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#0A0B0D', marginBottom: 3 }}>{q}</div>
              <div style={{ fontSize: 10, color: '#64748B', lineHeight: 1.6, fontWeight: 500 }}>{a}</div>
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

      {/* ═══ CINEMATIC OPENING ═══ */}
      {isOpening && selectedBox && (() => {
        const c = CINEMA[selectedBox.id]
        return (
          <div style={{ position:'fixed', inset:0, zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(14px)', overflow:'hidden' }}>
            {/* Dark base */}
            <div style={{ position:'absolute', inset:0, background:'rgba(5,5,10,0.9)', animation:'hbBgIn 0.3s ease' }} />
            {/* Tier color bg */}
            <div style={{ position:'absolute', inset:0, background:c.bg, opacity:0.8, animation:'hbBgIn 0.6s ease' }} />
            {/* Ambient pulsing orb */}
            <div style={{ position:'absolute', width:360, height:360, borderRadius:'50%', background:`radial-gradient(circle, ${c.glow}66 0%, transparent 65%)`, animation:'hbGlowPulse 1.5s ease-in-out infinite', zIndex:1 }} />

            {/* Phase 2: flash */}
            {openAnimPhase >= 2 && (
              <div style={{ position:'absolute', inset:0, background:c.flash, animation:'hbFlashOut 0.8s ease forwards', zIndex:5, pointerEvents:'none' }} />
            )}

            {/* Main content area */}
            <div style={{ position:'relative', zIndex:3, display:'flex', flexDirection:'column', alignItems:'center', gap:24 }}>

              {/* Phase 0 & 1: box shakes */}
              {openAnimPhase < 2 && (
                <>
                  <div style={{
                    filter: `drop-shadow(0 0 24px ${c.glow})`,
                    animation: `${c.shake} 0.3s infinite`,
                    transition: 'filter 0.5s ease'
                  }}>
                    <img src={selectedBox.img} style={{ width:140, height:140, objectFit:'contain', mixBlendMode:'multiply' }} alt="" />
                  </div>
                  <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', letterSpacing:3, textTransform:'uppercase' }}>
                    Opening...
                  </div>
                </>
              )}

              {/* Phase 2: box exploding — just flash, no content */}

              {/* Phase 3: HP slams out of opened box */}
              {openAnimPhase >= 3 && (
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', animation:'hbHpSlam 0.7s cubic-bezier(.34,1.56,.64,1) forwards' }}>
                  <div style={{ display:'flex', alignItems:'baseline', gap:12 }}>
                    <div style={{
                      fontSize: 94, fontWeight: 940, lineHeight: 1,
                      color: c.glow,
                      textShadow: `0 0 40px ${c.glow}, 0 0 80px ${c.flash}`,
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '-2px'
                    }}>
                      {pendingResult ? `+${countDisplayHp}` : '...'}
                    </div>
                    <div style={{ fontSize: 32, fontWeight: 900, color: 'rgba(255,255,255,0.7)', letterSpacing: 1, textShadow: `0 0 20px ${c.glow}` }}>HP</div>
                  </div>
                  
                  {showBoostText && pendingResult?.mult > 1 && (
                    <div style={{ marginTop:16, fontSize:13, fontWeight:800, color:c.glow, background:`${c.glow}22`, border:`1px solid ${c.glow}55`, borderRadius:50, padding:'6px 18px', display:'inline-block', animation:'hbFadeIn 0.5s both' }}>
                      {pendingResult.wonNewMult ? `x${pendingResult.mult} Boost won!` : `x${pendingResult.mult} Boost active!`}
                    </div>
                  )}

                  {showAwesome && (
                    <div style={{ marginTop: 32, animation: 'hbFadeIn 0.5s ease both' }}>
                      <button
                        onClick={closeAll}
                        className="hb-open-btn"
                        style={{
                          background: c.btnBg,
                          color: '#fff', border: 'none', borderRadius: 50,
                          padding: '12px 32px', fontSize: 16, fontWeight: 900,
                          cursor: 'pointer', fontFamily: 'inherit',
                          boxShadow: `0 8px 24px ${c.btnGlow}`,
                        }}
                      >
                        Awesome!
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
