// src/components/RaidMode.jsx
import React, { useState, useEffect, useRef } from 'react'
import { useChainId, useSwitchChain } from 'wagmi'
import { parseUnits } from 'viem'
import { base } from 'wagmi/chains'
import { CHECKIN_TARGET, USDC_ADDRESS, USDC_ABI } from '../config/constants'
import { db } from '../config/supabase'
import { useBuilderWrite } from '../hooks/useBuilderWrite'
import { TxModal } from './TxModal'
import { UserAvatar } from './UserAvatar'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

export function RaidMode({ address }) {
  const [user, setUser] = useState(null)
  const [shieldTimeLeft, setShieldTimeLeft] = useState('')
  const [isShieldActive, setIsShieldActive] = useState(false)
  const [history, setHistory] = useState([])

  // Game UI State: 'idle', 'scanning', 'choose_card', 'flipping', 'result'
  const [gameState, setGameState] = useState('idle')
  const [scanIndex, setScanIndex] = useState(0)
  const [potentialVictims, setPotentialVictims] = useState([])
  const [finalVictim, setFinalVictim] = useState(null)
  const [gameOutcome, setGameOutcome] = useState(null)
  const [selectedCardIdx, setSelectedCardIdx] = useState(null)
  
  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const wrongChain = chainId !== base.id

  const [errorMessage, setErrorMessage] = useState('')
  const [showTxModal, setShowTxModal] = useState(false)
  const [txType, setTxType] = useState('raid') // raid or shield

  // Web3 write hook
  const { data: txHash, writeContract, isPending, isConfirming, isSuccess, error: writeError, reset } = useBuilderWrite()

  // Scanning timeout ref
  const scanTimeoutRef = useRef(null)

  // Fetch current user and check shield
  const fetchUserData = async () => {
    if (!address) return
    const { data, error } = await db
      .from('users')
      .select('points, shield_expires_at')
      .eq('address', address.toLowerCase())
      .single()

    if (!error && data) {
      setUser(data)
    }
  }

  // Fetch successful raids (Note: table is raid_attempts in db)
  const fetchHistory = async () => {
    try {
      const { data, error } = await db
        .from('raid_attempts')
        .select(`
          id, raider_address, victim_address, stolen_amount, percentage, created_at, tx_hash, success,
          raider:users!raider_address(basename),
          victim:users!victim_address(basename)
        `)
        .eq('success', true)
        .order('created_at', { ascending: false })
        .limit(10)

      if (!error && data) {
        setHistory(data)
      } else if (error) {
        console.error('Error fetching history:', error)
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Fetch potential targets
  const fetchScanningPool = async () => {
    try {
      const { data } = await db
        .from('users')
        .select('address, basename')
        .gt('points', 300)
        .neq('address', address.toLowerCase())
        .limit(15)

      if (data && data.length > 0) {
        setPotentialVictims(data)
      } else {
        setPotentialVictims([
          { address: '0x32A...89b1', basename: 'based_chad' },
          { address: '0x9a8...c102', basename: 'degen_king' },
          { address: '0xf83...a812', basename: 'vitalik_fan' },
          { address: '0x1b4...d9e5', basename: 'blue_sky' },
          { address: '0xcd1...f721', basename: 'smart_builder' }
        ])
      }
    } catch {
      // Fallback
    }
  }

  useEffect(() => {
    fetchUserData()
    fetchHistory()
    fetchScanningPool()

    const sub = db
      .channel('raid-history-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'raid_attempts' }, () => {
        fetchHistory()
      })
      .subscribe()

    return () => {
      db.removeChannel(sub)
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current)
    }
  }, [address])

  // Shield countdown timer and progress calculation
  const [shieldProgressPercent, setShieldProgressPercent] = useState(0)
  useEffect(() => {
    if (!user?.shield_expires_at) {
      setIsShieldActive(false)
      setShieldTimeLeft('')
      setShieldProgressPercent(0)
      return
    }

    const updateTimer = () => {
      const expiry = new Date(user.shield_expires_at).getTime()
      const now = new Date().getTime()
      const diff = expiry - now

      if (diff <= 0) {
        setIsShieldActive(false)
        setShieldTimeLeft('')
        setShieldProgressPercent(0)
      } else {
        setIsShieldActive(true)
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)

        const hStr = hours > 0 ? `${hours}h ` : ''
        const mStr = minutes > 0 || hours > 0 ? `${minutes}m ` : ''
        setShieldTimeLeft(`${hStr}${mStr}${seconds}s`)

        const oneDayMs = 24 * 60 * 60 * 1000
        const percent = Math.min((diff / oneDayMs) * 100, 100)
        setShieldProgressPercent(percent)
      }
    }

    updateTimer()
    const timer = setInterval(updateTimer, 1000)
    return () => clearInterval(timer)
  }, [user?.shield_expires_at])

  // Process transaction state
  useEffect(() => {
    if (isSuccess && txHash) {
      if (txType === 'shield') {
        handleConfirmShieldPurchase(txHash)
      } else if (txType === 'raid') {
        handleConfirmRaid(txHash)
      }
    }
  }, [isSuccess, txHash])

  const handlePurchaseShieldClick = () => {
    setErrorMessage('')
    setTxType('shield')
    setShowTxModal(true)
  }

  const handleInitiateRaidClick = () => {
    setErrorMessage('')
    setTxType('raid')
    setShowTxModal(true)
  }

  const handlePurchaseShieldPayment = () => {
    if (wrongChain) { switchChain({ chainId: base.id }); return }
    setErrorMessage('')
    writeContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [CHECKIN_TARGET, parseUnits('0.15', 6)],
      chainId: base.id
    })
  }

  const handleInitiateRaidPayment = () => {
    if (wrongChain) { switchChain({ chainId: base.id }); return }
    setErrorMessage('')
    writeContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [CHECKIN_TARGET, parseUnits('0.25', 6)],
      chainId: base.id
    })
  }

  const handleConfirmShieldPurchase = async (hash) => {
    try {
      const { data, error } = await db.rpc('purchase_raid_shield', {
        p_buyer_address: address.toLowerCase(),
        p_tx_hash: hash
      })
      if (error) throw error
      if (data?.ok) {
        fetchUserData()
        setShowTxModal(false)
        reset()
      } else {
        setErrorMessage(data?.error || 'Database error processing shield purchase.')
      }
    } catch (e) {
      console.error(e)
      setErrorMessage(e.message || 'Error processing shield purchase.')
    }
  }

  const handleConfirmRaid = async (hash) => {
    try {
      setGameState('scanning')
      setShowTxModal(false)

      const { data, error } = await db.rpc('perform_raid_attempt', {
        p_raider_address: address.toLowerCase(),
        p_tx_hash: hash
      })
      if (error) throw error
      if (data?.ok) {
        setGameOutcome({
          success: data.success,
          stolen_amount: data.stolen_amount,
          percentage: data.percentage,
          victim_address: data.victim_address,
          victim_name: data.victim_name
        })

        scanTimeoutRef.current = setTimeout(() => {
          if (data.success && data.victim_address) {
            setFinalVictim({
              address: data.victim_address,
              basename: data.victim_name
            })
          } else {
            setFinalVictim(potentialVictims[Math.floor(Math.random() * potentialVictims.length)])
          }
          setGameState('choose_card')
          reset()
        }, 3000)
      } else {
        setErrorMessage(data?.error || 'Error preparing your raid.')
        setGameState('idle')
        reset()
      }
    } catch (e) {
      console.error(e)
      setErrorMessage(e.message || 'Error processing raid transaction.')
      setGameState('idle')
      reset()
    }
  }

  const handleCardSelection = (cardIdx) => {
    setSelectedCardIdx(cardIdx)
    setGameState('flipping')

    setTimeout(() => {
      setGameState('result')
      fetchUserData()
      fetchHistory()
    }, 1200)
  }

  const handlePlayAgain = () => {
    setGameState('idle')
    setSelectedCardIdx(null)
    setFinalVictim(null)
    setGameOutcome(null)
    setErrorMessage('')
    reset()
  }

  return (
    <div style={{ padding: '0 16px 120px', color: '#0A0B0D', fontFamily: "'Outfit', 'Inter', sans-serif", animation: 'raidFadeIn 0.4s ease' }}>
      <style>{`
        @keyframes raidFadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
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

      {/* ═══ HERO BANNER (Matches Boxes Layout but themed in Dark Red/Orange Raid tones) ═══ */}
      <div style={{
        background: '#140505',
        borderRadius: 24,
        padding: '22px 20px',
        marginBottom: 16,
        position: 'relative',
        minHeight: 144,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        boxShadow: '0 8px 32px rgba(101,16,16,0.3)',
        overflow: 'hidden',
        border: '1px solid rgba(239,68,68,0.2)'
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/banner.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'hue-rotate(330deg) brightness(0.45) contrast(1.2)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(20, 5, 5, 0.25) 0%, rgba(101, 16, 16, 0.7) 100%)',
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
          background: 'radial-gradient(circle, rgba(239,68,68,0.25) 0%, transparent 70%)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />

        {/* Floating background decorations */}
        {[
          { icon: '🕵️‍♂️', top: '-5px', left: '5%', size: 50, opacity: 0.14, r: '-12deg', dur: 4.2 },
          { icon: '💰', top: '10px', right: '25%', size: 42, opacity: 0.12, r: '14deg', dur: 4.8 },
          { icon: '🛡️', bottom: '5px', left: '40%', size: 40, opacity: 0.11, r: '22deg', dur: 5.4 },
          { icon: '💵', bottom: '15px', right: '5%', size: 48, opacity: 0.16, r: '8deg', dur: 4.6 }
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
            animation: `raidItemFloat ${s.dur}s ease-in-out infinite`,
          }}>
            <div style={{
              fontSize: `${s.size}px`,
              opacity: s.opacity,
              filter: 'drop-shadow(0 0 10px rgba(239,68,68,0.25))',
              transform: `rotate(${s.r})`,
            }}>
              {s.icon}
            </div>
          </div>
        ))}

        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes raidItemFloat {
            0% { transform: translateY(0px) rotate(-12deg); }
            50% { transform: translateY(-6px) rotate(-6deg); }
            100% { transform: translateY(0px) rotate(-12deg); }
          }
        ` }} />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'flex-start' }}>
          <div style={{
            fontSize: '26px',
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '0.5px',
            marginBottom: '4px'
          }}>
            Happy Raids
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
              <span style={{ fontSize: '6px', color: '#EF4444' }}>●</span>
              <span>Raid an active user with 300+ HP (50% success chance).</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '6px', color: '#EF4444' }}>●</span>
              <span>Min HP after successfully raid: 10 HP (up to 5% of balance)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '6px', color: '#EF4444' }}>●</span>
              <span>Raid Shield provides absolute protection for 24h (no one can raid you)</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ RAID SHIELD CARD ═══ */}
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
        {/* Shield Status Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#0A0B0D' }}>🛡️ Raid Shield Status</div>
            <div style={{ fontSize: 9, color: '#717886', marginTop: 1, fontWeight: 500 }}>
              Protects your HP from being stolen by other players
            </div>
          </div>
          <div style={{ 
            background: isShieldActive ? '#ECFDF5' : '#FFF1F2', 
            color: isShieldActive ? '#059669' : '#E11D48', 
            padding: '3px 10px', 
            borderRadius: 12, 
            fontSize: 10.5, 
            fontWeight: 800,
            border: `1px solid ${isShieldActive ? '#A7F3D0' : '#FECDD3'}`
          }}>
            {isShieldActive ? 'Active' : 'Inactive'}
          </div>
        </div>

        {/* Shield Expiry Progress Bar Segment */}
        <div style={{ background: '#F1F5F9', height: 4, borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
          <div style={{
            background: isShieldActive 
              ? 'linear-gradient(90deg, #0052FF 0%, #00C6FB 100%)' 
              : '#E2E8F0',
            height: '100%',
            width: isShieldActive ? `${shieldProgressPercent}%` : '0%',
            transition: 'width 0.4s ease'
          }} />
        </div>

        {/* Action / Buy Controls Row */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between', 
          paddingTop: 8, 
          borderTop: '1px solid #F1F5F9',
          gap: 12
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span style={{ fontSize: 9, color: '#717886', fontWeight: 600 }}>
              {isShieldActive ? 'Remaining Protection' : 'Protection Cost'}
            </span>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#0A0B0D' }}>
              {isShieldActive ? shieldTimeLeft : '0.15 USDC / 24h'}
            </span>
          </div>

          <button
            onClick={handlePurchaseShieldClick}
            disabled={isPending}
            className="raid-btn"
            style={{
              background: 'linear-gradient(135deg, #0052FF 0%, #3B82F6 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '7px 12px',
              fontSize: 9.5,
              fontWeight: 800,
              cursor: isPending ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              boxShadow: isPending ? 'none' : '0 4px 12px rgba(0,82,255,0.15)',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            <span>{isShieldActive ? '🛡️ Extend Shield (+24h)' : '🛡️ Buy Raid Shield'}</span>
          </button>
        </div>
      </div>

      {/* ═══ INTERACTIVE GAMEPLAY BOARD (Matches standard card style) ═══ */}
      <div style={{
        background: '#fff',
        border: '1px solid #DEE1E7',
        borderRadius: 18,
        padding: '24px 20px',
        marginBottom: 20,
        boxShadow: '0 4px 16px rgba(10,11,13,0.015)',
        textAlign: 'center',
        minHeight: 220,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {errorMessage && (
          <div style={{
            background: 'rgba(252, 64, 31, 0.08)',
            border: '1px solid rgba(252, 64, 31, 0.2)',
            borderRadius: 12,
            padding: '10px 14px',
            color: '#FC401F',
            fontSize: 12,
            fontWeight: 700,
            marginBottom: 16,
            maxWidth: '90%'
          }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {/* GAMESTATE: IDLE */}
        {gameState === 'idle' && (
          <div style={{ maxWidth: 420, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 0' }}>
            
            {/* Holographic pulsing radar ring and dial */}
            <div style={{ position: 'relative', width: 110, height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              {/* Pulsing glow ring */}
              <div className="radar-pulse" style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '1.5px solid rgba(0, 82, 255, 0.15)',
                pointerEvents: 'none'
              }} />
              <div className="radar-pulse-delayed" style={{
                position: 'absolute',
                inset: -10,
                borderRadius: '50%',
                border: '1px solid rgba(0, 82, 255, 0.08)',
                pointerEvents: 'none'
              }} />
              
              {/* Rotating target locator container */}
              <div className="vault-dial" style={{
                width: 90,
                height: 90,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0A0B0D 0%, #1A1C20 100%)',
                border: '3px solid #0052FF',
                boxShadow: '0 8px 24px rgba(0, 82, 255, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                cursor: 'pointer',
              }}>
                {/* Custom Target Scope indicator */}
                <div className="target-scope" style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  border: '2px dashed rgba(0, 82, 255, 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  animation: 'spin 12s linear infinite'
                }}>
                  {/* Scope markings */}
                  <div style={{ position: 'absolute', width: 2, height: 10, background: '#0052FF', top: -3 }} />
                  <div style={{ position: 'absolute', width: 2, height: 10, background: '#0052FF', bottom: -3 }} />
                  <div style={{ position: 'absolute', width: 10, height: 2, background: '#0052FF', left: -3 }} />
                  <div style={{ position: 'absolute', width: 10, height: 2, background: '#0052FF', right: -3 }} />
                  {/* Glowing center laser */}
                  <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#0052FF',
                    boxShadow: '0 0 12px #0052FF, 0 0 4px #0052FF'
                  }} />
                </div>
              </div>
            </div>

            <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 900, color: '#0A0B0D', letterSpacing: -0.4 }}>
              Raid System
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: 11, color: '#717886', maxWidth: 280, lineHeight: 1.4, textAlign: 'center' }}>
              Initiate a scan for active targets on Base network.
            </p>

            <button
              className="raid-btn"
              onClick={handleInitiateRaidClick}
              disabled={isPending}
              style={{
                width: '100%',
                background: '#0000FF',
                color: '#fff',
                border: 'none',
                borderRadius: 20,
                padding: '12px 18px',
                fontSize: 13,
                fontWeight: 800,
                cursor: isPending ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                boxShadow: '0 8px 24px rgba(0,0,255,0.2)',
                opacity: isPending ? 0.5 : 1,
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
            >
              <span>Raid</span>
              <span style={{ color: '#A5B4FC', fontWeight: 900, marginLeft: 4 }}>0.25</span>
              <img src="/usdc-logo.png" alt="USDC" style={{ width: 14, height: 14, flexShrink: 0 }} />
            </button>
          </div>
        )}

        {/* GAMESTATE: SCANNING */}
        {gameState === 'scanning' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' }}>
            {/* Animated Radar Sweep */}
            <div style={{
              position: 'relative',
              width: 140,
              height: 140,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(0,82,255,0.02) 0%, rgba(0,82,255,0.08) 100%)',
              border: '2px solid rgba(0, 82, 255, 0.25)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0,82,255,0.08)',
              marginBottom: 20
            }}>
              {/* Grid Lines */}
              <div style={{ position: 'absolute', width: '100%', height: 1, background: 'rgba(0,82,255,0.15)' }} />
              <div style={{ position: 'absolute', width: 1, height: '100%', background: 'rgba(0,82,255,0.15)' }} />
              {/* Concentric rings */}
              <div style={{ position: 'absolute', width: 100, height: 100, borderRadius: '50%', border: '1px dashed rgba(0,82,255,0.12)' }} />
              <div style={{ position: 'absolute', width: 60, height: 60, borderRadius: '50%', border: '1px dashed rgba(0,82,255,0.12)' }} />
              
              {/* Radar sweep line */}
              <div className="radar-sweep" style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'conic-gradient(from 0deg at 50% 50%, rgba(0,82,255,0.3) 0deg, rgba(0,82,255,0) 90deg)',
                borderRadius: '50%',
              }} />
              
              {/* Glowing signal dots appearing */}
              <div className="radar-signal-dot" style={{
                position: 'absolute',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#0052FF',
                boxShadow: '0 0 10px #0052FF',
                top: '30%',
                left: '65%'
              }} />
              <div className="radar-signal-dot-delayed" style={{
                position: 'absolute',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#059669',
                boxShadow: '0 0 8px #059669',
                bottom: '25%',
                left: '20%'
              }} />
            </div>

            <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 900, color: '#0A0B0D', letterSpacing: -0.4 }}>
              Scanning Active Vaults...
            </h3>
            <p style={{ margin: 0, fontSize: 11, color: '#717886', maxWidth: 260, lineHeight: 1.4, textAlign: 'center' }}>
              Locating targets with 300+ HP protected by vault locks.
            </p>
          </div>
        )}

        {/* GAMESTATE: CHOOSE CARD */}
        {gameState === 'choose_card' && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              background: 'rgba(0, 82, 255, 0.05)',
              border: '1px solid rgba(0, 82, 255, 0.12)',
              borderRadius: 14,
              padding: '12px 16px',
              width: '100%',
              maxWidth: 320,
              marginBottom: 16,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: '#0052FF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                🎯 TARGET VAULT LOCATED
              </div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#0A0B0D' }}>
                {finalVictim?.basename || short(finalVictim?.address)}
              </div>
            </div>

            <p style={{ margin: '0 0 20px 0', fontSize: 11, color: '#717886', maxWidth: 280, textAlign: 'center', lineHeight: 1.4 }}>
              Choose a card to execute the raid! (50/50 combination)
            </p>

            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', width: '100%' }}>
              {[0, 1].map(idx => (
                <button
                  key={idx}
                  onClick={() => handleCardSelection(idx)}
                  className="raid-btn"
                  style={{
                    width: 105,
                    height: 140,
                    background: 'linear-gradient(135deg, #0A0B0D 0%, #1A1C20 100%)',
                    border: idx === 0 ? '2px solid #0052FF' : '2px solid #3B82F6',
                    borderRadius: 16,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 10px',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: idx === 0 ? '0 8px 24px rgba(0,82,255,0.12)' : '0 8px 24px rgba(59,130,246,0.12)',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-6px) scale(1.03)';
                    e.currentTarget.style.boxShadow = idx === 0 
                      ? '0 12px 32px rgba(0,82,255,0.25)' 
                      : '0 12px 32px rgba(59,130,246,0.25)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0) scale(1)';
                    e.currentTarget.style.boxShadow = idx === 0 
                      ? '0 8px 24px rgba(0,82,255,0.12)' 
                      : '0 8px 24px rgba(59,130,246,0.12)';
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0.08,
                    background: 'radial-gradient(circle, #fff 10%, transparent 11%)',
                    backgroundSize: '10px 10px'
                  }} />

                  <div style={{
                    fontSize: 8,
                    fontWeight: 900,
                    color: idx === 0 ? '#0052FF' : '#3B82F6',
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    alignSelf: 'flex-start'
                  }}>
                    CARD {idx === 0 ? 'A' : 'B'}
                  </div>

                  <div style={{
                    fontSize: 28,
                    filter: 'drop-shadow(0 0 8px rgba(0,82,255,0.4))'
                  }}>
                    {idx === 0 ? '⚡' : '🔑'}
                  </div>

                  <div style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: '#94A3B8',
                    textTransform: 'uppercase'
                  }}>
                    Decrypt
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* GAMESTATE: FLIPPING */}
        {gameState === 'flipping' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' }}>
            <div style={{
              width: 100,
              height: 140,
              borderRadius: 16,
              border: '2px solid #0052FF',
              background: 'linear-gradient(135deg, #0A0B0D 0%, #1A1C20 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              boxShadow: '0 12px 32px rgba(0,82,255,0.25)',
              animation: 'flip 1s ease-in-out infinite',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                inset: 0,
                opacity: 0.15,
                background: 'radial-gradient(circle, #fff 10%, transparent 11%)',
                backgroundSize: '10px 10px',
                borderRadius: 14
              }} />
              🔮
            </div>
            <h3 style={{ marginTop: 20, fontSize: 13, fontWeight: 800, color: '#0A0B0D' }}>Decrypting Combination...</h3>
          </div>
        )}

        {/* GAMESTATE: RESULT */}
        {gameState === 'result' && gameOutcome && (
          <div style={{ maxWidth: 440, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {gameOutcome.success ? (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ 
                  width: 72, 
                  height: 72, 
                  borderRadius: '50%', 
                  background: 'rgba(5, 150, 105, 0.08)', 
                  border: '2px solid #059669',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: 32, 
                  marginBottom: 16,
                  boxShadow: '0 8px 24px rgba(5,150,105,0.1)'
                }}>
                  💰
                </div>
                
                <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 900, color: '#059669', letterSpacing: -0.4 }}>
                  Raid successful.
                </h2>
                <p style={{ margin: '0 0 16px', fontSize: 12, fontWeight: 500, color: '#717886' }}>
                  Congrats!
                </p>

                <div style={{
                  background: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
                  border: '1px solid #A7F3D0',
                  borderRadius: 16,
                  padding: '16px 20px',
                  width: '100%',
                  maxWidth: 320,
                  marginBottom: 20,
                  textAlign: 'center',
                  boxShadow: '0 4px 12px rgba(5,150,105,0.05)'
                }}>
                  <div style={{ fontSize: 28, fontWeight: 900, color: '#059669', marginBottom: 4 }}>
                    +{gameOutcome.stolen_amount} HP
                  </div>
                  <div style={{ fontSize: 11, color: '#065F46', fontWeight: 700 }}>
                    Stolen <strong style={{ color: '#047857' }}>{gameOutcome.percentage}%</strong> of {gameOutcome.victim_name || short(gameOutcome.victim_address)}'s balance
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ 
                  width: 72, 
                  height: 72, 
                  borderRadius: '50%', 
                  background: 'rgba(225, 29, 72, 0.08)', 
                  border: '2px solid #E11D48',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: 32, 
                  marginBottom: 16,
                  boxShadow: '0 8px 24px rgba(225,29,72,0.1)'
                }}>
                  😔
                </div>
                <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 900, color: '#E11D48', letterSpacing: -0.4 }}>
                  Raid failed.
                </h2>
                <p style={{ margin: '0 0 20px', fontSize: 12, fontWeight: 500, color: '#717886' }}>
                  Good luck next time!
                </p>
              </div>
            )}

            <button
              onClick={handlePlayAgain}
              className="raid-btn"
              style={{
                background: '#EEF0F3',
                border: '1px solid #DEE1E7',
                borderRadius: 20,
                padding: '10px 24px',
                color: '#32353D',
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 2px 6px rgba(10,11,13,0.02)'
              }}
            >
              Raid Again
            </button>
          </div>
        )}
      </div>

      {/* ═══ RAID HISTORY (Displayed directly below interactive board) ═══ */}
      <div style={{ marginTop: 24 }}>
        <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 900, color: '#0A0B0D', letterSpacing: -0.3 }}>
          Successful Raid History
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {history.length === 0 ? (
            <div style={{
              background: '#ffffff',
              border: '1px solid #DEE1E7',
              borderRadius: 14,
              padding: '20px 16px',
              textAlign: 'center',
              color: '#717886',
              fontSize: 11
            }}>
              No successful raids logged yet. Be the first one to pull off a raid!
            </div>
          ) : (
            history.map(item => {
              const victimName = item.victim?.basename || short(item.victim_address)
              const timeStr = new Date(item.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

              return (
                <div
                  key={item.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #DEE1E7',
                    borderRadius: 14,
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    boxShadow: '0 2px 6px rgba(10,11,13,0.02)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <UserAvatar address={item.victim_address} size={28} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#0A0B0D',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      Stolen from <span style={{ color: '#0052FF' }}>{victimName}</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                      {timeStr}
                    </div>
                  </div>

                  <div style={{
                    background: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    borderRadius: 12,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 900,
                    color: '#059669',
                    textAlign: 'right',
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'flex-end',
                    minWidth: 70
                  }}>
                    <span>+{item.stolen_amount} HP</span>
                    {item.percentage && (
                      <span style={{ fontSize: 8, fontWeight: 700, opacity: 0.8, marginTop: 1 }}>
                        {item.percentage}%
                      </span>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* USDC Transaction modal */}
      {showTxModal && (
        <TxModal
          title={txType === 'shield' ? 'Purchase Raid Shield' : 'Purchase Raid'}
          subtitle={txType === 'shield' ? 'Get 24h of absolute protection from HP raids' : ''}
          amount={txType === 'shield' ? '0.15' : '0.25'}
          isPending={isPending}
          isConfirming={isConfirming}
          isSuccess={isSuccess}
          error={writeError}
          onConfirm={txType === 'shield' ? handlePurchaseShieldPayment : handleInitiateRaidPayment}
          onCancel={() => { setShowTxModal(false); reset(); }}
        />
      )}

      {/* Global CSS animation injections */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes flip {
          0% { transform: rotateY(0deg); }
          50% { transform: rotateY(180deg); }
          100% { transform: rotateY(360deg); }
        }
        @keyframes radarPulse {
          0% { transform: scale(0.85); opacity: 1; }
          100% { transform: scale(1.15); opacity: 0; }
        }
        @keyframes liveDotBlink {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
        .radar-pulse {
          animation: radarPulse 2s infinite ease-out;
        }
        .radar-pulse-delayed {
          animation: radarPulse 2s infinite ease-out 1s;
        }
        .live-dot {
          animation: liveDotBlink 1.5s infinite ease-in-out;
        }
        .vault-dial {
          transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.3s;
        }
        .vault-dial:hover {
          transform: rotate(90deg);
          border-color: #0052FF;
        }
        .radar-sweep {
          animation: spin 3s linear infinite;
          transform-origin: center;
        }
        .radar-signal-dot {
          animation: liveDotBlink 1.2s infinite ease-in-out;
        }
        .radar-signal-dot-delayed {
          animation: liveDotBlink 1.2s infinite ease-in-out 0.6s;
        }
        .raid-btn { transition: all 0.2s ease; }
        .raid-btn:hover { filter: brightness(1.05); transform: scale(1.01); }
        .raid-btn:active { transform: scale(0.98); }
      `}</style>
    </div>
  )
}
