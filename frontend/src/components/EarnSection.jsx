import { useState, useEffect, useRef } from 'react'
import { useAccount, useReadContract, useChainId, useSwitchChain } from 'wagmi'
import { parseUnits } from 'viem'
import { base } from 'wagmi/chains'
import { db } from '../config/supabase'
import { CHECKIN_TARGET, USDC_ADDRESS, USDC_ABI, CHECKIN_AMOUNT, BOOST_AMOUNT, HH_ADDRESS } from '../config/constants'
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

    db.rpc('process_hp_boost', {
      p_address: address.toLowerCase(),
      p_tx_hash: boostTxHash,
    }).then(async ({ data, error }) => {
      if (error) {
        console.error('process_hp_boost:', error)
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
      // Pay with $HH (18 decimals)
      const hhCost = 0.10 / hhPrice
      writeBoost({
        address: HH_ADDRESS,
        abi: USDC_ABI, // standard ERC20 transfer interface works identically
        functionName: 'transfer',
        args: [CHECKIN_TARGET, parseUnits(hhCost.toFixed(8), 18)],
        chainId: base.id,
      })
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
          { top: -5, right: '8%', size: 48, opacity: 0.55, r: '-12deg', blur: 0, dur: 4.2 },
          { top: 35, right: '22%', size: 32, opacity: 0.5, r: '14deg', blur: 0, dur: 4.8 },
          { top: -10, left: '10%', size: 40, opacity: 0.55, r: '22deg', blur: 0, dur: 5.4 },
          { bottom: -8, left: '26%', size: 34, opacity: 0.5, r: '-15deg', blur: 0, dur: 4.0 },
          { bottom: 10, right: '3%', size: 52, opacity: 0.6, r: '8deg', blur: 0, dur: 4.6 }
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
                transform: `rotate(${s.r})`,
                objectFit: 'cover'
              }}
            />
          </div>
        ))}

        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 38,
            fontWeight: 900,
            color: '#FFFFFF',
            lineHeight: 1.1,
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            letterSpacing: '-0.5px'
          }}>
            REWARDS ZONE
          </div>
        </div>
      </div>

      {/* Daily Actions Stack — 2-Column Themed Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Daily Check-in Card (Dark Blue theme) */}
        <div style={{
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
            {checkedToday ? 'Checked' : 'Claim'}
          </button>
        </div>

        {/* Daily HP Boost Card (Dark Green theme) */}
        <div style={{
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

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 6 }}>
            {/* Boost USDC Button */}
            <button
              onClick={() => {
                setPayWithHh(false)
                setTxModal('boost')
              }}
              disabled={boostedToday}
              style={{
                flex: 1,
                height: 30,
                borderRadius: 10,
                border: boostedToday ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.25)',
                background: boostedToday ? 'rgba(255,255,255,0.05)' : 'rgba(255, 255, 255, 0.12)',
                color: boostedToday ? '#94A3B8' : '#FFFFFF',
                fontSize: 10.5,
                fontWeight: 800,
                cursor: boostedToday ? 'not-allowed' : 'pointer',
                outline: 'none',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3
              }}
              onMouseEnter={e => { if (!boostedToday) e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }}
              onMouseLeave={e => { if (!boostedToday) e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
            >
              <span>0.10</span>
              <img src="/usdc-logo.png" alt="USDC" style={{ width: 11, height: 11, borderRadius: '50%' }} />
            </button>

            {/* Boost $HH Button */}
            <button
              onClick={() => {
                setPayWithHh(true)
                setTxModal('boost')
              }}
              disabled={boostedToday}
              style={{
                flex: 1,
                height: 30,
                borderRadius: 10,
                border: boostedToday ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(255,255,255,0.25)',
                background: boostedToday ? 'rgba(255,255,255,0.05)' : 'rgba(255, 255, 255, 0.12)',
                color: boostedToday ? '#94A3B8' : '#FFFFFF',
                fontSize: 10.5,
                fontWeight: 800,
                cursor: boostedToday ? 'not-allowed' : 'pointer',
                outline: 'none',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3
              }}
              onMouseEnter={e => { if (!boostedToday) e.currentTarget.style.background = 'rgba(255,255,255,0.2)' }}
              onMouseLeave={e => { if (!boostedToday) e.currentTarget.style.background = 'rgba(255,255,255,0.12)' }}
            >
              <span>{formatConcise(0.10 / hhPrice)}</span>
              <img src="/logo.jfif" alt="$HH" style={{ width: 11, height: 11, borderRadius: '50%', objectFit: 'cover' }} />
            </button>
          </div>
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
        {/* Block 1: Happy Raids (Dark Red/Orange theme) */}
        <div
          onClick={() => setTab('raid')}
          style={{
            background: '#140505',
            borderRadius: 20,
            padding: '14px 14px 12px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 8px 32px rgba(101,16,16,0.2)',
            height: 126,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden',
            border: '1px solid rgba(239,68,68,0.25)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-1.5px)'
            e.currentTarget.style.boxShadow = '0 12px 36px rgba(101,16,16,0.3)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none'
            e.currentTarget.style.boxShadow = '0 8px 32px rgba(101,16,16,0.2)'
          }}
        >
          {/* Graded background image */}
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
            fontWeight: 800,
            transition: 'background 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
          >
            Play →
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
      <StakingSection />

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
          amount={payWithHh ? `${formatConcise(0.10 / hhPrice)} $HH` : "0.10 USDC"}
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
