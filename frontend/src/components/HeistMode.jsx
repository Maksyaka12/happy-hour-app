// src/components/HeistMode.jsx
import React, { useState, useEffect, useRef } from 'react'
import { useSwitchChain } from 'wagmi'
import { parseUnits } from 'viem'
import { base } from 'wagmi/chains'
import { CHECKIN_TARGET, USDC_ADDRESS, USDC_ABI } from '../config/constants'
import { db } from '../config/supabase'
import { useBuilderWrite } from '../hooks/useBuilderWrite'
import { TxModal } from './TxModal'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

export function HeistMode({ address }) {
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
  const [wrongChain, setWrongChain] = useState(false)
  const { switchChain } = useSwitchChain()

  const [errorMessage, setErrorMessage] = useState('')
  const [showTxModal, setShowTxModal] = useState(false)
  const [txType, setTxType] = useState('heist') // heist or shield

  // Web3 write hook
  const { data: txHash, writeContract, isPending, isConfirming, isSuccess, error: writeError, reset } = useBuilderWrite()

  // Scanning loop ref
  const scanIntervalRef = useRef(null)

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

  // Fetch successful raids
  const fetchHistory = async () => {
    try {
      const { data, error } = await db
        .from('heist_attempts')
        .select(`
          id, thief_address, victim_address, stolen_amount, percentage, created_at, tx_hash, success,
          thief:users!thief_address(basename),
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
      .channel('heist-history-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'heist_attempts' }, () => {
        fetchHistory()
      })
      .subscribe()

    return () => {
      db.removeChannel(sub)
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

        // A single shield purchase lasts 24h. Cap max reference at 24h for progress visual (or extend standard)
        // If they extend, diff can be > 24 hours. Let's cap visual display at 100% of 24h.
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
      } else if (txType === 'heist') {
        handleConfirmHeist(txHash)
      }
    }
  }, [isSuccess, txHash])

  const handlePurchaseShieldClick = () => {
    setErrorMessage('')
    setTxType('shield')
    setShowTxModal(true)
    writeContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [CHECKIN_TARGET, parseUnits('0.15', 6)],
      chainId: base.id
    })
  }

  const handleInitiateHeistClick = () => {
    setErrorMessage('')
    setTxType('heist')
    setShowTxModal(true)
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
      const { data, error } = await db.rpc('purchase_heist_shield', {
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

  const handleConfirmHeist = async (hash) => {
    try {
      setGameState('scanning')
      setShowTxModal(false)

      const { data, error } = await db.rpc('perform_heist_attempt', {
        p_thief_address: address.toLowerCase(),
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

        let elapsed = 0
        scanIntervalRef.current = setInterval(() => {
          setScanIndex(prev => (prev + 1) % potentialVictims.length)
          elapsed += 100
          if (elapsed >= 2500) {
            clearInterval(scanIntervalRef.current)
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
          }
        }, 100)
      } else {
        setErrorMessage(data?.error || 'Error preparing your heist.')
        setGameState('idle')
        reset()
      }
    } catch (e) {
      console.error(e)
      setErrorMessage(e.message || 'Error processing heist transaction.')
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
    <div style={{ padding: '0 8px 120px', color: '#0A0B0D', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* ═══ HERO BANNER (Matches Boxes Layout but themed in Dark Red/Orange Heist tones) ═══ */}
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
            animation: `heistItemFloat ${s.dur}s ease-in-out infinite`,
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
          @keyframes heistItemFloat {
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
            Happy Heist
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
              <span>Each heist attempt costs 0.25 USDC.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '6px', color: '#EF4444' }}>●</span>
              <span>Raid an active user with 300+ HP (50% success chance).</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '6px', color: '#EF4444' }}>●</span>
              <span>Steal 10 HP (80% chance) or 1%-5% of their total balance (20% chance).</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '6px', color: '#EF4444' }}>●</span>
              <span>Buy a Heist Shield for 0.15 USDC for 24h absolute protection.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ HEIST SHIELD CARD (Structured like Boxes Limits Card) ═══ */}
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
            <div style={{ fontSize: 13, fontWeight: 900, color: '#0A0B0D' }}>🛡️ Heist Shield Status</div>
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
            style={{
              background: 'linear-gradient(135deg, #0052FF 0%, #00C6FB 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '7px 14px',
              fontSize: 9.5,
              fontWeight: 800,
              cursor: isPending ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              boxShadow: '0 4px 12px rgba(0,82,255,0.2)',
              opacity: isPending ? 0.6 : 1,
            }}
          >
            <span>{isShieldActive ? '🛡️ Extend Shield (+24h)' : '🛡️ Buy Heist Shield'}</span>
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
        minHeight: 280,
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
          <div style={{ maxWidth: 420 }}>
            <div style={{ fontSize: 50, marginBottom: 12, animation: 'boardFloat 3s ease-in-out infinite' }}>🕵️‍♂️</div>
            
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes boardFloat {
                0% { transform: translateY(0px); }
                50% { transform: translateY(-6px); }
                100% { transform: translateY(0px); }
              }
            ` }} />

            <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 900, color: '#0A0B0D', letterSpacing: -0.5 }}>
              Target Vault System
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: 12, lineHeight: 1.6, color: '#717886' }}>
              Ready to initiate a raid. Launching will find a random player with 300+ HP and prompt you to pick a combination card.
            </p>
            <button
              onClick={handleInitiateHeistClick}
              disabled={isPending}
              style={{
                background: 'linear-gradient(135deg, #FF9900 0%, #FF5E62 100%)',
                boxShadow: '0 4px 14px rgba(255, 94, 98, 0.25)',
                border: 'none',
                borderRadius: 12,
                padding: '12px 24px',
                color: '#fff',
                fontWeight: 800,
                fontSize: 13,
                cursor: isPending ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: isPending ? 0.6 : 1
              }}
            >
              Initiate Heist ($0.25 USDC)
            </button>
          </div>
        )}

        {/* GAMESTATE: SCANNING */}
        {gameState === 'scanning' && potentialVictims.length > 0 && (
          <div>
            <div style={{ fontSize: 36, animation: 'spin 2s linear infinite', marginBottom: 12 }}>🔍</div>
            <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: '#0A0B0D' }}>Scanning Active Targets...</h3>
            <p style={{ margin: '0 0 16px', fontSize: 11, color: '#717886' }}>
              Locating active vaults containing 300+ HP on Base...
            </p>
            
            <div style={{
              background: '#F8FAFC',
              border: '1px solid #DEE1E7',
              borderRadius: 12,
              padding: '12px 20px',
              minWidth: 240,
              height: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#FF9900' }}>
                🎯 {potentialVictims[scanIndex]?.basename || short(potentialVictims[scanIndex]?.address)}
              </div>
            </div>
          </div>
        )}

        {/* GAMESTATE: CHOOSE CARD */}
        {gameState === 'choose_card' && (
          <div>
            <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: '#0A0B0D' }}>Target Vault Located!</h3>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: '#717886' }}>
              Owner: <strong style={{ color: '#0052FF' }}>{finalVictim?.basename || short(finalVictim?.address)}</strong>
            </p>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#FF9900', marginBottom: 14 }}>
              Choose a card to execute the heist! (50/50 combination)
            </div>

            <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
              {[0, 1].map(idx => (
                <button
                  key={idx}
                  onClick={() => handleCardSelection(idx)}
                  style={{
                    width: 90,
                    height: 120,
                    background: '#ffffff',
                    border: '2px solid #DEE1E7',
                    borderRadius: 14,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 10px rgba(10,11,13,0.02)'
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = 'translateY(-3px)'
                    e.currentTarget.style.borderColor = '#FF9900'
                    e.currentTarget.style.boxShadow = '0 6px 14px rgba(255, 153, 0, 0.15)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.borderColor = '#DEE1E7'
                    e.currentTarget.style.boxShadow = '0 4px 10px rgba(10,11,13,0.02)'
                  }}
                >
                  <div style={{ fontSize: 24 }}>❓</div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#717886' }}>Card {idx === 0 ? 'A' : 'B'}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* GAMESTATE: FLIPPING */}
        {gameState === 'flipping' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
              width: 90,
              height: 120,
              borderRadius: 14,
              border: '2px solid #FF9900',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 32,
              animation: 'flip 1.2s ease-in-out infinite'
            }}>
              🃏
            </div>
            <h3 style={{ marginTop: 16, fontSize: 13, fontWeight: 800, color: '#0A0B0D' }}>Cracking Vault Combination...</h3>
          </div>
        )}

        {/* GAMESTATE: RESULT */}
        {gameState === 'result' && gameOutcome && (
          <div style={{ maxWidth: 440 }}>
            {gameOutcome.success ? (
              <div>
                <div style={{ fontSize: 50, marginBottom: 8 }}>🎉💰</div>
                <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 900, color: '#059669' }}>
                  Successful Heist!
                </h2>
                <p style={{ margin: '0 0 12px', fontSize: 12, color: '#717886' }}>
                  The combination matched! Stolen points added to your balance.
                </p>

                <div style={{
                  background: '#ECFDF5',
                  border: '1px solid #A7F3D0',
                  borderRadius: 14,
                  padding: '12px 18px',
                  marginBottom: 18
                }}>
                  <div style={{ fontSize: 10, color: '#059669', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>Stolen Reward</div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#059669', margin: '2px 0' }}>
                    +{gameOutcome.stolen_amount} HP
                  </div>
                  <div style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>
                    Victim: <strong style={{ color: '#0A0B0D' }}>{gameOutcome.victim_name || short(gameOutcome.victim_address)}</strong>
                    {gameOutcome.percentage && ` (${gameOutcome.percentage}% of total)`}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 50, marginBottom: 8 }}>💥🔒</div>
                <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 900, color: '#E11D48' }}>
                  Heist Failed
                </h2>
                <p style={{ margin: '0 0 18px', fontSize: 12, color: '#717886', lineHeight: 1.5 }}>
                  The combination lock jammed and vault alarm sounded! You missed the prize card, but you can try again.
                </p>
              </div>
            )}

            <button
              onClick={handlePlayAgain}
              style={{
                background: '#F1F5F9',
                border: '1px solid #DEE1E7',
                borderRadius: 10,
                padding: '10px 24px',
                color: '#32353D',
                fontWeight: 800,
                fontSize: 12,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Close Result
            </button>
          </div>
        )}
      </div>

      {/* ═══ RAID HISTORY (Displayed directly below interactive board) ═══ */}
      <div>
        <h2 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 900, color: '#0A0B0D', letterSpacing: -0.3 }}>
          Successful Raid History
        </h2>
        <p style={{ margin: '0 0 12px', fontSize: 11, color: '#717886' }}>
          Recent successful HP thefts on Base network
        </p>

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
              No successful raids logged yet. Be the first one to pull off a heist!
            </div>
          ) : (
            history.map(item => {
              const thiefName = item.thief?.basename || short(item.thief_address)
              const victimName = item.victim?.basename || short(item.victim_address)
              const timeStr = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

              return (
                <div
                  key={item.id}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #DEE1E7',
                    borderRadius: 14,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    boxShadow: '0 2px 6px rgba(10,11,13,0.01)'
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', color: '#0A0B0D' }}>
                      <span style={{ color: '#FF9900' }}>🕵️‍♂️ {thiefName}</span>
                      <span style={{ color: '#717886', fontWeight: 500 }}>stole from</span>
                      <span style={{ color: '#0052FF' }}>🛡️ {victimName}</span>
                    </div>
                    <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>
                      Time: {timeStr} | tx: <a 
                        href={`https://basescan.org/tx/${item.tx_hash}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        style={{ color: '#0052FF', textDecoration: 'none', fontWeight: 600 }}
                      >
                        {item.tx_hash.slice(0, 8)}...
                      </a>
                    </div>
                  </div>

                  <div style={{
                    background: '#ECFDF5',
                    border: '1px solid #A7F3D0',
                    borderRadius: 8,
                    padding: '4px 8px',
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#059669',
                    textAlign: 'right',
                    flexShrink: 0
                  }}>
                    +{item.stolen_amount} HP
                    {item.percentage && (
                      <div style={{ fontSize: 8, fontWeight: 600, color: 'rgba(5, 150, 105, 0.7)' }}>
                        ({item.percentage}% stolen)
                      </div>
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
          isOpen={showTxModal}
          onClose={() => {
            setShowTxModal(false)
            reset()
          }}
          isPending={isPending}
          isConfirming={isConfirming}
          isSuccess={isSuccess}
          error={writeError}
          txHash={txHash}
          reset={reset}
          title={txType === 'shield' ? 'Purchase Heist Shield' : 'Initiate Happy Heist'}
          desc={txType === 'shield' 
            ? 'Buying 24h shield protection for $0.15 USDC' 
            : 'Initiating heist attempt for $0.25 USDC'}
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
      `}</style>
    </div>
  )
}
