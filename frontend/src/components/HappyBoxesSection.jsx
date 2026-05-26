import React, { useState, useEffect } from 'react'
import { useChainId, useSwitchChain } from 'wagmi'
import { parseUnits } from 'viem'
import { base } from 'wagmi/chains'
import { CHECKIN_TARGET, USDC_ADDRESS, USDC_ABI } from '../config/constants'
import { db } from '../config/supabase'
import { useBuilderWrite } from '../hooks/useBuilderWrite'
import { TxModal } from './TxModal'

export function HappyBoxesSection({ address, profile, onUpdate }) {
  // State for the 6 chest cells
  const [chests, setChests] = useState([
    { id: 1, status: 'locked', hp: null, mult: null },
    { id: 2, status: 'locked', hp: null, mult: null },
    { id: 3, status: 'locked', hp: null, mult: null },
    { id: 4, status: 'locked', hp: null, mult: null },
    { id: 5, status: 'locked', hp: null, mult: null },
    { id: 6, status: 'locked', hp: null, mult: null },
  ])

  // Color logic and premium styles for opened boxes
  const getOpenedCardDetails = (mult) => {
    const m = parseFloat(mult) || 1.0
    if (m >= 2.0) {
      return {
        badgeBg: 'linear-gradient(135deg, #A7F3D0 0%, #34D399 100%)', // green
        badgeColor: '#000000', // black text
        badgeText: '⚡ 2.0x Boost'
      }
    }
    if (m > 1.0) {
      return {
        badgeBg: 'linear-gradient(135deg, #FDE68A 0%, #FBBF24 100%)', // orange
        badgeColor: '#000000', // black text
        badgeText: `⚡ ${m}x Boost`
      }
    }
    return {
      badgeBg: 'linear-gradient(135deg, #E2E8F0 0%, #CBD5E1 100%)', // gray
      badgeColor: '#000000', // black text
      badgeText: '⚡ 1.0x Boost'
    }
  }

  const [hasActiveChoice, setHasActiveChoice] = useState(false)
  const [activeTxHash, setActiveTxHash] = useState(null)
  const [txModal, setTxModal] = useState(false) // 'single' | 'bundle' | false
  const [revealingIndex, setRevealingIndex] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const wrongChain = chainId !== base.id

  const { data: txHash, writeContract, isPending, isConfirming, isSuccess, error: writeError, reset } = useBuilderWrite()

  // Load user's opened chests state from DB to keep persistency across sessions
  const loadChestsState = async () => {
    if (!address) return
    try {
      // Fetch latest 6 chests opened in the current session (standard or standard_all box types)
      const { data, error } = await db
        .from('opened_boxes')
        .select('hp_won, applied_multiplier, box_type, created_at')
        .eq('address', address.toLowerCase())
        .in('box_type', ['standard', 'standard_all'])
        .order('created_at', { ascending: false })
        .limit(6)

      if (error) throw error

      if (data && data.length > 0) {
        // Map persistent opened chests to the slots
        const newChests = [...chests]
        data.forEach((box, index) => {
          if (index < 6) {
            newChests[index] = {
              id: index + 1,
              status: 'opened',
              hp: (box.hp_won * box.applied_multiplier).toFixed(1),
              mult: box.applied_multiplier
            }
          }
        })
        setChests(newChests)
      }
    } catch (err) {
      console.error('Error loading chests:', err)
    }
  }

  useEffect(() => {
    loadChestsState()
  }, [address])

  // Reset the grid board to start fresh
  const handleResetBoard = () => {
    setChests([
      { id: 1, status: 'locked', hp: null, mult: null },
      { id: 2, status: 'locked', hp: null, mult: null },
      { id: 3, status: 'locked', hp: null, mult: null },
      { id: 4, status: 'locked', hp: null, mult: null },
      { id: 5, status: 'locked', hp: null, mult: null },
      { id: 6, status: 'locked', hp: null, mult: null },
    ])
    setHasActiveChoice(false)
    setActiveTxHash(null)
    setRevealingIndex(null)
    setErrorMessage('')
    reset()
  }

  // Handle successful USDC transactions
  useEffect(() => {
    if (isSuccess && txHash) {
      if (txModal === 'single') {
        // Unlock chests for user selection
        setActiveTxHash(txHash)
        setHasActiveChoice(true)
        setChests(prev => prev.map(c => c.status === 'locked' ? { ...c, status: 'active' } : c))
        setTxModal(false)
      } else if (txModal === 'bundle') {
        // Open all 6 chests automatically
        setTxModal(false)
        handleOpenAllChests(txHash)
      }
    }
  }, [isSuccess, txHash, txModal])

  // Single chest transaction confirm
  const handleSinglePayment = () => {
    if (wrongChain) { switchChain({ chainId: base.id }); return }
    setErrorMessage('')
    writeContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [CHECKIN_TARGET, parseUnits('0.30', 6)],
      chainId: base.id
    })
  }

  // Bundle transaction confirm (Open All)
  const handleBundlePayment = () => {
    if (wrongChain) { switchChain({ chainId: base.id }); return }
    setErrorMessage('')
    writeContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [CHECKIN_TARGET, parseUnits('1.50', 6)],
      chainId: base.id
    })
  }

  // User selects an active chest to open
  const handleSelectChest = async (index) => {
    if (!hasActiveChoice || !activeTxHash || chests[index].status !== 'active') return

    setRevealingIndex(index)
    setHasActiveChoice(false) // Lock other clicks

    try {
      const { data, error } = await db.rpc('open_standard_chest', {
        p_address: address.toLowerCase(),
        p_tx_hash: activeTxHash
      })

      if (error) throw error

      if (data?.ok) {
        setChests(prev => prev.map((c, i) => i === index 
          ? { ...c, status: 'opened', hp: data.hp_won, mult: data.applied_multiplier } 
          : { ...c, status: c.status === 'active' ? 'locked' : c.status }
        ))
        if (onUpdate) onUpdate()
      } else {
        setErrorMessage(data?.error || 'Failed to open box')
        setChests(prev => prev.map(c => c.status === 'active' ? { ...c, status: 'locked' } : c))
      }
    } catch (err) {
      console.error(err)
      setErrorMessage('Something went wrong opening the box.')
      setChests(prev => prev.map(c => c.status === 'active' ? { ...c, status: 'locked' } : c))
    } finally {
      setRevealingIndex(null)
      setActiveTxHash(null)
      reset()
    }
  }

  // Open all 6 chests automatically with bundle transaction
  const handleOpenAllChests = async (hash) => {
    setErrorMessage('')
    // Set all chests to revealing status
    setRevealingIndex('all')

    try {
      const { data, error } = await db.rpc('open_all_chests', {
        p_address: address.toLowerCase(),
        p_tx_hash: hash
      })

      if (error) throw error

      if (data?.ok && data.rewards) {
        // Stagger reveal of chests for a premium feel
        const rewards = data.rewards
        const newChests = [...chests]
        
        for (let i = 0; i < 6; i++) {
          const rewardObj = rewards.find(r => r.index === i + 1)
          newChests[i] = {
            id: i + 1,
            status: 'opened',
            hp: rewardObj ? rewardObj.hp_won : 0,
            mult: rewardObj ? rewardObj.applied_multiplier : 1.0
          }
          // Delay each slot update by 120ms
          await new Promise(r => setTimeout(r, 120))
          setChests([...newChests])
        }

        if (onUpdate) onUpdate()
      } else {
        setErrorMessage(data?.error || 'Failed to open all boxes')
      }
    } catch (err) {
      console.error(err)
      setErrorMessage('Something went wrong opening all boxes.')
    } finally {
      setRevealingIndex(null)
      reset()
    }
  }

  const allOpened = chests.every(c => c.status === 'opened')
  const anyOpened = chests.some(c => c.status === 'opened')

  return (
    <div style={{ padding: '0 16px 120px', animation: 'hbFadeIn 0.4s ease' }}>
      <style>{`
        @keyframes hbFadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes hbBob { 0%,100% { transform:translateY(0) scale(1); } 50% { transform:translateY(-5px) scale(1.05); } }
        @keyframes hbPulseGlow { 0%,100% { box-shadow: 0 0 12px rgba(139,92,246,0.15); } 50% { box-shadow: 0 0 24px rgba(139,92,246,0.4); } }
        @keyframes hbGiftFloat { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        @keyframes hbPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes hbActivePulse { 
          0%, 100% { border-color: rgba(139,92,246,0.6); box-shadow: 0 0 8px rgba(139,92,246,0.25); } 
          50% { border-color: rgba(139,92,246,1); box-shadow: 0 0 20px rgba(139,92,246,0.5); } 
        }
        .chest-slot { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); position: relative; }
        .chest-slot:hover { transform: translateY(-3px); }
        .chest-btn { transition: all 0.2s ease; }
        .chest-btn:hover { filter: brightness(1.05); transform: scale(1.01); }
        .chest-btn:active { transform: scale(0.98); }
        
        .card-inner {
          transform-style: preserve-3d;
          transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .card-inner.flipped {
          transform: rotateY(180deg);
        }
        .card-face {
          backface-visibility: hidden;
        }
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
        background: '#090514',
        borderRadius: 24,
        padding: '22px 20px',
        marginBottom: 16,
        position: 'relative',
        minHeight: 144,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        boxShadow: '0 8px 32px rgba(46,16,101,0.3)',
        overflow: 'hidden',
        border: '1px solid rgba(139,92,246,0.2)'
      }}>
        {/* Branded background banner in purple tones */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/banner.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'hue-rotate(50deg) brightness(0.6) contrast(1.15)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(9, 5, 20, 0.25) 0%, rgba(46, 16, 101, 0.7) 100%)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />

        {/* Glow overlay */}
        <div style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: '180px',
          height: '180px',
          background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />

        {/* Floating gift background decorations */}
        {[
          { top: '-5px', left: '5%', size: 54, opacity: 0.14, r: '-12deg', blur: 0.5, dur: 4.2 },
          { top: '10px', right: '25%', size: 40, opacity: 0.11, r: '14deg', blur: 0, dur: 4.8 },
          { bottom: '5px', left: '40%', size: 48, opacity: 0.12, r: '22deg', blur: 1, dur: 5.4 },
          { bottom: '15px', right: '5%', size: 62, opacity: 0.16, r: '8deg', blur: 1.2, dur: 4.6 }
        ].map((s, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: s.top,
            right: s.right,
            left: s.left,
            bottom: s.bottom,
            zIndex: 1,
            pointerEvents: 'none',
            userSelect: 'none',
            animation: `hbGiftFloat ${s.dur}s ease-in-out infinite`,
          }}>
            <div style={{
              fontSize: `${s.size}px`,
              opacity: s.opacity,
              filter: s.blur > 0 ? `blur(${s.blur}px) drop-shadow(0 0 10px rgba(139,92,246,0.25))` : 'drop-shadow(0 0 10px rgba(139,92,246,0.25))',
              transform: `rotate(${s.r})`,
            }}>
              🎁
            </div>
          </div>
        ))}

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'flex-start' }}>
          <div style={{
            fontSize: '26px',
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '0.5px',
            marginBottom: '4px'
          }}>
            Happy Boxes
          </div>
          
          <div style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.75)',
            marginTop: '8px',
            letterSpacing: '0.1px',
            fontWeight: 500,
            lineHeight: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '6px', color: '#8B5CF6' }}>●</span>
              <span>Each box contains from 2 to 20 HP.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '6px', color: '#8B5CF6' }}>●</span>
              <span>Your boost is automatically applied.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status Banner */}
      {hasActiveChoice && (
        <div style={{
          background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
          color: '#fff',
          borderRadius: 16,
          padding: '12px 16px',
          marginBottom: 16,
          textAlign: 'center',
          fontSize: 12,
          fontWeight: 800,
          boxShadow: '0 4px 16px rgba(139,92,246,0.3)',
          animation: 'hbFadeIn 0.3s ease, hbPulseGlow 2s infinite'
        }}>
          🎉 Payment Confirmed! Tap any box below to reveal your reward!
        </div>
      )}

      {errorMessage && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 16, padding: '12px 16px', marginBottom: 16, fontSize: 11, color: '#DC2626', fontWeight: 700, textAlign: 'center' }}>
          ⚠️ {errorMessage}
        </div>
      )}

      {/* ═══ CHESTS 3x2 GRID ═══ */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        marginBottom: 20
      }}>
        {chests.map((chest, index) => {
          const isRevealing = revealingIndex === index || revealingIndex === 'all'
          const details = chest.status === 'opened' ? getOpenedCardDetails(chest.mult) : null
          const anyOpened = chests.some(c => c.status === 'opened')
          
          let imageFilter = 'drop-shadow(0 6px 12px rgba(139,92,246,0.15))'
          let imageOpacity = 1

          if (chest.status === 'locked') {
            if (anyOpened) {
              imageFilter = 'blur(4px) grayscale(30%) drop-shadow(0 4px 10px rgba(0,0,0,0.1))'
              imageOpacity = 0.35
            } else {
              imageFilter = 'grayscale(15%) brightness(0.95) drop-shadow(0 4px 8px rgba(0,0,0,0.08))'
              imageOpacity = 0.8
            }
          }
          
          return (
            <div
              key={chest.id}
              onClick={() => {
                if (chest.status === 'active') {
                  handleSelectChest(index)
                } else if (chest.status === 'locked' && !hasActiveChoice && !allOpened) {
                  // Direct click triggers single box payment
                  setTxModal('single')
                }
              }}
              className="chest-slot"
              style={{
                aspectRatio: '1',
                position: 'relative',
                perspective: '1000px',
                cursor: (chest.status === 'active' || (chest.status === 'locked' && !hasActiveChoice && !allOpened)) ? 'pointer' : 'default',
                opacity: (hasActiveChoice && chest.status !== 'active' && chest.status !== 'opened') ? 0.45 : 1,
              }}
            >
              <div 
                className={`card-inner ${chest.status === 'opened' ? 'flipped' : ''}`}
                style={{
                  width: '100%',
                  height: '100%',
                  position: 'relative',
                  transformStyle: 'preserve-3d',
                  transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              >
                {/* ─── FRONT FACE ─── */}
                <div 
                  className="card-face card-front"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backfaceVisibility: 'hidden',
                    borderRadius: 22,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    background: chest.status === 'active'
                      ? 'linear-gradient(135deg, #FFFFFF 0%, #F5F3FF 100%)'
                      : 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)',
                    border: chest.status === 'active'
                      ? '2.5px solid #8B5CF6'
                      : '1.5px dashed #CBD5E1',
                    boxShadow: chest.status === 'active'
                      ? '0 8px 24px rgba(139,92,246,0.22)'
                      : '0 4px 10px rgba(0,0,0,0.01)',
                    animation: chest.status === 'active' ? 'hbBob 1.6s ease-in-out infinite, hbActivePulse 2s infinite' : 'none',
                    transform: chest.status === 'active' ? 'scale(1.02)' : 'none',
                    zIndex: 2
                  }}
                >
                  {isRevealing ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 24, height: 24,
                        border: '3px solid #E2E8F0',
                        borderTop: '3px solid #8B5CF6',
                        borderRadius: '50%',
                        animation: 'spin 0.8s linear infinite'
                      }} />
                      <span style={{ fontSize: 8, fontWeight: 900, color: '#6D28D9', textTransform: 'uppercase', letterSpacing: 0.5 }}>Opening...</span>
                    </div>
                  ) : (
                    <>
                      <img
                        src="/box2.png"
                        alt="Happy Box"
                        style={{
                          width: '84%',
                          height: '84%',
                          objectFit: 'contain',
                          filter: imageFilter,
                          opacity: imageOpacity,
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        }}
                      />
                      
                      {/* Blinking "Tap to Open" helper tag for active chests */}
                      {chest.status === 'active' && (
                        <div style={{
                          position: 'absolute',
                          bottom: 8,
                          background: 'rgba(139, 92, 246, 0.1)',
                          color: '#8B5CF6',
                          border: '1px solid rgba(139, 92, 246, 0.3)',
                          borderRadius: 20,
                          padding: '2px 8px',
                          fontSize: 7.5,
                          fontWeight: 900,
                          letterSpacing: '0.5px',
                          textTransform: 'uppercase',
                          animation: 'hbPulse 1.5s infinite'
                        }}>
                          ✨ Tap to Open
                        </div>
                      )}

                      {chest.status === 'locked' && !hasActiveChoice && (
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          background: 'linear-gradient(135deg, #0052FF 0%, #003CC0 100%)',
                          color: '#ffffff',
                          borderRadius: 20,
                          padding: '6px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          boxShadow: '0 8px 20px rgba(0,82,255,0.3)',
                          fontSize: 9,
                          fontWeight: 900,
                          letterSpacing: '0.2px',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                          zIndex: 10,
                          whiteSpace: 'nowrap'
                        }}>
                          Open 0.30 <img src="/usdc-logo.png" alt="USDC" style={{ width: 10, height: 10, borderRadius: '50%' }} />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ─── BACK FACE ─── */}
                <div 
                  className="card-face card-back"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backfaceVisibility: 'hidden',
                    borderRadius: 22,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    transform: 'rotateY(180deg)',
                    background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
                    border: '1.5px solid #C7D2FE',
                    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.08)',
                    zIndex: 1
                  }}
                >
                  {chest.status === 'opened' && details && (
                    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', position: 'relative' }}>
                      
                      {/* Confetti / Sparkle background decoration */}
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        opacity: 0.15,
                        pointerEvents: 'none',
                        backgroundImage: 'radial-gradient(circle, #C7D2FE 1.5px, transparent 1.5px)',
                        backgroundSize: '12px 12px'
                      }} />

                      {/* Multiplier badge — floating top center */}
                      {chest.mult && parseFloat(chest.mult) > 0 && (
                        <div style={{
                          position: 'absolute',
                          top: 8,
                          background: details.badgeBg,
                          color: details.badgeColor,
                          padding: '2.5px 10px',
                          borderRadius: 20,
                          fontSize: 8,
                          fontWeight: 900,
                          letterSpacing: '0.2px',
                          textTransform: 'uppercase',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                          zIndex: 5,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2
                        }}>
                          {details.badgeText}
                        </div>
                      )}

                      {/* HP reward — large centered with unit */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, marginTop: 12 }}>
                        <div style={{
                          fontSize: 32,
                          fontWeight: 950,
                          fontFamily: "'Outfit', 'Inter', sans-serif",
                          letterSpacing: '-1.5px',
                          lineHeight: 1,
                          background: 'linear-gradient(135deg, #0052FF 0%, #4F46E5 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent'
                        }}>
                          {chest.hp}
                        </div>
                        <div style={{
                          fontSize: 8,
                          fontWeight: 900,
                          color: '#4F46E5',
                          opacity: 0.8,
                          letterSpacing: '1px',
                          marginTop: 4,
                          textTransform: 'uppercase'
                        }}>
                          HP Points
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ═══ BUTTONS ═══ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {allOpened ? (
          <button
            className="chest-btn"
            onClick={handleResetBoard}
            style={{
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 50,
              padding: '14px 20px',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6
            }}
          >
            🔄 Reset Board & Play Again
          </button>
        ) : (
          <>
            {/* Main Single Open Button */}
            <button
              className="chest-btn"
              onClick={() => setTxModal('single')}
              disabled={isPending || isConfirming || hasActiveChoice || revealingIndex !== null}
              style={{
                background: 'linear-gradient(135deg, #0000FF 0%, #0000D0 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 50,
                padding: '14px 20px',
                fontSize: 13,
                fontWeight: 900,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: '0 4px 16px rgba(0,0,255,0.25)',
                opacity: (isPending || isConfirming || hasActiveChoice || revealingIndex !== null) ? 0.5 : 1
              }}
            >
              Open Box 0.30
              <img src="/usdc-logo.png" alt="USDC" style={{ width: 15, height: 15, flexShrink: 0, borderRadius: '50%' }} />
            </button>

            {/* Bundle Open All Button */}
            <button
              className="chest-btn"
              onClick={() => setTxModal('bundle')}
              disabled={isPending || isConfirming || hasActiveChoice || revealingIndex !== null || anyOpened}
              style={{
                background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 50,
                padding: '14px 20px',
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: '0 4px 16px rgba(139,92,246,0.3)',
                opacity: (isPending || isConfirming || hasActiveChoice || revealingIndex !== null || anyOpened) ? 0.4 : 1
              }}
            >
              ✨ Open All 6 boxes for 1.50
              <img src="/usdc-logo.png" alt="USDC" style={{ width: 15, height: 15, flexShrink: 0, borderRadius: '50%' }} />
              <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 20, fontWeight: 900, color: '#FCD34D' }}>
                1 FREE BOX!
              </span>
            </button>
          </>
        )}

        {/* Board Reset option if partially played */}
        {anyOpened && !allOpened && !hasActiveChoice && (
          <button
            onClick={handleResetBoard}
            style={{
              background: 'none',
              border: '1px solid #DEE1E7',
              color: '#717886',
              borderRadius: 50,
              padding: '6px 14px',
              fontSize: 10,
              fontWeight: 800,
              cursor: 'pointer',
              alignSelf: 'center',
              marginTop: 10
            }}
          >
            Clear & Reset Board
          </button>
        )}
      </div>



      {/* ═══ TX MODAL ═══ */}
      {txModal && (
        <TxModal
          title={txModal === 'single' ? 'Open Box' : 'Open All 6 Boxes'}
          subtitle={txModal === 'single' ? 'Pick a box to reveal your reward!' : 'Unlock all 6 boxes instantly with 1 box FREE!'}
          amount={txModal === 'single' ? '0.30' : '1.50'}
          isPending={isPending}
          isConfirming={isConfirming}
          isSuccess={isSuccess}
          error={writeError}
          onConfirm={txModal === 'single' ? handleSinglePayment : handleBundlePayment}
          onCancel={() => { setTxModal(false); reset() }}
        />
      )}

      {/* Spin style */}
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
