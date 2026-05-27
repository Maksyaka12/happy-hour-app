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

  // Color logic and premium styles for opened boxes (matches ProfileSection boost colors)
  const getOpenedCardDetails = (mult) => {
    const m = parseFloat(mult) || 1.0
    if (m >= 2.0) {
      return {
        badgeBg: 'linear-gradient(135deg, #34D399, #059669)', // green
        badgeColor: '#000000', // black text
        badgeText: '⚡ 2.0x Boost'
      }
    }
    if (m > 1.0) {
      return {
        badgeBg: 'linear-gradient(135deg, #F4C81B, #F97316)', // orange
        badgeColor: '#000000', // black text
        badgeText: `⚡ ${m}x Boost`
      }
    }
    return {
      badgeBg: 'linear-gradient(135deg, #94A3B8, #64748B)', // gray
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

  const [clickedBoxIndex, setClickedBoxIndex] = useState(null)

  const [dailyStats, setDailyStats] = useState({
    boxes_opened: 0,
    bonus_opens: 0,
    ap_burned: 0,
    score: 0
  })
  const [isBurningAp, setIsBurningAp] = useState(false)
  const [apBurnError, setApBurnError] = useState('')
  const [apBurnSuccess, setApBurnSuccess] = useState(false)

  const loadDailyStats = async () => {
    if (!address) return
    const todayStr = new Date().toISOString().split('T')[0]
    const { data, error } = await db
      .from('daily_stats')
      .select('boxes_opened, bonus_opens, ap_burned, score')
      .eq('address', address.toLowerCase())
      .eq('day', todayStr)
      .maybeSingle()

    if (!error && data) {
      setDailyStats({
        boxes_opened: data.boxes_opened || 0,
        bonus_opens: data.bonus_opens || 0,
        ap_burned: data.ap_burned || 0,
        score: data.score || 0
      })
    } else {
      setDailyStats({
        boxes_opened: 0,
        bonus_opens: 0,
        ap_burned: 0,
        score: 0
      })
    }
  }

  useEffect(() => {
    loadDailyStats()
  }, [address])

  const handleBurnAp = async () => {
    if (!address) return
    setIsBurningAp(true)
    setApBurnError('')
    setApBurnSuccess(false)
    try {
      const { data, error } = await db.rpc('burn_ap_for_boxes', {
        p_address: address.toLowerCase()
      })
      if (error) throw error
      if (data?.ok) {
        setApBurnSuccess(true)
        await loadDailyStats()
        if (onUpdate) onUpdate()
        setTimeout(() => setApBurnSuccess(false), 3000)
      } else {
        setApBurnError(data?.error || 'Failed to burn AP.')
      }
    } catch (e) {
      console.error(e)
      setApBurnError('Failed to execute AP burn.')
    } finally {
      setIsBurningAp(false)
    }
  }

  const maxDailyOpens = 12 + dailyStats.bonus_opens
  const remainingOpens = Math.max(0, maxDailyOpens - dailyStats.boxes_opened)

  // Recovery of pending choice across tab unmounts (Option 2)
  useEffect(() => {
    const pendingHash = localStorage.getItem('happy_boxes_pending')
    if (pendingHash) {
      setActiveTxHash(pendingHash)
      setHasActiveChoice(true)
      
      const savedBoard = localStorage.getItem('happy_boxes_board')
      if (savedBoard) {
        try {
          const parsed = JSON.parse(savedBoard)
          if (Array.isArray(parsed) && parsed.length === 6) {
            setChests(parsed.map(c => c.status === 'locked' ? { ...c, status: 'active' } : c))
            return
          }
        } catch (e) {
          console.error('Failed to parse saved board:', e)
        }
      }
      setChests(prev => prev.map(c => c.status === 'locked' ? { ...c, status: 'active' } : c))
    } else {
      // Variant 1: No pending transaction, clear saved board to start fresh
      localStorage.removeItem('happy_boxes_board')
    }
  }, [])

  // Persist board state to localStorage whenever chests change
  useEffect(() => {
    const hasOpenOrActive = chests.some(c => c.status === 'opened' || c.status === 'active')
    if (hasOpenOrActive) {
      localStorage.setItem('happy_boxes_board', JSON.stringify(chests))
    }
  }, [chests])

  // Reset the grid board to start fresh
  const handleResetBoard = () => {
    localStorage.removeItem('happy_boxes_pending')
    localStorage.removeItem('happy_boxes_board')
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
    setClickedBoxIndex(null)
    setErrorMessage('')
    reset()
  }

  // Handle successful USDC transactions
  useEffect(() => {
    if (isSuccess && txHash) {
      if (txModal === 'single') {
        setTxModal(false)
        if (clickedBoxIndex !== null) {
          // Option 1: User pre-clicked a chest card badge. Open it directly!
          handleSelectChest(clickedBoxIndex, txHash)
        } else {
          // Standard flow: User clicked main bottom button. Give them a choice.
          setActiveTxHash(txHash)
          setHasActiveChoice(true)
          setChests(prev => prev.map(c => c.status === 'locked' ? { ...c, status: 'active' } : c))
          localStorage.setItem('happy_boxes_pending', txHash)
        }
      } else if (txModal === 'bundle') {
        setTxModal(false)
        handleOpenAllChests(txHash)
      }
    }
  }, [isSuccess, txHash, txModal, clickedBoxIndex])

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
  async function handleSelectChest(index, hash = null) {
    const txHashToUse = hash || activeTxHash
    if (!txHashToUse) return
    if (!hash && (!hasActiveChoice || chests[index].status !== 'active')) return

    setRevealingIndex(index)
    setHasActiveChoice(false) // Lock other clicks
    localStorage.removeItem('happy_boxes_pending') // clear immediately!

    try {
      const { data, error } = await db.rpc('open_standard_chest', {
        p_address: address.toLowerCase(),
        p_tx_hash: txHashToUse
      })

      if (error) throw error

      if (data?.ok) {
        setChests(prev => {
          const nextChests = prev.map((c, i) => i === index 
            ? { ...c, status: 'opened', hp: data.hp_won, mult: data.applied_multiplier } 
            : { ...c, status: c.status === 'active' ? 'locked' : c.status }
          )
          
          // Auto reset check: Option 3!
          const allOpen = nextChests.every(c => c.status === 'opened')
          if (allOpen) {
            setTimeout(() => {
              handleResetBoard()
            }, 2500)
          }
          
          return nextChests
        })
        if (onUpdate) onUpdate()
        loadDailyStats()
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
      setClickedBoxIndex(null)
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
        loadDailyStats()

        // Auto reset for Option 3!
        setTimeout(() => {
          handleResetBoard()
        }, 2500)
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
              <span>Each box contains from 2 to 15 HP.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '6px', color: '#8B5CF6' }}>●</span>
              <span>Your boost is automatically applied.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ DAILY LIMITS & AP BURN CARD ═══ */}
      <div style={{
        background: '#fff',
        border: '1px solid #DEE1E7',
        borderRadius: 18,
        padding: '14px 18px',
        marginBottom: 16,
        boxShadow: '0 4px 16px rgba(10,11,13,0.015)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10
      }}>
        {/* Scale Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#0A0B0D' }}>🎁 Daily Box Limits</div>
            <div style={{ fontSize: 9, color: '#717886', marginTop: 1, fontWeight: 500 }}>
              Remaining opens for today
            </div>
          </div>
          <div style={{ 
            background: remainingOpens === 0 ? '#FEF2F2' : '#F5F3FF', 
            color: remainingOpens === 0 ? '#DC2626' : '#8B5CF6', 
            padding: '3px 10px', 
            borderRadius: 12, 
            fontSize: 11, 
            fontWeight: 800,
            border: `1px solid ${remainingOpens === 0 ? '#FCA5A5' : '#DDD6FE'}`
          }}>
            {remainingOpens} / {maxDailyOpens} left
          </div>
        </div>

        {/* Progress bar scale visual segment */}
        <div style={{ background: '#F1F5F9', height: 4, borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
          <div style={{
            background: remainingOpens === 0 
              ? '#EF4444' 
              : 'linear-gradient(90deg, #8B5CF6 0%, #D946EF 100%)',
            height: '100%',
            width: `${(remainingOpens / maxDailyOpens) * 100}%`,
            transition: 'width 0.4s ease'
          }} />
        </div>

        {/* AP Burn Controller Row */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          paddingTop: 8, 
          borderTop: '1px solid #F1F5F9',
          gap: 12
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 9, color: '#717886', fontWeight: 600 }}>Your Activity Points</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#0A0B0D', display: 'flex', alignItems: 'center', gap: 2 }}>
              ⚡ {dailyStats.score} Points
            </span>
          </div>

          <button
            onClick={handleBurnAp}
            disabled={isBurningAp || dailyStats.score < 100}
            className="chest-btn"
            style={{
              background: apBurnSuccess
                ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
                : (dailyStats.score < 100 
                    ? '#F1F5F9' 
                    : 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)'),
              color: apBurnSuccess
                ? '#fff'
                : (dailyStats.score < 100 ? '#94A3B8' : '#fff'),
              border: (apBurnSuccess || dailyStats.score >= 100) ? 'none' : '1px solid #E2E8F0',
              borderRadius: 12,
              padding: '7px 12px',
              fontSize: 9.5,
              fontWeight: 800,
              cursor: (isBurningAp || dailyStats.score < 100) ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              boxShadow: (isBurningAp || dailyStats.score < 100) ? 'none' : '0 4px 12px rgba(249,115,22,0.2)',
              opacity: isBurningAp ? 0.6 : 1,
            }}
          >
            <span>{isBurningAp ? 'Burning...' : (apBurnSuccess ? '🔥 +6 Opens Activated!' : '🔥 Burn 100 points to get +6 opens')}</span>
          </button>
        </div>

        {/* AP Burn Error Msg */}
        {apBurnError && (
          <div style={{ fontSize: 9, color: '#DC2626', fontWeight: 700, textAlign: 'right' }}>
            ⚠️ {apBurnError}
          </div>
        )}
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
          🎉 Paid! Tap any box to reveal!
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
              imageFilter = 'blur(2px) grayscale(30%) drop-shadow(0 4px 10px rgba(0,0,0,0.1))'
              imageOpacity = 0.65
            } else {
              imageFilter = 'grayscale(60%) brightness(0.9) drop-shadow(0 4px 8px rgba(0,0,0,0.05))'
              imageOpacity = 0.3
            }
          }
          
          return (
            <div
              key={chest.id}
              onClick={() => {
                if (chest.status === 'active') {
                  handleSelectChest(index)
                } else if (chest.status === 'locked' && !hasActiveChoice && !allOpened && anyOpened) {
                  // Direct click triggers single box payment only if board is already active with openings
                  setClickedBoxIndex(index)
                  setTxModal('single')
                }
              }}
              className="chest-slot"
              style={{
                aspectRatio: '1',
                position: 'relative',
                perspective: '1000px',
                cursor: (chest.status === 'active' || (chest.status === 'locked' && !hasActiveChoice && !allOpened && anyOpened)) ? 'pointer' : 'default',
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

                      {chest.status === 'locked' && !hasActiveChoice && anyOpened && (
                        <div style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          background: '#0000FF',
                          color: '#ffffff',
                          borderRadius: 50,
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          boxShadow: '0 4px 12px rgba(0,0,255,0.2)',
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: 'pointer',
                          zIndex: 10,
                          whiteSpace: 'nowrap'
                        }}>
                          <span>Open · 0.30</span> <img src="/usdc-logo.png" alt="USDC" style={{ width: 12, height: 12 }} />
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
        {/* Main Single Open Button */}
        <button
          className="chest-btn"
          onClick={() => setTxModal('single')}
          disabled={isPending || isConfirming || hasActiveChoice || revealingIndex !== null || allOpened || remainingOpens === 0}
          style={{
            width: '100%',
            background: '#0000FF',
            color: '#fff',
            border: 'none',
            borderRadius: 20,
            padding: '12px 18px',
            fontSize: 13,
            fontWeight: 800,
            cursor: (isPending || isConfirming || hasActiveChoice || revealingIndex !== null || allOpened || remainingOpens === 0) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            boxShadow: '0 8px 24px rgba(0,0,255,0.2)',
            opacity: (isPending || isConfirming || hasActiveChoice || revealingIndex !== null || allOpened || remainingOpens === 0) ? 0.5 : 1,
            transition: 'transform 0.2s, box-shadow 0.2s'
          }}
        >
          <span>{remainingOpens === 0 ? 'Daily Limit Reached' : 'Open Box'}</span>
          {remainingOpens > 0 && <span style={{ color: '#A5B4FC', fontWeight: 900, marginLeft: 4 }}>0.30</span>}
          {remainingOpens > 0 && <img src="/usdc-logo.png" alt="USDC" style={{ width: 14, height: 14, flexShrink: 0 }} />}
        </button>

        {/* Bundle Open All Button */}
        <button
          className="chest-btn"
          onClick={() => setTxModal('bundle')}
          disabled={isPending || isConfirming || hasActiveChoice || revealingIndex !== null || anyOpened || allOpened || remainingOpens < 6}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: 20,
            padding: '12px 18px',
            cursor: (isPending || isConfirming || hasActiveChoice || revealingIndex !== null || anyOpened || allOpened || remainingOpens < 6) ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 8px 24px rgba(139,92,246,0.3)',
            opacity: (isPending || isConfirming || hasActiveChoice || revealingIndex !== null || anyOpened || allOpened || remainingOpens < 6) ? 0.4 : 1,
            position: 'relative',
            overflow: 'hidden',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
        >
          {/* Shine effect reflect line */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: '-100%',
            width: '50%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
            transform: 'skewX(-25deg)',
            animation: 'shine 4s infinite ease-in-out',
            pointerEvents: 'none'
          }} />

          {/* Left Block: Offer Title & Subtitle */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Open All 6
              </span>
              <span style={{ 
                fontSize: 8, 
                background: '#FCD34D', 
                color: '#1E1B4B', 
                padding: '2px 8px', 
                borderRadius: 20, 
                fontWeight: 900,
                letterSpacing: '0.3px',
                boxShadow: '0 2px 6px rgba(252,211,77,0.3)',
                whiteSpace: 'nowrap'
              }}>
                1 BOX FREE!
              </span>
            </div>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.85)', fontWeight: 500 }}>
              {remainingOpens < 6 ? 'Requires at least 6 daily opens remaining' : 'Unlock all rewards in one click!'}
            </span>
          </div>

          {/* Right Block: Price Tag with Sale Indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* Crossed Out Original Price */}
            <span style={{ 
              fontSize: 11, 
              color: 'rgba(255,255,255,0.5)', 
              textDecoration: 'line-through', 
              fontWeight: 600,
              letterSpacing: '0.2px'
            }}>
              1.80
            </span>
            {/* Promo Price */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: 4, 
              background: 'rgba(255, 255, 255, 0.12)', 
              padding: '6px 12px', 
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>
                1.50
              </span>
              <img src="/usdc-logo.png" alt="USDC" style={{ width: 14, height: 14, flexShrink: 0 }} />
            </div>
          </div>
        </button>
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
          onCancel={() => { setTxModal(false); reset(); setClickedBoxIndex(null) }}
        />
      )}

      {/* Spin and Shine styles */}
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes shine {
          0% { left: -100%; }
          15% { left: 100%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  )
}
