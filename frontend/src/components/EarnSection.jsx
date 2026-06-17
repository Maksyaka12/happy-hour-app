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

export function EarnSection() {
  const { address } = useAccount()
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
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, padding: '0 12px 120px', animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* Section Header */}
      <div style={{ padding: '0 4px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0A0B0D', letterSpacing: '-0.5px', margin: 0 }}>
          Earn HP
        </h2>
        <p style={{ fontSize: 13, color: '#717886', marginTop: 4, marginBottom: 0 }}>
          Maximize your Season 2 points with active tasks, raids, and staking rewards.
        </p>
      </div>

      {/* 1. Daily Check-in & Boost (2-Column Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Daily Check-in Card */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #DEE1E7',
          borderRadius: 20,
          padding: 18,
          boxShadow: '0 4px 16px rgba(10,11,13,0.04)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 28 }}>📆</span>
              <span style={{
                background: '#F0F5FF', color: '#0052FF', fontSize: 10, fontWeight: 900,
                padding: '3px 8px', borderRadius: 12, border: '1px solid rgba(0, 82, 255, 0.15)'
              }}>
                Streak: {streakCount}d
              </span>
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 900, color: '#0A0B0D', margin: 0 }}>Daily Check-in</h3>
            <p style={{ fontSize: 10.5, color: '#717886', marginTop: 4, marginBottom: 16, lineHeight: 1.4 }}>
              Check-in daily to build your streak and earn +1.00 HP.
            </p>
          </div>

          <div>
            <button
              onClick={() => setTxModal('checkin')}
              disabled={checkedToday}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: 'none',
                background: checkedToday ? '#EEF0F3' : 'linear-gradient(135deg, #0052FF 0%, #0043D0 100%)',
                color: checkedToday ? '#94A3B8' : '#FFFFFF',
                fontSize: 11.5,
                fontWeight: 800,
                cursor: checkedToday ? 'not-allowed' : 'pointer',
                boxShadow: checkedToday ? 'none' : '0 2px 8px rgba(0,82,255,0.15)'
              }}
            >
              {checkedToday ? 'Checked In' : 'Check In (+1 HP)'}
            </button>
            {checkinError && (
              <div style={{ marginTop: 8, color: '#FC401F', fontSize: 10, fontWeight: 700 }}>
                ⚠️ {checkinError}
              </div>
            )}
          </div>
        </div>

        {/* Daily HP Boost Card */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #DEE1E7',
          borderRadius: 20,
          padding: 18,
          boxShadow: '0 4px 16px rgba(10,11,13,0.04)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 28 }}>⚡</span>
              <span style={{
                background: '#D1FAE5', color: '#059669', fontSize: 10, fontWeight: 900,
                padding: '3px 8px', borderRadius: 12
              }}>
                Cost: $0.10
              </span>
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 900, color: '#0A0B0D', margin: 0 }}>Daily HP Boost</h3>
            <p style={{ fontSize: 10.5, color: '#717886', marginTop: 4, marginBottom: 16, lineHeight: 1.4 }}>
              Claim daily paid boost to get +2.00 HP instantly.
            </p>
          </div>

          <div>
            <button
              onClick={() => setTxModal('boost')}
              disabled={boostedToday}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: 'none',
                background: boostedToday ? '#EEF0F3' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: boostedToday ? '#94A3B8' : '#FFFFFF',
                fontSize: 11.5,
                fontWeight: 800,
                cursor: boostedToday ? 'not-allowed' : 'pointer',
                boxShadow: boostedToday ? 'none' : '0 2px 8px rgba(16,185,129,0.15)'
              }}
            >
              {boostedToday ? 'Boost Claimed' : 'HP Boost (+2 HP)'}
            </button>
            {boostError && (
              <div style={{ marginTop: 8, color: '#FC401F', fontSize: 10, fontWeight: 700 }}>
                ⚠️ {boostError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Happy Raids Block */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #DEE1E7',
        borderRadius: 24,
        padding: '20px 8px',
        boxShadow: '0 4px 16px rgba(10,11,13,0.04)'
      }}>
        <div style={{ padding: '0 12px' }}>
          <h3 style={{ fontSize: 16, fontWeight: 900, color: '#0A0B0D', margin: 0 }}>
            ⚔️ Happy Raids
          </h3>
          <p style={{ fontSize: 12, color: '#717886', marginTop: 4, marginBottom: 20 }}>
            Fight for pools with USDC or $HH. Win huge rewards and earn HP.
          </p>
        </div>
        <RaidMode address={address} />
      </div>

      {/* 3. HH Staking & Hold Block */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #DEE1E7',
        borderRadius: 24,
        padding: '20px 8px',
        boxShadow: '0 4px 16px rgba(10,11,13,0.04)'
      }}>
        <div style={{ padding: '0 12px' }}>
          <h3 style={{ fontSize: 16, fontWeight: 900, color: '#0A0B0D', margin: 0 }}>
            🥩 $HH Staking & Hold Yields
          </h3>
          <p style={{ fontSize: 12, color: '#717886', marginTop: 4, marginBottom: 20 }}>
            Hold $HH or lock it in the staking contract to generate passive HP daily.
          </p>
        </div>
        <StakingSection />
      </div>

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
