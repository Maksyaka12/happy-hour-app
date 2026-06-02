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
  const [activeTab, setActiveTab] = useState('heist') // heist or history

  // Game UI State
  // 'idle', 'tx_pending', 'scanning', 'choose_card', 'flipping', 'result'
  const [gameState, setGameState] = useState('idle')
  const [scanIndex, setScanIndex] = useState(0)
  const [potentialVictims, setPotentialVictims] = useState([])
  const [finalVictim, setFinalVictim] = useState(null)
  const [gameOutcome, setGameOutcome] = useState(null) // { success, stolen_amount, percentage, victim_address, victim_name }
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
        .limit(20)

      if (!error && data) {
        setHistory(data)
      } else if (error) {
        console.error('Error fetching history:', error)
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Fetch some active users for the visual slot-drum scanning effect
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
        // Fallback simulated pool
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

    // Setup history realtime subscription
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

  // Shield countdown timer
  useEffect(() => {
    if (!user?.shield_expires_at) {
      setIsShieldActive(false)
      setShieldTimeLeft('')
      return
    }

    const updateTimer = () => {
      const expiry = new Date(user.shield_expires_at).getTime()
      const now = new Date().getTime()
      const diff = expiry - now

      if (diff <= 0) {
        setIsShieldActive(false)
        setShieldTimeLeft('')
      } else {
        setIsShieldActive(true)
        const hours = Math.floor(diff / (1000 * 60 * 60))
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diff % (1000 * 60)) / 1000)

        const hStr = hours > 0 ? `${hours}h ` : ''
        const mStr = minutes > 0 || hours > 0 ? `${minutes}m ` : ''
        setShieldTimeLeft(`${hStr}${mStr}${seconds}s`)
      }
    }

    updateTimer()
    const timer = setInterval(updateTimer, 1000)
    return () => clearInterval(timer)
  }, [user?.shield_expires_at])

  // Handle blockchain transaction success
  useEffect(() => {
    if (isSuccess && txHash) {
      if (txType === 'shield') {
        handleConfirmShieldPurchase(txHash)
      } else if (txType === 'heist') {
        handleConfirmHeist(txHash)
      }
    }
  }, [isSuccess, txHash])

  // Initiate USDC payment for shield
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

  // Initiate USDC payment for heist
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

  // Confirm shield purchase in Supabase
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

  // Confirm heist transaction in Supabase
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

        // Spin slot-drum effect for 2.5 seconds
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
              // Simulated final slot choice for visual continuity
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
    <div style={{ padding: '0 12px 120px', color: '#0A0B0D', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      
      {/* Top Header Tab Selector Switcher */}
      <div style={{
        display: 'flex',
        background: 'rgba(0, 0, 0, 0.04)',
        border: '1px solid rgba(0, 0, 0, 0.06)',
        borderRadius: 14,
        padding: 4,
        marginBottom: 20,
        maxWidth: 380,
        margin: '0 auto 20px'
      }}>
        <button
          onClick={() => setActiveTab('heist')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: 10,
            border: 'none',
            background: activeTab === 'heist' ? '#0052FF' : 'transparent',
            color: activeTab === 'heist' ? '#fff' : '#717886',
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'heist' ? '0 4px 12px rgba(0, 82, 255, 0.2)' : 'none'
          }}
        >
          🕵️ Heist Mode
        </button>
        <button
          onClick={() => setActiveTab('history')}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: 10,
            border: 'none',
            background: activeTab === 'history' ? '#0052FF' : 'transparent',
            color: activeTab === 'history' ? '#fff' : '#717886',
            fontWeight: 800,
            fontSize: 13,
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: activeTab === 'history' ? '0 4px 12px rgba(0, 82, 255, 0.2)' : 'none'
          }}
        >
          🔥 Raid History
        </button>
      </div>

      {activeTab === 'heist' ? (
        <div>
          {/* Shield Status Panel - Legible Premium Light Theme */}
          <div style={{
            background: isShieldActive 
              ? 'linear-gradient(135deg, rgba(0, 82, 255, 0.06) 0%, rgba(0, 198, 251, 0.03) 100%)' 
              : '#ffffff',
            border: isShieldActive 
              ? '1px solid rgba(0, 82, 255, 0.25)' 
              : '1px solid #DEE1E7',
            boxShadow: isShieldActive 
              ? '0 8px 24px rgba(0, 82, 255, 0.05)'
              : '0 4px 12px rgba(10,11,13,0.02)',
            borderRadius: 20,
            padding: '16px 20px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            transition: 'all 0.3s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: isShieldActive ? 'rgba(0, 82, 255, 0.1)' : '#F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                boxShadow: isShieldActive ? '0 0 10px rgba(0, 82, 255, 0.2)' : 'none',
              }}>
                🛡️
              </div>
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: isShieldActive ? '#0052FF' : '#0A0B0D' }}>
                  {isShieldActive ? 'Heist Shield Active' : 'Heist Shield Inactive'}
                </h3>
                <p style={{ margin: '3px 0 0', fontSize: 11, color: '#717886', lineHeight: 1.3 }}>
                  {isShieldActive 
                    ? 'You are protected! Excluded from victim pool.' 
                    : 'Get 24h protection from all HP stealing raids.'}
                </p>
              </div>
            </div>

            <div style={{ flexShrink: 0 }}>
              {isShieldActive ? (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    fontFamily: "'DM Mono', monospace", 
                    fontSize: 16, 
                    fontWeight: 900, 
                    color: '#0052FF'
                  }}>
                    {shieldTimeLeft}
                  </div>
                  <button
                    onClick={handlePurchaseShieldClick}
                    style={{
                      marginTop: 4,
                      background: '#F1F5F9',
                      border: '1px solid #DEE1E7',
                      borderRadius: 8,
                      padding: '4px 8px',
                      color: '#32353D',
                      fontSize: 9,
                      fontWeight: 800,
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = '#EEF2F6'}
                    onMouseLeave={e => e.currentTarget.style.background = '#F1F5F9'}
                  >
                    Extend (+24h) $0.15
                  </button>
                </div>
              ) : (
                <button
                  onClick={handlePurchaseShieldClick}
                  style={{
                    background: 'linear-gradient(135deg, #0052FF 0%, #00C6FB 100%)',
                    boxShadow: '0 4px 12px rgba(0, 82, 255, 0.2)',
                    border: 'none',
                    borderRadius: 12,
                    padding: '10px 14px',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  Buy Shield $0.15
                </button>
              )}
            </div>
          </div>

          {/* Main Heist Interactive Board - Legible Premium Light Theme */}
          <div style={{
            background: 'linear-gradient(135deg, #F8F9FC 0%, #ffffff 100%)',
            border: '1px solid #DEE1E7',
            borderRadius: 24,
            padding: '32px 20px',
            textAlign: 'center',
            minHeight: 340,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
            boxShadow: '0 8px 32px rgba(10,11,13,0.04)',
            overflow: 'hidden'
          }}>

            {errorMessage && (
              <div style={{
                background: 'rgba(252, 64, 31, 0.08)',
                border: '1px solid rgba(252, 64, 31, 0.2)',
                borderRadius: 12,
                padding: '10px 14px',
                color: '#FC401F',
                fontSize: 13,
                fontWeight: 700,
                marginBottom: 16,
                maxWidth: '90%'
              }}>
                ⚠️ {errorMessage}
              </div>
            )}

            {/* STAGE 1: IDLE / START HEIST */}
            {gameState === 'idle' && (
              <div style={{ maxWidth: 420 }}>
                <div style={{ fontSize: 60, marginBottom: 12, animation: 'float 3s ease-in-out infinite' }}>🕵️‍♂️</div>
                <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 900, color: '#0A0B0D', letterSpacing: -0.5 }}>
                  Launch a Happy Heist
                </h2>
                <p style={{ margin: '0 0 24px', fontSize: 13, lineHeight: 1.6, color: '#717886' }}>
                  For just **$0.25 USDC**, raid an active user with 300+ HP. Try your luck in a 50/50 card game to steal 10 HP or up to 5% of their total points!
                </p>
                <button
                  onClick={handleInitiateHeistClick}
                  style={{
                    background: 'linear-gradient(135deg, #FF9900 0%, #FF5E62 100%)',
                    boxShadow: '0 6px 20px rgba(255, 94, 98, 0.25)',
                    border: 'none',
                    borderRadius: 16,
                    padding: '14px 32px',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: 15,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                >
                  Initiate Heist ($0.25)
                </button>
              </div>
            )}

            {/* STAGE 2: SCANNING VICTIMS */}
            {gameState === 'scanning' && potentialVictims.length > 0 && (
              <div>
                <div style={{ fontSize: 44, animation: 'spin 2s linear infinite', marginBottom: 16 }}>🔍</div>
                <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 800, color: '#0A0B0D' }}>Scanning Active Targets...</h3>
                <p style={{ margin: '0 0 24px', fontSize: 12, color: '#717886' }}>
                  Looking for active vaults containing 300+ HP on Base...
                </p>
                
                {/* Visual slot-drum effect */}
                <div style={{
                  background: '#F1F5F9',
                  border: '1px solid #DEE1E7',
                  borderRadius: 16,
                  padding: '16px 24px',
                  width: 260,
                  height: 56,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative'
                }}>
                  <div style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: '#FF9900',
                    transition: 'transform 0.1s ease'
                  }}>
                    🎯 {potentialVictims[scanIndex]?.basename || short(potentialVictims[scanIndex]?.address)}
                  </div>
                </div>
              </div>
            )}

            {/* STAGE 3: CARD SELECTION */}
            {gameState === 'choose_card' && (
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 900, color: '#0A0B0D' }}>Target Vault Located!</h3>
                <p style={{ margin: '0 0 16px', fontSize: 13, color: '#717886' }}>
                  Locked vault belongs to: <strong style={{ color: '#0052FF' }}>{finalVictim?.basename || short(finalVictim?.address)}</strong>
                </p>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#FF9900', marginBottom: 16 }}>
                  Choose one of the cards to break the lock! (50/50 Chance)
                </div>

                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 10 }}>
                  {[0, 1].map(idx => (
                    <button
                      key={idx}
                      onClick={() => handleCardSelection(idx)}
                      style={{
                        width: 104,
                        height: 140,
                        background: '#ffffff',
                        border: '2px solid #DEE1E7',
                        borderRadius: 16,
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 10,
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 12px rgba(10,11,13,0.03)'
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'translateY(-4px)'
                        e.currentTarget.style.borderColor = '#0052FF'
                        e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 82, 255, 0.15)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'translateY(0)'
                        e.currentTarget.style.borderColor = '#DEE1E7'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(10,11,13,0.03)'
                      }}
                    >
                      <div style={{ fontSize: 28 }}>❓</div>
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#717886' }}>Card {idx === 0 ? 'A' : 'B'}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STAGE 4: FLIPPING */}
            {gameState === 'flipping' && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: 104,
                  height: 140,
                  borderRadius: 16,
                  border: '2px solid #FF9900',
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 36,
                  animation: 'flip 1.2s ease-in-out infinite'
                }}>
                  🃏
                </div>
                <h3 style={{ marginTop: 20, fontSize: 15, fontWeight: 800, color: '#0A0B0D' }}>Flipping Card...</h3>
              </div>
            )}

            {/* STAGE 5: RESULT REVEAL */}
            {gameState === 'result' && gameOutcome && (
              <div style={{ maxWidth: 440 }}>
                {gameOutcome.success ? (
                  <div>
                    <div style={{ fontSize: 60, marginBottom: 12 }}>🎉🏆</div>
                    <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 900, color: '#00C853' }}>
                      Successful Heist!
                    </h2>
                    <p style={{ margin: '0 0 16px', fontSize: 13, color: '#717886' }}>
                      You successfully broke the vault lock and stole points!
                    </p>

                    <div style={{
                      background: 'rgba(0, 200, 83, 0.05)',
                      border: '1px solid rgba(0, 200, 83, 0.2)',
                      borderRadius: 18,
                      padding: '16px 20px',
                      marginBottom: 24
                    }}>
                      <div style={{ fontSize: 11, color: '#717886', fontWeight: 600 }}>Stolen Points:</div>
                      <div style={{ fontSize: 32, fontWeight: 900, color: '#00C853', margin: '4px 0' }}>
                        +{gameOutcome.stolen_amount} HP
                      </div>
                      <div style={{ fontSize: 12, color: '#32353D', fontWeight: 600 }}>
                        Victim: <strong style={{ color: '#0A0B0D' }}>{gameOutcome.victim_name || short(gameOutcome.victim_address)}</strong>
                        {gameOutcome.percentage && ` (${gameOutcome.percentage}% of their balance)`}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 60, marginBottom: 12 }}>💥💀</div>
                    <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 900, color: '#FF5E62' }}>
                      Vault Lock Jammed!
                    </h2>
                    <p style={{ margin: '0 0 24px', fontSize: 13, lineHeight: 1.6, color: '#717886' }}>
                      The alarm was triggered and the vault locked down! You missed the prize card, but you gave it a good try. Better luck on the next run!
                    </p>
                  </div>
                )}

                <button
                  onClick={handlePlayAgain}
                  style={{
                    background: '#F1F5F9',
                    border: '1px solid #DEE1E7',
                    borderRadius: 12,
                    padding: '12px 28px',
                    color: '#32353D',
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#EEF2F6'}
                  onMouseLeave={e => e.currentTarget.style.background = '#F1F5F9'}
                >
                  Play Again
                </button>
              </div>
            )}

          </div>
        </div>
      ) : (
        /* RAID HISTORY FEED (Successful Raids Only) - Legible Premium Light Theme */
        <div>
          <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 900, color: '#0A0B0D', letterSpacing: -0.5 }}>
            Successful Raids
          </h2>
          <p style={{ margin: '0 0 16px', fontSize: 12, color: '#717886' }}>
            Real-time feed of the most daring successful bank-raids on Base!
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {history.length === 0 ? (
              <div style={{
                background: '#ffffff',
                border: '1px solid #DEE1E7',
                borderRadius: 16,
                padding: '24px 16px',
                textAlign: 'center',
                color: '#717886',
                fontSize: 12
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
                      borderRadius: 16,
                      padding: '12px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 12,
                      boxShadow: '0 2px 6px rgba(10,11,13,0.01)'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: '#0A0B0D' }}>
                        <span style={{ color: '#FF9900' }}>🕵️‍♂️ {thiefName}</span>
                        <span style={{ color: '#717886', fontWeight: 500 }}>raided</span>
                        <span style={{ color: '#0052FF' }}>🛡️ {victimName}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                        Time: {timeStr} | tx: <a 
                          href={`https://basescan.org/tx/${item.tx_hash}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ color: '#0052FF', textDecoration: 'none', fontWeight: 600 }}
                        >
                          {item.tx_hash.slice(0, 10)}...
                        </a>
                      </div>
                    </div>

                    <div style={{
                      background: 'rgba(0, 200, 83, 0.06)',
                      border: '1px solid rgba(0, 200, 83, 0.2)',
                      borderRadius: 10,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#00C853',
                      textAlign: 'right',
                      flexShrink: 0
                    }}>
                      +{item.stolen_amount} HP
                      {item.percentage && (
                        <div style={{ fontSize: 8, fontWeight: 600, color: 'rgba(0, 200, 83, 0.7)' }}>
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
      )}

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
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
          100% { transform: translateY(0px); }
        }
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
