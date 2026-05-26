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

  // Color logic for multiplier badges (matches ProfileSection boost colors)
  const getMultBadgeStyle = (mult) => {
    const m = parseFloat(mult) || 1.0
    if (m >= 2.0) return { background: 'linear-gradient(135deg, #34D399, #059669)', color: '#000' }
    if (m > 1.0) return { background: 'linear-gradient(135deg, #F4C81B, #F97316)', color: '#000' }
    return { background: 'linear-gradient(135deg, #94A3B8, #64748B)', color: '#000' }
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
        setErrorMessage(data?.error || 'Failed to open chest')
        setChests(prev => prev.map(c => c.status === 'active' ? { ...c, status: 'locked' } : c))
      }
    } catch (err) {
      console.error(err)
      setErrorMessage('Something went wrong opening the chest.')
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
        setErrorMessage(data?.error || 'Failed to open all chests')
      }
    } catch (err) {
      console.error(err)
      setErrorMessage('Something went wrong opening all chests.')
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
        .chest-slot { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); position: relative; }
        .chest-slot:hover { transform: translateY(-2px); }
        .chest-btn { transition: all 0.2s ease; }
        .chest-btn:hover { filter: brightness(1.05); transform: scale(1.01); }
        .chest-btn:active { transform: scale(0.98); }
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
        position: 'relative', overflow: 'hidden', minHeight: 120,
        boxShadow: '0 16px 48px rgba(0,0,255,0.15), 0 0 0 1px rgba(255,255,255,0.1)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center'
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, rgba(0,0,60,0.3) 0%, rgba(0,0,0,0.5) 100%)', zIndex: 0 }} />
        
        {/* Ambient glow */}
        <div style={{ position: 'absolute', top: -30, right: -30, width: 160, height: 160, background: 'rgba(100,100,255,0.2)', borderRadius: '50%', filter: 'blur(50px)', zIndex: 1 }} />

        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', lineHeight: 1.1, textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
            Happy Boxes
          </div>
          <div style={{ fontSize: 13, color: '#10B981', fontWeight: 800, marginTop: 4, textShadow: '0 1px 8px rgba(0,0,0,0.4)' }}>
            Open chests to win massive HP rewards
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
          🎉 Payment Confirmed! Tap any chest below to reveal your reward!
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
                borderRadius: 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                userSelect: 'none',
                // Styles based on status
                background: chest.status === 'opened'
                  ? 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)'
                  : chest.status === 'active'
                    ? '#ffffff'
                    : '#F8FAFC',
                border: chest.status === 'opened'
                  ? '1.5px solid #C7D2FE'
                  : chest.status === 'active'
                    ? '2.5px solid #8B5CF6'
                    : '1px dashed #CBD5E1',
                boxShadow: chest.status === 'active'
                  ? '0 8px 24px rgba(139,92,246,0.18)'
                  : chest.status === 'opened'
                    ? '0 4px 12px rgba(0,0,255,0.03)'
                    : 'none',
                cursor: (chest.status === 'active' || (chest.status === 'locked' && !hasActiveChoice && !allOpened)) ? 'pointer' : 'default',
                animation: chest.status === 'active' ? 'hbBob 1.6s ease-in-out infinite' : 'none',
                opacity: (hasActiveChoice && chest.status !== 'active' && chest.status !== 'opened') ? 0.4 : 1
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
              ) : chest.status === 'opened' ? (
                <div style={{ textAlign: 'center', animation: 'hbFadeIn 0.3s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', position: 'relative' }}>
                  {/* Multiplier badge — top right corner */}
                  {chest.mult && parseFloat(chest.mult) > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      ...getMultBadgeStyle(chest.mult),
                      padding: '2px 6px',
                      borderRadius: 6,
                      fontSize: 9,
                      fontWeight: 900,
                      letterSpacing: '-0.3px',
                      lineHeight: 1.3,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                      zIndex: 5
                    }}>
                      {chest.mult}x
                    </div>
                  )}
                  {/* HP reward — large centered */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                    <div style={{ fontSize: 24, fontWeight: 950, color: '#0000FF', letterSpacing: '-0.8px', lineHeight: 1 }}>
                      +{chest.hp}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#93A3FF', letterSpacing: 1.5, marginTop: 3, textTransform: 'uppercase' }}>HP</div>
                  </div>
                </div>
              ) : (
                <>
                  <img
                    src="/box2.png"
                    alt="Epic Chest"
                    style={{
                      width: '64%',
                      height: '64%',
                      objectFit: 'contain',
                      filter: (chest.status === 'locked' && anyOpened) ? 'blur(1.2px)' : 'none',
                      opacity: chest.status === 'locked' ? 0.45 : 1,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  />
                  {chest.status === 'locked' && !hasActiveChoice && anyOpened && (
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: 'linear-gradient(135deg, #0000FF 0%, #0000B0 100%)',
                      color: '#ffffff',
                      borderRadius: 30,
                      padding: '4px 10px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      boxShadow: '0 8px 20px rgba(0,0,255,0.3)',
                      fontSize: 8,
                      fontWeight: 900,
                      letterSpacing: '-0.1px',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap',
                      zIndex: 10,
                      animation: 'hbFadeIn 0.25s ease'
                    }}>
                      Open 0.30 <img src="/usdc-logo.png" alt="USDC" style={{ width: 9, height: 9 }} />
                    </div>
                  )}
                </>
              )}
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
              Open Box 0.3
              <img src="/usdc-logo.png" alt="USDC" style={{ width: 15, height: 15 }} />
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
              ✨ Open All 6 chests for 1.50
              <img src="/usdc-logo.png" alt="USDC" style={{ width: 15, height: 15 }} />
              <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 20, fontWeight: 900, color: '#FCD34D' }}>
                1 FREE CHEST!
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

      {/* ═══ HOW IT WORKS ═══ */}
      <div style={{ background: '#EEF0F3', border: '1px solid #DEE1E7', borderRadius: 20, padding: '16px', marginTop: 32 }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: '#717886', letterSpacing: 0.5, marginBottom: 14, textTransform: 'uppercase' }}>
          How it works
        </div>
        {[
          ['How do Happy Boxes work?', 'Choose to open boxes one by one for 0.3 USDC each, or open all 6 boxes at once for a discounted price of 1.5 USDC (saving 0.3 USDC — equivalent to getting 1 chest completely free!).'],
          ['What are the rewards?', 'Every box contains a surprise reward ranging from 2.0 to 10.0 HP. The rewards are randomly generated on-chain.'],
          ['Do multipliers apply?', 'Yes! If you have an active HP Boost from your profile, it will automatically multiply the HP rewards you receive from opening chests.'],
          ['Can I open multiple boxes?', 'Yes! You can continue opening chests one by one on the same grid until all 6 are revealed, or start fresh by clicking Reset Board.'],
        ].map(([q, a], i, arr) => (
          <div key={i} style={{ marginBottom: i < arr.length - 1 ? 14 : 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0A0B0D', marginBottom: 3 }}>{q}</div>
            <div style={{ fontSize: 10, color: '#717886', lineHeight: 1.6, fontWeight: 500 }}>{a}</div>
          </div>
        ))}
      </div>

      {/* ═══ TX MODAL ═══ */}
      {txModal && (
        <TxModal
          title={txModal === 'single' ? 'Open Chest' : 'Open All 6 Chests'}
          subtitle={txModal === 'single' ? 'Pick a chest to reveal your reward!' : 'Unlock all 6 chests instantly with 1 box FREE!'}
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
