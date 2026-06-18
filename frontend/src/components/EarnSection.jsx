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

    writeBoost({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [CHECKIN_TARGET, parseUnits(BOOST_AMOUNT.toFixed(6), 6)],
      chainId: base.id,
    })
  }

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 12px 120px', animation: 'fadeIn 0.3s ease-out' }}>
      
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
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
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

      {/* Daily Actions Stack — 2-Column Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {/* Daily Check-in Card */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #DEE1E7',
          borderRadius: 20,
          padding: 16,
          boxShadow: '0 4px 16px rgba(10,11,13,0.01)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 146,
          boxSizing: 'border-box'
        }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>Daily Check-in</div>
            <div style={{ display: 'flex', gap: 4, marginTop: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 9.5, fontWeight: 900, background: '#F1F5F9', color: '#475569', padding: '2px 6px', borderRadius: 6 }}>Free</span>
              <span style={{ fontSize: 9.5, fontWeight: 900, background: '#E0F2FE', color: '#0369A1', padding: '2px 6px', borderRadius: 6 }}>+1 HP</span>
            </div>
          </div>
          <button
            onClick={() => setTxModal('checkin')}
            disabled={checkedToday}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 12,
              border: checkedToday ? '1px solid #E5E9F0' : 'none',
              background: checkedToday ? '#EEF0F3' : '#0052FF',
              color: checkedToday ? '#94A3B8' : '#FFFFFF',
              fontSize: 12.5,
              fontWeight: 800,
              cursor: checkedToday ? 'not-allowed' : 'pointer',
              outline: 'none',
              transition: 'all 0.2s',
              textAlign: 'center'
            }}
          >
            {checkedToday ? 'Checked' : 'Claim'}
          </button>
        </div>

        {/* Daily HP Boost Card */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #DEE1E7',
          borderRadius: 20,
          padding: 16,
          boxShadow: '0 4px 16px rgba(10,11,13,0.01)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 146,
          boxSizing: 'border-box'
        }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>Daily Boost</div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 9.5, fontWeight: 900, background: '#D1FAE5', color: '#065F46', padding: '2px 6px', borderRadius: 6 }}>+2 HP</span>
              <span style={{ fontSize: 9.5, fontWeight: 900, background: '#F3E8FF', color: '#6B21A8', padding: '2px 6px', borderRadius: 6 }}>$0.10</span>
              <span style={{ fontSize: 9.5, fontWeight: 900, background: '#FEF3C7', color: '#92400E', padding: '2px 6px', borderRadius: 6 }}>{formatConcise(0.10 / hhPrice)} $HH</span>
            </div>
          </div>
          <button
            onClick={() => setTxModal('boost')}
            disabled={boostedToday}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 12,
              border: boostedToday ? '1px solid #E5E9F0' : 'none',
              background: boostedToday ? '#EEF0F3' : '#0F172A',
              color: boostedToday ? '#94A3B8' : '#FFFFFF',
              fontSize: 12.5,
              fontWeight: 800,
              cursor: boostedToday ? 'not-allowed' : 'pointer',
              outline: 'none',
              transition: 'all 0.2s',
              textAlign: 'center'
            }}
          >
            {boostedToday ? 'Boosted' : 'Boost'}
          </button>
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
            padding: '16px',
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
            <div style={{ fontSize: 11, color: '#FF8A8A', marginTop: 2, fontWeight: 700 }}>steal HP</div>
          </div>
          
          {/* Centered semi-transparent Play Badge */}
          <div style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: 32,
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
            padding: '16px',
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
            <div style={{ fontSize: 11, color: '#D8B4FE', marginTop: 2, fontWeight: 700 }}>earn more HP</div>
          </div>

          {/* Centered semi-transparent Open Badge */}
          <div style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: 32,
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
          subtitle="Build your streak to earn milestone rewards!"
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
          subtitle="Increase your daily points instantly"
          amount="0.10"
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
