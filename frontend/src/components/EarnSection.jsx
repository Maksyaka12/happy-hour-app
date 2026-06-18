import { useState, useEffect, useRef } from 'react'
import { useAccount, useReadContract, useChainId, useSwitchChain } from 'wagmi'
import { parseUnits } from 'viem'
import { base } from 'wagmi/chains'
import { db } from '../config/supabase'
import { CHECKIN_TARGET, USDC_ADDRESS, USDC_ABI, CHECKIN_AMOUNT, BOOST_AMOUNT } from '../config/constants'
import { useBuilderWrite } from '../hooks/useBuilderWrite'
import { TxModal } from './TxModal'
import { RaidMode } from './RaidMode'
import { StakingSection } from './StakingSection'

// Helper for date
const todayUTC = () => new Date().toISOString().split('T')[0]

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
  
  const today = todayUTC()
  const processedTxRef = useRef(null)
  const processedBoostTxRef = useRef(null)

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
      
      {/* Daily Actions Capsule Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* Check-in Button */}
        <div>
          <button
            onClick={() => setTxModal('checkin')}
            disabled={checkedToday}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: 100,
              border: checkedToday ? '1px solid #E5E9F0' : 'none',
              background: checkedToday ? '#EEF0F3' : '#0052FF',
              color: checkedToday ? '#94A3B8' : '#FFFFFF',
              fontSize: 13,
              fontWeight: 800,
              cursor: checkedToday ? 'not-allowed' : 'pointer',
              boxShadow: checkedToday ? 'none' : '0 2px 8px rgba(0,82,255,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'all 0.2s',
              outline: 'none',
              height: 48,
              boxSizing: 'border-box'
            }}
            onMouseEnter={e => { if (!checkedToday) e.currentTarget.style.transform = 'translateY(-0.5px)' }}
            onMouseLeave={e => { if (!checkedToday) e.currentTarget.style.transform = 'none' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>Daily Check-in</span>
              {streakCount > 0 && (
                <span style={{ fontSize: 10.5, opacity: 0.8, fontWeight: 700 }}>
                  ({streakCount}d streak)
                </span>
              )}
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{
                background: checkedToday ? 'rgba(148,163,184,0.1)' : 'rgba(255,255,255,0.15)',
                color: checkedToday ? '#94A3B8' : '#FFFFFF',
                fontSize: 10,
                fontWeight: 900,
                padding: '2.5px 8px',
                borderRadius: 100
              }}>
                +1 HP
              </span>
              <span style={{
                background: checkedToday ? 'rgba(148,163,184,0.1)' : 'rgba(255,255,255,0.15)',
                color: checkedToday ? '#94A3B8' : '#FFFFFF',
                fontSize: 10,
                fontWeight: 900,
                padding: '2.5px 8px',
                borderRadius: 100
              }}>
                Free
              </span>
            </div>
          </button>
          {checkinError && (
            <div style={{ marginTop: 4, color: '#FC401F', fontSize: 10.5, fontWeight: 700, paddingLeft: 16 }}>
              ⚠️ {checkinError}
            </div>
          )}
        </div>

        {/* Boost Button */}
        <div>
          <button
            onClick={() => setTxModal('boost')}
            disabled={boostedToday}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: 100,
              border: boostedToday ? '1px solid #E5E9F0' : 'none',
              background: boostedToday ? '#EEF0F3' : '#0F172A',
              color: boostedToday ? '#94A3B8' : '#FFFFFF',
              fontSize: 13,
              fontWeight: 800,
              cursor: boostedToday ? 'not-allowed' : 'pointer',
              boxShadow: boostedToday ? 'none' : '0 2px 8px rgba(0,0,0,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'all 0.2s',
              outline: 'none',
              height: 48,
              boxSizing: 'border-box'
            }}
            onMouseEnter={e => { if (!boostedToday) e.currentTarget.style.transform = 'translateY(-0.5px)' }}
            onMouseLeave={e => { if (!boostedToday) e.currentTarget.style.transform = 'none' }}
          >
            <span>Daily Boost</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{
                background: boostedToday ? 'rgba(148,163,184,0.1)' : 'rgba(255,255,255,0.15)',
                color: boostedToday ? '#94A3B8' : '#FFFFFF',
                fontSize: 10,
                fontWeight: 900,
                padding: '2.5px 8px',
                borderRadius: 100
              }}>
                +2 HP
              </span>
              <span style={{
                background: boostedToday ? 'rgba(148,163,184,0.1)' : 'rgba(255,255,255,0.15)',
                color: boostedToday ? '#94A3B8' : '#FFFFFF',
                fontSize: 10,
                fontWeight: 900,
                padding: '2.5px 8px',
                borderRadius: 100
              }}>
                $0.10
              </span>
            </div>
          </button>
          {boostError && (
            <div style={{ marginTop: 4, color: '#FC401F', fontSize: 10.5, fontWeight: 700, paddingLeft: 16 }}>
              ⚠️ {boostError}
            </div>
          )}
        </div>
      </div>

      {/* Feature Blocks Grid — Elegant & Colorful */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
        {/* Block 1: Happy Raids */}
        <div
          onClick={() => setTab('raid')}
          style={{
            background: 'linear-gradient(135deg, #E2F1FF 0%, #FDF2F8 100%)',
            border: '1px solid rgba(255,255,255,0.6)',
            borderRadius: 20,
            padding: '16px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 16px rgba(0,0,0,0.01)',
            height: 100,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-1.5px)'
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 82, 255, 0.04)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.01)'
          }}
        >
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>Happy Raids</div>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#0052FF', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>Play</span>
            <span>&gt;</span>
          </div>
        </div>

        {/* Block 2: Happy Boxes */}
        <div
          onClick={() => setTab('boxes')}
          style={{
            background: 'linear-gradient(135deg, #FEF3C7 0%, #FDF2F8 100%)',
            border: '1px solid rgba(255,255,255,0.6)',
            borderRadius: 20,
            padding: '16px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 16px rgba(0,0,0,0.01)',
            height: 100,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-1.5px)'
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(217, 119, 6, 0.04)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.01)'
          }}
        >
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0F172A' }}>Happy Boxes</div>
          <div style={{ fontSize: 11.5, fontWeight: 800, color: '#D97706', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>Open</span>
            <span>&gt;</span>
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
