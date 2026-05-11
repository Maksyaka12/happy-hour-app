import React, { useState, useEffect } from 'react'
import { useChainId, useSwitchChain } from 'wagmi'
import { parseUnits } from 'viem'
import { base } from 'wagmi/chains'
import { CHECKIN_TARGET, USDC_ADDRESS, USDC_ABI } from '../config/constants'
import { db } from '../config/supabase'
import { useBuilderWrite } from '../hooks/useBuilderWrite'
import { TxModal } from './TxModal'

export function HappyBoxesSection({ address, profile, onUpdate }) {
  const [selectedBox, setSelectedBox] = useState(null)
  const [isOpening, setIsOpening] = useState(false)
  const [openResult, setOpenResult] = useState(null)
  const [animPhase, setAnimPhase] = useState(0) // 0: init, 1: show base hp, 2: show mult, 3: count up, 4: done
  const [displayHp, setDisplayHp] = useState(0)

  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const wrongChain = chainId !== base.id

  const { data: txHash, writeContract, isPending, isConfirming, isSuccess, error: writeError, reset } = useBuilderWrite()

  const boxes = [
    {
      id: 'common',
      name: 'Common Box',
      price: 0.20,
      color: '#8B5A2B',
      bg: '#FAF4ED',
      img: '/common_box.png',
      rewards: '4 - 8 HP'
    },
    {
      id: 'epic',
      name: 'Epic Box',
      price: 0.45,
      color: '#9333EA',
      bg: '#F3E8FF',
      img: '/epic_box.png',
      rewards: '10 - 20 HP + Chance for 2x Boost'
    },
    {
      id: 'legendary',
      name: 'Legendary Box',
      price: 0.95,
      color: '#D97706',
      bg: '#FEF3C7',
      img: '/legendary_box.png',
      rewards: '21 - 40 HP + Chance for 5x Boost'
    }
  ]

  // Process RPC after successful tx
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
            // Artificial delay for opening animation
            await new Promise(r => setTimeout(r, 2000))
            const baseHp = Math.round(data.hp_won / data.applied_multiplier)
            setOpenResult({
              hp: data.hp_won,
              mult: data.applied_multiplier,
              wonNewMult: data.multiplier_won > 1,
              baseHp: baseHp
            })
            if (onUpdate) onUpdate()
          } else {
            console.error(data?.error)
            alert(data?.error || 'Failed to open box')
          }
        } catch (err) {
          console.error(err)
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

  // Counting animation
  useEffect(() => {
    if (openResult && animPhase === 0) {
      if (openResult.mult > 1) {
        setDisplayHp(openResult.baseHp)
        setAnimPhase(1)

        setTimeout(() => {
          setAnimPhase(2) // show mult sticker

          setTimeout(() => {
            setAnimPhase(3) // start counting
            const target = openResult.hp
            const duration = 1200
            const start = Date.now()

            const timer = setInterval(() => {
              const timePassed = Date.now() - start
              if (timePassed >= duration) {
                setDisplayHp(target)
                setAnimPhase(4)
                clearInterval(timer)
              } else {
                const progress = timePassed / duration
                const easeProgress = progress * (2 - progress)
                setDisplayHp(Math.round(openResult.baseHp + (target - openResult.baseHp) * easeProgress))
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

  const handleOpenClick = (box) => {
    setSelectedBox(box)
  }

  const handleConfirm = () => {
    if (wrongChain) { switchChain({ chainId: base.id }); return }
    if (!selectedBox) return

    writeContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [CHECKIN_TARGET, parseUnits(selectedBox.price.toString(), 6)],
      chainId: base.id,
    })
  }

  const closeResultModal = () => {
    setOpenResult(null)
    setAnimPhase(0)
    setDisplayHp(0)
  }

  return (
    <div style={{ padding: '0 16px 120px', animation: 'fadeIn 0.3s ease' }}>
      <style>
        {`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          
          @keyframes magicBox {
            0%, 100% { transform: rotate(0deg) scale(1); filter: drop-shadow(0 0 10px rgba(255,255,255,0.2)); }
            25% { transform: rotate(-8deg) scale(1.1); filter: drop-shadow(0 0 25px rgba(255,255,255,0.7)); }
            50% { transform: rotate(8deg) scale(1.1); filter: drop-shadow(0 0 35px rgba(255,255,255,0.9)); }
            75% { transform: rotate(-8deg) scale(1.1); filter: drop-shadow(0 0 25px rgba(255,255,255,0.7)); }
          }
          
          @keyframes pulseGold {
            0% { box-shadow: inset 0 0 15px rgba(217,119,6,0.1), 0 0 0px rgba(217,119,6,0); }
            50% { box-shadow: inset 0 0 25px rgba(217,119,6,0.2), 0 0 15px rgba(217,119,6,0.3); }
            100% { box-shadow: inset 0 0 15px rgba(217,119,6,0.1), 0 0 0px rgba(217,119,6,0); }
          }

          @keyframes bobbing {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
          }
          
          .box-card { transition: all 0.2s ease; }
          .box-card:active { transform: scale(0.98); }
        `}
      </style>

      {wrongChain && (
        <div style={{
          background: '#FFFBEB', border: '1px solid #FEF3C7',
          borderRadius: 12, padding: '10px 16px', marginBottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span style={{ fontSize: 13, color: '#D97706', fontWeight: 600 }}>Switch to Base Mainnet</span>
          <button
            onClick={() => switchChain({ chainId: base.id })}
            style={{ background: '#D97706', color: '#fff', borderRadius: 50, padding: '6px 14px', fontSize: 12, fontWeight: 700, border: 'none', cursor: 'pointer' }}
          >
            {isSwitching ? 'Switching…' : 'Switch'}
          </button>
        </div>
      )}

      {/* Header Banner - Dynamic Airdrop Style */}
      <div style={{
        background: 'linear-gradient(135deg, #0000FF 0%, #4F46E5 100%)',
        borderRadius: 24,
        padding: '24px 20px',
        marginBottom: 16,
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,255,0.2)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: 120
      }}>
        {/* Scattered Airdrop Assets */}
        <img src="/background_box.png" style={{ position: 'absolute', top: -10, right: '10%', width: 70, opacity: 0.6, transform: 'rotate(-15deg)', filter: 'blur(1.5px)' }} alt="" />
        <img src="/background_box.png" style={{ position: 'absolute', top: 40, right: '25%', width: 50, opacity: 0.4, transform: 'rotate(10deg)', filter: 'blur(0.5px)' }} alt="" />
        <img src="/background_box.png" style={{ position: 'absolute', bottom: -15, right: '40%', width: 90, opacity: 0.3, transform: 'rotate(-25deg)', filter: 'blur(3px)' }} alt="" />
        <img src="/background_box.png" style={{ position: 'absolute', top: -20, left: '50%', width: 45, opacity: 0.5, transform: 'rotate(20deg)', filter: 'blur(1px)' }} alt="" />
        <img src="/background_box.png" style={{ position: 'absolute', bottom: 10, right: '5%', width: 55, opacity: 0.4, transform: 'rotate(5deg)', filter: 'blur(1px)' }} alt="" />

        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ fontSize: 18, color: '#fff', lineHeight: 1.2, fontWeight: 800 }}>
            Open your Happy Boxes
          </div>
          <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.9)', lineHeight: 1.2, fontWeight: 800 }}>
            to win HP and Boosts
          </div>
        </div>

        {/* Abstract Glow */}
        <div style={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 150,
          height: 150,
          background: 'rgba(255,255,255,0.15)',
          borderRadius: '50%',
          filter: 'blur(50px)',
          zIndex: 1
        }} />
      </div>

      {/* Box List */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
        {boxes.map((box) => (
          <div key={box.id} className="box-card" style={{
            background: box.id === 'legendary' ? '#FEF9EB' : box.id === 'epic' ? '#F9F5FF' : '#fff', 
            border: `1.5px solid ${box.id === 'legendary' ? '#D97706' : box.id === 'epic' ? '#9333EA' : '#DEE1E7'}`, 
            borderRadius: 20,
            padding: 10, 
            boxShadow: box.id === 'legendary' ? '0 8px 20px rgba(217,119,6,0.15)' : box.id === 'epic' ? '0 8px 20px rgba(147,51,234,0.1)' : '0 4px 12px rgba(10,11,13,0.03)',
            display: 'flex', 
            alignItems: 'center', 
            gap: 14,
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Tier Badge */}
            <div style={{
              position: 'absolute',
              top: 0,
              right: 0,
              background: box.id === 'legendary' ? '#D97706' : box.id === 'epic' ? '#9333EA' : '#0000FF',
              color: '#fff',
              fontSize: 8,
              fontWeight: 900,
              width: 64,
              height: 18,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderBottomLeftRadius: 12,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              zIndex: 2
            }}>
              {box.id === 'legendary' ? 'Jackpot' : box.id === 'epic' ? 'Hot' : 'Common'}
            </div>

            <div style={{
              width: 90, height: 90,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              animation: `${box.id === 'legendary' ? 'pulseGold 2s infinite, ' : ''}bobbing ${box.id === 'legendary' ? '2s' : box.id === 'epic' ? '2.5s' : '3s'} ease-in-out infinite`
            }}>
              <img 
                src={box.img} 
                alt={box.name} 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'contain',
                  mixBlendMode: 'multiply'
                }} 
              />
            </div>

            {/* Right side — Info & Button */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#0A0B0D' }}>{box.name}</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <div style={{ display: 'flex' }}>
                  <span style={{
                    background: box.bg, color: box.color,
                    padding: '2px 8px', borderRadius: 8,
                    fontSize: 9, fontWeight: 800,
                    border: `1px solid ${box.color}20`,
                    whiteSpace: 'nowrap',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    ⚡ {box.id === 'common' ? '4 - 8 HP' : box.id === 'epic' ? '10 - 20 HP' : '21 - 40 HP'}
                  </span>
                </div>
                {box.id !== 'common' && (
                  <div style={{ display: 'flex' }}>
                    <span style={{
                      background: box.id === 'legendary' ? 'rgba(251, 191, 36, 0.15)' : 'rgba(147, 51, 234, 0.1)', 
                      color: box.id === 'legendary' ? '#B45309' : '#9333EA',
                      padding: '2px 8px', borderRadius: 8,
                      fontSize: 9, fontWeight: 800,
                      border: `1px solid ${box.id === 'legendary' ? 'rgba(251, 191, 36, 0.3)' : 'rgba(147, 51, 234, 0.3)'}`,
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      🔥 {box.id === 'epic' ? 'Chance for 2x Boost' : 'Chance for 5x Boost'}
                    </span>
                  </div>
                )}
              </div>

              <button
                onClick={() => handleOpenClick(box)}
                disabled={isPending || isConfirming || isOpening}
                style={{
                  background: box.id === 'legendary' ? '#D97706' : box.id === 'epic' ? '#9333EA' : '#0000FF',
                  color: '#fff',
                  borderRadius: 50,
                  padding: '8px 12px',
                  fontSize: 12,
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: box.id === 'legendary' ? '0 4px 14px rgba(217,119,6,0.3)' : box.id === 'epic' ? '0 4px 14px rgba(147,51,234,0.3)' : '0 4px 12px rgba(0,0,255,0.2)',
                  opacity: (isPending || isConfirming || isOpening) ? 0.6 : 1,
                  width: '100%',
                  marginTop: 2,
                  transition: 'transform 0.1s active'
                }}
              >
                OPEN BOX <span style={{ color: box.id === 'legendary' ? '#FFFBEB' : box.id === 'epic' ? '#F3E8FF' : '#A5B4FC', marginLeft: 6, display: 'flex', alignItems: 'center', opacity: 0.9 }}>
                  {box.price.toFixed(2)}
                  <img src="/usdc-logo.png" alt="USDC" style={{ width: 12, height: 12, marginLeft: 4 }} />
                </span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* How it Works Section */}
      <div style={{
        marginTop: 24,
        background: '#EEF0F3',
        border: '1px solid #DEE1E7',
        borderRadius: 20,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: '#64748B', letterSpacing: 1, textTransform: 'uppercase' }}>
          How it works
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            ['How do Happy Boxes work?', 'Choose a box to try your luck and win HP instantly. Each box has a different range of possible rewards.'],
            ['What can I win?', 'Every box contains HP. Epic and Legendary boxes also give you a chance to win a 2x or 5x boost.'],
            ['Are rewards guaranteed?', 'Yes, every box contains at least the minimum amount of HP shown in the description.'],
            ['How does the multiplier work?', 'If you have an active multiplier, it will be applied to your boxes. If you win a higher boost from a box, it will be applied instantly and last for 24h for all earned HP. Once it expires, your permanent multiplier resumes.'],
          ].map(([q, a], i) => (
            <div key={i}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#0A0B0D', marginBottom: 4 }}>{q}</div>
              <div style={{ fontSize: 10, color: '#64748B', lineHeight: 1.5, fontWeight: 500 }}>{a}</div>
            </div>
          ))}
        </div>
      </div>

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

      {isOpening && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(10,11,13,0.7)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ fontSize: 100, animation: 'magicBox 0.5s infinite, bobbing 1.5s ease-in-out infinite' }}>
            <img src={selectedBox?.img} style={{ width: 120, height: 120, objectFit: 'contain' }} />
          </div>
        </div>
      )}

      {openResult && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(10,11,13,0.7)', zIndex: 2000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{
            background: '#fff', borderRadius: 24, padding: '30px 24px', width: '90%', maxWidth: 360,
            textAlign: 'center', animation: 'fadeIn 0.3s ease', position: 'relative',
            boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
          }}>
            <div style={{ fontSize: 60, marginBottom: 10, animation: 'bouncePulse 1.5s infinite' }}>🎉</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#0A0B0D', marginBottom: 8 }}>You Won!</div>

            <div style={{ fontSize: 36, fontWeight: 900, color: '#0000FF', fontFamily: "'Barlow Condensed', sans-serif", marginBottom: 16 }}>
              +{displayHp} HP
            </div>

            {openResult.mult > 1 && animPhase >= 2 && (
              <div style={{
                display: 'inline-block', background: openResult.mult >= 5 ? 'rgba(147, 51, 234, 0.1)' : 'rgba(5, 150, 105, 0.1)',
                color: openResult.mult >= 5 ? '#9333EA' : '#059669',
                padding: '6px 16px', borderRadius: 50, fontSize: 15, fontWeight: 800, border: `1px solid ${openResult.mult >= 5 ? 'rgba(147, 51, 234, 0.3)' : 'rgba(5, 150, 105, 0.3)'}`,
                marginBottom: 16,
                animation: 'fadeIn 0.4s ease'
              }}>
                {openResult.wonNewMult
                  ? `⭐ You won a ${openResult.mult}x Boost!`
                  : `⭐ Active ${openResult.mult}x Boost Applied!`}
              </div>
            )}

            {animPhase < 4 && openResult.mult > 1 && (
              <div style={{ height: 43, marginBottom: 16 }} /> /* Placeholder to prevent jumping */
            )}

            <button
              onClick={closeResultModal}
              disabled={animPhase < 4}
              style={{
                width: '100%', background: animPhase < 4 ? '#A5B4FC' : '#0000FF', color: '#fff',
                borderRadius: 50, padding: '14px', fontSize: 15, fontWeight: 700,
                border: 'none', cursor: animPhase < 4 ? 'default' : 'pointer', marginTop: 10,
                boxShadow: animPhase < 4 ? 'none' : '0 4px 14px rgba(0,0,255,0.3)',
                transition: 'all 0.3s'
              }}
            >
              Awesome
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
