import { useState, useEffect, useRef } from 'react'
import { useAccount, useReadContract, useChainId, useSwitchChain } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { base } from 'wagmi/chains'
import { db } from '../config/supabase'
import { CHECKIN_TARGET, USDC_ADDRESS, USDC_ABI, CHECKIN_AMOUNT, BOOST_AMOUNT, HH_ADDRESS, HH_MANAGER_ADDRESS, HH_ABI } from '../config/constants'
import { useBuilderWrite } from '../hooks/useBuilderWrite'
import { TxModal } from './TxModal'
import { RaidMode } from './RaidMode'
import { StakingSection } from './StakingSection'

// Helper for date
const todayUTC = () => new Date().toISOString().split('T')[0]

const formatConcise = (num) => {
  const n = parseFloat(num || 0)
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'm'
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k'
  return Math.round(n).toString()
}

export function EarnSection({ setTab, address: propAddress }) {
  const { address: accountAddress } = useAccount()
  const address = propAddress || accountAddress
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  
  const [checkedToday, setCheckedToday] = useState(false)
  const [boostedToday, setBoostedToday] = useState(false)
  const [streakCount, setStreakCount] = useState(0)
  const [points, setPoints] = useState(0)
  const [txModal, setTxModal] = useState(false) // 'checkin' | 'boost' | false
  const [payWithHh, setPayWithHh] = useState(false)
  
  const [checkinError, setCheckinError] = useState('')
  const [boostError, setBoostError] = useState('')
  const [hhPrice, setHhPrice] = useState(0.00025)
  
  const today = todayUTC()
  const processedTxRef = useRef(null)
  const processedBoostTxRef = useRef(null)

  // Read HH allowance for HH_MANAGER_ADDRESS
  const { data: hhAllowanceRaw } = useReadContract({
    address: HH_ADDRESS,
    abi: HH_ABI,
    functionName: 'allowance',
    args: address && HH_MANAGER_ADDRESS ? [address, HH_MANAGER_ADDRESS] : undefined,
    query: { enabled: !!address, refetchInterval: 10000 }
  })
  const hhAllowance = hhAllowanceRaw !== undefined ? parseFloat(formatUnits(hhAllowanceRaw, 18)) : 0


  // Fetch HH price from DexScreener
  useEffect(() => {
    const getPrice = async () => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${HH_ADDRESS}`)
        const data = await res.json()
        const pair = data.pairs?.[0]
        if (pair) {
          setHhPrice(parseFloat(pair.priceUsd) || 0.00025)
        }
      } catch (err) {
        console.error('DexScreener API error in EarnSection:', err)
      }
    }
    getPrice()
    const interval = setInterval(getPrice, 30000)
    return () => clearInterval(interval)
  }, [])

  const { data: txHash, writeContract, isPending, isConfirming, isSuccess, error: writeError, reset } = useBuilderWrite()
  const { data: boostTxHash, writeContract: writeBoost, isPending: isPendingBoost, isConfirming: isConfirmingBoost, isSuccess: isSuccessBoost, error: boostWriteError, reset: resetBoost } = useBuilderWrite()

  // Load user profile details for Check-in & Boost
  const loadProfile = async () => {
    if (!address) return
    try {
      const { data, error } = await db
        .from('users')
        .select('streak, streak_last, boost_last, points')
        .eq('address', address.toLowerCase())
        .maybeSingle()

      if (!error && data) {
        setStreakCount(data.streak || 0)
        setCheckedToday(data.streak_last === today)
        setBoostedToday(data.boost_last === today)
        setPoints(data.points || 0)
      }
    } catch (err) {
      console.error('Error loading checkin profile:', err)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [address, today])

  // Scroll to element if redirecting from Checklist
  useEffect(() => {
    const targetId = sessionStorage.getItem('scroll_to_element')
    if (targetId) {
      setTimeout(() => {
        const el = document.getElementById(targetId)
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
          sessionStorage.removeItem('scroll_to_element')
        }
      }, 350)
    }
  }, [address])

  // --- Check-in Success Effect ---
  useEffect(() => {
    if (!isSuccess || !txHash || processedTxRef.current === txHash || !address) return

    processedTxRef.current = txHash
    setCheckinError('')

    db.rpc('process_checkin', {
      p_address: address.toLowerCase(),
      p_tx_hash: txHash,
    }).then(async ({ data, error }) => {
      if (error) {
        console.error('process_checkin:', error)
        setCheckinError('Check-in saved onchain, but database sync failed. Reloading...')
        await loadProfile()
        return
      }

      if (!data?.ok) {
        setCheckinError(data?.error || 'Check-in was not accepted.')
        await loadProfile()
        return
      }

      setCheckedToday(true)
      setStreakCount(data.newStreak ?? streakCount)
      setTxModal(false)
    }).finally(() => {
      reset()
    })
  }, [address, isSuccess, txHash, today, reset, streakCount])

  // --- Boost Success Effect ---
  useEffect(() => {
    if (!isSuccessBoost || !boostTxHash || processedBoostTxRef.current === boostTxHash || !address) return

    processedBoostTxRef.current = boostTxHash
    setBoostError('')

    if (payWithHh) {
      const hhCost = 0.10 / hhPrice
      if (hhAllowance < hhCost) {
        // This was approval tx. Just close modal and reset.
        setTxModal(false)
        resetBoost()
        return
      }
    }

    const rpcName = payWithHh ? 'process_hp_boost_hh' : 'process_hp_boost'

    db.rpc(rpcName, {
      p_address: address.toLowerCase(),
      p_tx_hash: boostTxHash,
    }).then(async ({ data, error }) => {
      if (error) {
        console.error(rpcName, error)
        setBoostError('Boost saved onchain, but database sync failed.')
        await loadProfile()
        return
      }

      if (!data?.ok) {
        setBoostError(data?.error || 'Boost was not accepted.')
        await loadProfile()
        return
      }

      setBoostedToday(true)
      setTxModal(false)
    }).finally(() => {
      resetBoost()
    })
  }, [address, isSuccessBoost, boostTxHash, today, resetBoost])

  // Trigger Check-in Contract call
  const sendCheckin = () => {
    setCheckinError('')
    if (chainId !== base.id) {
      switchChain({ chainId: base.id })
      return
    }

    writeContract({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [CHECKIN_TARGET, parseUnits(CHECKIN_AMOUNT.toFixed(6), 6)],
      chainId: base.id,
    })
  }

  // Trigger Boost Contract call
  const sendBoost = () => {
    setBoostError('')
    if (chainId !== base.id) {
      switchChain({ chainId: base.id })
      return
    }

    if (payWithHh) {
      const hhCost = 0.10 / hhPrice
      if (hhAllowance < hhCost) {
        // Trigger infinite approve
        writeBoost({
          address: HH_ADDRESS,
          abi: HH_ABI,
          functionName: 'approve',
          args: [HH_MANAGER_ADDRESS, 115792089237316195423570985008687907853269984665640564039457584007913129639935n], // max uint256
          chainId: base.id,
        })
      } else {
        // Trigger payWithHH contract call
        writeBoost({
          address: HH_MANAGER_ADDRESS,
          abi: [
            {
              name: 'payWithHH',
              type: 'function',
              inputs: [
                { name: '_amount', type: 'uint256' },
                { name: '_serviceType', type: 'string' }
              ],
              outputs: [],
              stateMutability: 'nonpayable',
            }
          ],
          functionName: 'payWithHH',
          args: [parseUnits(hhCost.toFixed(18), 18), 'boost'],
          chainId: base.id,
        })
      }
    } else {
      // Pay with USDC (6 decimals)
      writeBoost({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [CHECKIN_TARGET, parseUnits(BOOST_AMOUNT.toFixed(6), 6)],
        chainId: base.id,
      })
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 12px 120px', animation: 'fadeIn 0.3s ease-out' }}>
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes floatingLogo {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0px); }
        }
      ` }} />

      {/* Section Banner */}
      <div style={{
        backgroundImage: 'url(/banner.jpg)',
        backgroundColor: '#0000FF',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderRadius: 24,
        padding: '36px 20px',
        marginBottom: 4,
        position: 'relative',
        minHeight: 120,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.1)',
        boxSizing: 'border-box'
      }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 0 }} />
        
        {/* Floating $HH Logos */}
        {[
          { top: '10%', left: '8%', size: 38, opacity: 0.45, r: '-15deg', blur: 0.4, dur: 4.5 },
          { bottom: '10%', left: '22%', size: 28, opacity: 0.4, r: '10deg', blur: 0, dur: 5.2 },
          { top: '8%', right: '12%', size: 44, opacity: 0.5, r: '18deg', blur: 0.5, dur: 3.8 },
          { top: '45%', right: '28%', size: 24, opacity: 0.35, r: '-8deg', blur: 0.8, dur: 6.0 },
          { bottom: '8%', right: '6%', size: 48, opacity: 0.55, r: '12deg', blur: 0, dur: 4.4 }
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
            animation: `floatingLogo ${s.dur}s ease-in-out infinite`,
          }}>
            <img
              src="/logo.jfif"
              alt=""
              style={{
                width: s.size,
                height: s.size,
                borderRadius: '50%',
                opacity: s.opacity,
                filter: s.blur > 0 ? `blur(${s.blur}px)` : 'none',
                transform: `rotate(${s.r})`,
                objectFit: 'cover'
              }}
            />
          </div>
        ))}

        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <div style={{
            fontFamily: "'Outfit', 'Inter', sans-serif",
            fontSize: 32,
            fontWeight: 900,
            color: '#FFFFFF',
            lineHeight: 1.1,
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            letterSpacing: '-1px'
          }}>
            Rewards Hub
          </div>
        </div>
      </div>

      {/* Daily Actions Stack — 2-Column Themed Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Daily Check-in Card (Dark Blue theme) */}
        <div id="checkin-card" style={{
          background: '#0B1E3F',
          borderRadius: 20,
          padding: '14px 14px 12px',
          boxShadow: '0 8px 32px rgba(30,58,138,0.2)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: 126,
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(59,130,246,0.25)'
        }}>
          {/* Background image overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(/banner.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'hue-rotate(200deg) brightness(0.4) contrast(1.15)',
            zIndex: 0,
            pointerEvents: 'none'
          }} />

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: '#FFFFFF' }}>Check-in</div>
              <div style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.7)', marginTop: 2, fontWeight: 600 }}>daily free HP</div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 900, background: 'rgba(255,255,255,0.15)', color: '#FFFFFF', padding: '2px 6px', borderRadius: 6 }}>
              +1 HP
            </span>
          </div>

          <button
            onClick={() => setTxModal('checkin')}
            disabled={checkedToday}
            style={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              padding: '6px 12px',
              borderRadius: 10,
              border: checkedToday ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.25)',
              background: checkedToday ? 'rgba(255,255,255,0.05)' : 'rgba(255, 255, 255, 0.12)',
              color: checkedToday ? '#94A3B8' : '#FFFFFF',
              fontSize: 11.5,
              fontWeight: 800,
              cursor: checkedToday ? 'not-allowed' : 'pointer',
              outline: 'none',
              transition: 'background 0.2s',
              textAlign: 'center',
              height: 30
            }}
            onMouseEnter={e => { if (!checkedToday) e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }}
            onMouseLeave={e => { if (!checkedToday) e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
          >
            {checkedToday ? 'Resets at 00:00 UTC' : 'Claim'}
          </button>
        </div>

        {/* Daily HP Boost Card (Dark Green theme) */}
        <div id="boost-card" style={{
          background: '#081E15',
          borderRadius: 20,
          padding: '14px 14px 12px',
          boxShadow: '0 8px 32px rgba(6,78,59,0.2)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: 126,
          boxSizing: 'border-box',
          position: 'relative',
          overflow: 'hidden',
          border: '1px solid rgba(16,185,129,0.25)'
        }}>
          {/* Background image overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(/banner.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'hue-rotate(110deg) brightness(0.4) contrast(1.15)',
            zIndex: 0,
            pointerEvents: 'none'
          }} />

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: '#FFFFFF' }}>Daily Boost</div>
              <div style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.7)', marginTop: 2, fontWeight: 600 }}>daily boost HP</div>
            </div>
            <span style={{ fontSize: 9, fontWeight: 900, background: 'rgba(255,255,255,0.15)', color: '#FFFFFF', padding: '2px 6px', borderRadius: 6 }}>
              +2 HP
            </span>
          </div>

          {boostedToday ? (
            <button
              disabled
              style={{
                position: 'relative',
                zIndex: 1,
                width: '100%',
                padding: '6px 12px',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: '#94A3B8',
                fontSize: 11.5,
                fontWeight: 800,
                cursor: 'not-allowed',
                outline: 'none',
                textAlign: 'center',
                height: 30
              }}
            >
              Resets at 00:00 UTC
            </button>
          ) : (
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 6, width: '100%' }}>
              {/* Boost USDC Button */}
              <button
                onClick={() => {
                  setPayWithHh(false)
                  setTxModal('boost')
                }}
                style={{
                  flex: 1,
                  height: 30,
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'rgba(255, 255, 255, 0.12)',
                  color: '#FFFFFF',
                  fontSize: 10.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'background 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
              >
                <span>{BOOST_AMOUNT.toFixed(2)}</span>
                <img src="/usdc-logo.png" alt="USDC" style={{ width: 11, height: 11, borderRadius: '50%' }} />
              </button>

              {/* Boost $HH Button */}
              <button
                onClick={() => {
                  setPayWithHh(true)
                  setTxModal('boost')
                }}
                style={{
                  position: 'relative',
                  flex: 1,
                  height: 30,
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'rgba(255, 255, 255, 0.12)',
                  color: '#FFFFFF',
                  fontSize: 10.5,
                  fontWeight: 800,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'background 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
              >
                <div style={{
                  position: 'absolute',
                  top: -8,
                  right: -3,
                  background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
                  color: '#FFFFFF',
                  fontSize: 7.5,
                  fontWeight: 900,
                  padding: '1px 4px',
                  borderRadius: 5,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  lineHeight: 1,
                  letterSpacing: '0.2px',
                  whiteSpace: 'nowrap'
                }}>
                  -50%
                </div>
                <span>{formatConcise(0.10 / hhPrice)}</span>
                <img src="/logo.jfif" alt="$HH" style={{ width: 11, height: 11, borderRadius: '50%', objectFit: 'cover' }} />
              </button>
            </div>
          )}
        </div>
      </div>
      
      {checkinError && (
        <div style={{ color: '#FC401F', fontSize: 10.5, fontWeight: 700, textAlign: 'center', marginTop: -4 }}>
          ⚠️ Check-in: {checkinError}
        </div>
      )}
      {boostError && (
        <div style={{ color: '#FC401F', fontSize: 10.5, fontWeight: 700, textAlign: 'center', marginTop: -4 }}>
          ⚠️ Boost: {boostError}
        </div>
      )}

      {/* Feature Blocks Grid — Themed Custom Section Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
        {/* Block 1: Happy Raids (Coming Soon overlay) */}
        <div
          style={{
            background: '#140505',
            borderRadius: 20,
            padding: '14px 14px 12px',
            cursor: 'default',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            height: 126,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(255,255,255,0.08)'
          }}
        >
          {/* Graded background image */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(/banner.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'hue-rotate(330deg) brightness(0.4) contrast(1.15)',
            zIndex: 0,
            pointerEvents: 'none'
          }} />
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: '#FFFFFF' }}>Happy Raids</div>
            <div style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.7)', marginTop: 2, fontWeight: 600 }}>steal HP</div>
          </div>
          
          {/* Centered semi-transparent Play Badge */}
          <div style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: 30,
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: 12.5,
            fontWeight: 800
          }}
          >
            Play →
          </div>

          {/* Coming Soon Overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(20, 20, 20, 0.35)',
            backdropFilter: 'blur(1px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: 13,
            fontWeight: 800,
            zIndex: 2,
            borderRadius: 20
          }}>
            Coming Soon
          </div>
        </div>

        {/* Block 2: Happy Boxes (Dark Purple theme) */}
        <div
          onClick={() => setTab('boxes')}
          style={{
            background: '#090514',
            borderRadius: 20,
            padding: '14px 14px 12px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 8px 32px rgba(46,16,101,0.2)',
            height: 126,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(139,92,246,0.25)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-1.5px)'
            e.currentTarget.style.boxShadow = '0 12px 36px rgba(46,16,101,0.3)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none'
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(46,16,101,0.2)'
          }}
        >
          {/* Graded background image */}
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

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: '#FFFFFF' }}>Happy Boxes</div>
            <div style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.7)', marginTop: 2, fontWeight: 600 }}>earn more HP</div>
          </div>

          {/* Centered semi-transparent Open Badge */}
          <div style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: 30,
            background: 'rgba(255, 255, 255, 0.12)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: 12.5,
            fontWeight: 800,
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          >
            Open →
          </div>
        </div>
      </div>

      {/* Yield & Staking details */}
      <StakingSection setTab={setTab} />

      {/* Transaction Modals */}
      {txModal === 'checkin' && (
        <TxModal
          title="Daily Check-in"
          subtitle="Claim your daily free happy points!"
          amount="0.0001"
          isPending={isPending}
          isConfirming={isConfirming}
          isSuccess={isSuccess}
          error={writeError}
          onConfirm={sendCheckin}
          onCancel={() => { setTxModal(false); reset(); }}
        />
      )}

      {txModal === 'boost' && (
        <TxModal
          title="Daily HP Boost"
          subtitle={`Increase your daily points instantly using ${payWithHh ? '$HH' : 'USDC'}`}
          amount={payWithHh ? `${formatConcise(0.10 / hhPrice)} $HH` : `${BOOST_AMOUNT.toFixed(2)} USDC`}
          isPending={isPendingBoost}
          isConfirming={isConfirmingBoost}
          isSuccess={isSuccessBoost}
          error={boostWriteError}
          onConfirm={sendBoost}
          onCancel={() => { setTxModal(false); resetBoost(); }}
        />
      )}

    </div>
  )
}
