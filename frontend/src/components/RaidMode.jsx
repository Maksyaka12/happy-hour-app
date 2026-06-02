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
  const [lastRaidTime, setLastRaidTime] = useState(null)
  const [cooldownText, setCooldownText] = useState('')
  const [isCooldownActive, setIsCooldownActive] = useState(false)

  // Game UI State: 'idle', 'scanning', 'result'
  const [gameState, setGameState] = useState('idle')
  const [gameOutcome, setGameOutcome] = useState(null)
  
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

  // Fetch current user details & check shield expiry & last raid time
  const fetchRaidStatus = async () => {
    if (!address) return
    try {
      // 1. Fetch user data (shield)
      const { data: userData, error: userError } = await db
        .from('users')
        .select('points, shield_expires_at')
        .eq('address', address.toLowerCase())
        .single()

      if (!userError && userData) {
        setUser(userData)
      }

      // 2. Fetch last raid attempt
      const { data: raidData, error: raidError } = await db
        .from('raid_attempts')
        .select('created_at')
        .eq('raider_address', address.toLowerCase())
        .order('created_at', { ascending: false })
        .limit(1)

      if (!raidError && raidData && raidData.length > 0) {
        setLastRaidTime(new Date(raidData[0].created_at).getTime())
      } else {
        setLastRaidTime(null)
      }
    } catch (e) {
      console.error('Error fetching raid status:', e)
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

  useEffect(() => {
    fetchRaidStatus()
    fetchHistory()

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

  // Cooldown countdown timer
  useEffect(() => {
    if (!lastRaidTime) {
      setIsCooldownActive(false)
      setCooldownText('')
      return
    }

    const updateCooldown = () => {
      const now = Date.now()
      const tenMinutes = 10 * 60 * 1000
      const elapsed = now - lastRaidTime
      const remaining = tenMinutes - elapsed

      if (remaining <= 0) {
        setIsCooldownActive(false)
        setCooldownText('')
        return true // Finished
      } else {
        setIsCooldownActive(true)
        const seconds = Math.floor(remaining / 1000)
        if (seconds >= 60) {
          const minutes = Math.floor(seconds / 60)
          const extra = seconds % 60 > 0 ? 1 : 0
          const displayMin = minutes + extra
          setCooldownText(`${displayMin}m left`)
        } else {
          setCooldownText(`${seconds}s left`)
        }
        return false
      }
    }

    const finished = updateCooldown()
    if (finished) return

    const interval = setInterval(() => {
      const isDone = updateCooldown()
      if (isDone) {
        clearInterval(interval)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [lastRaidTime])

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
        fetchRaidStatus()
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
          setGameState('result')
          fetchRaidStatus()
          fetchHistory()
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

  const handlePlayAgain = () => {
    setGameState('idle')
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
              <span>Raid an active user with 300+ HP (70% success chance).</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '6px', color: '#EF4444' }}>●</span>
              <span>Minimum HP stolen on a successful raid: 10.00 HP (up to 5.00% of target balance).</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '6px', color: '#EF4444' }}>●</span>
              <span>Raid Shield provides absolute protection for 24 hours (prevents anyone from raiding you).</span>
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
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0A0B0D' }}>🛡️ Raid Shield Status</div>
            <div style={{ fontSize: 9.5, color: '#717886', marginTop: 1, fontWeight: 500 }}>
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
              {isShieldActive ? shieldTimeLeft : '0.15 USDC / 24 hours'}
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
        padding: '16px 20px',
        marginBottom: 20,
        boxShadow: '0 4px 16px rgba(10,11,13,0.015)',
        minHeight: 120,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {errorMessage && (
          <div style={{
            background: 'rgba(252, 64, 31, 0.08)',
            border: '1px solid rgba(252, 64, 31, 0.2)',
            borderRadius: 12,
            padding: '8px 12px',
            color: '#FC401F',
            fontSize: 11,
            fontWeight: 700,
            marginBottom: 12,
            textAlign: 'center',
            width: '100%',
            boxSizing: 'border-box'
          }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {/* GAMESTATE: IDLE */}
        {gameState === 'idle' && (
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left' }}>
            {/* Holographic pulsing radar ring and dial */}
            <div style={{ position: 'relative', width: 84, height: 84, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {/* Pulsing glow ring */}
              <div className="radar-pulse" style={{
                position: 'absolute',
                inset: 0,
                borderRadius: '50%',
                border: '1.5px solid rgba(0, 82, 255, 0.15)',
                pointerEvents: 'none'
              }} />
              
              {/* Rotating target locator container */}
              <div className="vault-dial" style={{
                width: 68,
                height: 68,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0A0B0D 0%, #1A1C20 100%)',
                border: '2.5px solid #0052FF',
                boxShadow: '0 6px 18px rgba(0, 82, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                cursor: 'pointer',
              }}>
                {/* Custom Target Scope indicator */}
                <div className="target-scope" style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: '1.8px dashed rgba(0, 82, 255, 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  animation: 'spin 12s linear infinite'
                }}>
                  {/* Scope markings */}
                  <div style={{ position: 'absolute', width: 2, height: 8, background: '#0052FF', top: -2 }} />
                  <div style={{ position: 'absolute', width: 2, height: 8, background: '#0052FF', bottom: -2 }} />
                  <div style={{ position: 'absolute', width: 8, height: 2, background: '#0052FF', left: -2 }} />
                  <div style={{ position: 'absolute', width: 8, height: 2, background: '#0052FF', right: -2 }} />
                  {/* Glowing center laser */}
                  <div style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#0052FF',
                    boxShadow: '0 0 10px #0052FF, 0 0 3px #0052FF'
                  }} />
                </div>
              </div>
            </div>

            {/* Right side info & action */}
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h4 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 800, color: '#0A0B0D', letterSpacing: -0.2 }}>
                Raid
              </h4>
              <p style={{ margin: '0 0 10px', fontSize: 11, color: '#717886', lineHeight: 1.3, fontWeight: 400 }}>
                Find your target and steal some <span style={{ color: '#0052FF', fontWeight: 600 }}>HP</span>
              </p>

              <button
                className="raid-btn"
                onClick={handleInitiateRaidClick}
                disabled={isPending || isCooldownActive}
                style={{
                  width: '100%',
                  background: isCooldownActive ? '#EEF0F3' : '#0000FF',
                  color: isCooldownActive ? '#94A3B8' : '#fff',
                  border: isCooldownActive ? '1px solid #DEE1E7' : 'none',
                  borderRadius: 20,
                  padding: '10px 18px',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: (isPending || isCooldownActive) ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  boxShadow: (isPending || isCooldownActive) ? 'none' : '0 6px 18px rgba(0,0,255,0.2)',
                  opacity: isPending ? 0.5 : 1,
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
              >
                {isCooldownActive ? (
                  <span style={{ fontWeight: 500 }}>
                    next raid: <strong style={{ fontWeight: 800 }}>{cooldownText}</strong>
                  </span>
                ) : (
                  <>
                    <span>Raid</span>
                    <span style={{ color: '#A5B4FC', fontWeight: 900, marginLeft: 2 }}>0.25</span>
                    <img src="/usdc-logo.png" alt="USDC" style={{ width: 12, height: 12, flexShrink: 0 }} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* GAMESTATE: SCANNING */}
        {gameState === 'scanning' && (
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left' }}>
            {/* Animated Radar Sweep */}
            <div style={{
              position: 'relative',
              width: 84,
              height: 84,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(0,82,255,0.02) 0%, rgba(0,82,255,0.08) 100%)',
              border: '2px solid rgba(0, 82, 255, 0.25)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 6px 18px rgba(0,82,255,0.08)',
              flexShrink: 0
            }}>
              {/* Grid Lines */}
              <div style={{ position: 'absolute', width: '100%', height: 1, background: 'rgba(0,82,255,0.15)' }} />
              <div style={{ position: 'absolute', width: 1, height: '100%', background: 'rgba(0,82,255,0.15)' }} />
              {/* Concentric rings */}
              <div style={{ position: 'absolute', width: 56, height: 56, borderRadius: '50%', border: '1px dashed rgba(0,82,255,0.12)' }} />
              <div style={{ position: 'absolute', width: 32, height: 32, borderRadius: '50%', border: '1px dashed rgba(0,82,255,0.12)' }} />
              
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
              
              {/* Glowing signal dots */}
              <div className="radar-signal-dot" style={{
                position: 'absolute',
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#0052FF',
                boxShadow: '0 0 8px #0052FF',
                top: '30%',
                left: '65%'
              }} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#0A0B0D', letterSpacing: -0.4 }}>
                Locating target...
              </h3>
            </div>
          </div>
        )}

        {/* GAMESTATE: RESULT */}
        {gameState === 'result' && gameOutcome && (
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, textAlign: 'left' }}>
            {gameOutcome.success ? (
              <>
                {/* Left Side: Success Badge */}
                <div style={{ 
                  width: 72, 
                  height: 72, 
                  borderRadius: '50%', 
                  background: 'rgba(5, 150, 105, 0.08)', 
                  border: '2px solid #059669',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: 28, 
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(5,150,105,0.1)'
                }}>
                  🏆
                </div>
                {/* Right Side: Details & Action */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ margin: '0 0 2px', fontSize: 16, fontWeight: 900, color: '#059669', letterSpacing: -0.4 }}>
                    Raid successful
                  </h3>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#065F46', marginBottom: 8, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                    <span>+{Number(gameOutcome.stolen_amount).toFixed(2)} HP</span>
                    <span style={{ color: '#717886', fontWeight: 600, fontSize: 11 }}>({Number(gameOutcome.percentage).toFixed(2)}% of target balance)</span>
                  </div>
                  <button
                    onClick={handlePlayAgain}
                    className="raid-btn"
                    style={{
                      width: '100%',
                      background: '#ECFDF5',
                      border: '1px solid #A7F3D0',
                      borderRadius: 20,
                      padding: '10px 18px',
                      color: '#047857',
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    Raid Again
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Left Side: Fail Badge */}
                <div style={{ 
                  width: 72, 
                  height: 72, 
                  borderRadius: '50%', 
                  background: 'rgba(225, 29, 72, 0.08)', 
                  border: '2px solid #E11D48',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  fontSize: 28, 
                  flexShrink: 0,
                  boxShadow: '0 4px 12px rgba(225,29,72,0.1)'
                }}>
                  😔
                </div>
                {/* Right Side: Details & Action */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 900, color: '#E11D48', letterSpacing: -0.4 }}>
                    Raid failed
                  </h3>
                  <button
                    onClick={handlePlayAgain}
                    className="raid-btn"
                    style={{
                      width: '100%',
                      background: '#EEF0F3',
                      border: '1px solid #DEE1E7',
                      borderRadius: 20,
                      padding: '10px 18px',
                      color: '#32353D',
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                  >
                    Raid Again
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ═══ RAID HISTORY (Displayed directly below interactive board) ═══ */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 9, color: '#717886', fontWeight: 800, letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' }}>
          Raids History
        </div>

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
              No raids logged yet. Be the first one to pull off a raid!
            </div>
          ) : (
            history.map(item => {
              const isVictim = item.victim_address === address?.toLowerCase()
              const raiderName = item.raider?.basename || short(item.raider_address)
              const victimName = item.victim?.basename || short(item.victim_address)
              const avatarAddress = isVictim ? item.raider_address : item.victim_address

              const dateObj = new Date(item.created_at)
              const datePart = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
              const timePart = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })
              const timeStr = `${datePart} ${timePart} UTC`

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
                    <UserAvatar address={avatarAddress} size={28} />
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
                      {isVictim ? (
                        <>
                          Stolen by <span style={{ color: '#DC2626' }}>{raiderName}</span>
                        </>
                      ) : (
                        <>
                          Stolen from <span style={{ color: '#0052FF' }}>{victimName}</span>
                        </>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 2 }}>
                      {timeStr}
                    </div>
                  </div>

                  <div style={{
                    background: isVictim ? '#FEF2F2' : '#ECFDF5',
                    border: `1px solid ${isVictim ? '#FCA5A5' : '#A7F3D0'}`,
                    borderRadius: 12,
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 900,
                    color: isVictim ? '#DC2626' : '#059669',
                    textAlign: 'center',
                    flexShrink: 0,
                    minWidth: 85,
                    boxSizing: 'border-box'
                  }}>
                    {isVictim ? '-' : '+'}{Number(item.stolen_amount).toFixed(2)} HP
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
