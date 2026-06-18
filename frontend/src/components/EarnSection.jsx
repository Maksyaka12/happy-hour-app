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
    <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16, padding: '0 12px 120px', animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* Section Header */}
      <div style={{ padding: '0 4px', marginBottom: 4 }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0A0B0D', letterSpacing: '-0.5px', margin: 0 }}>
          Earn HP
        </h2>
        <p style={{ fontSize: 12.5, color: '#717886', marginTop: 4, marginBottom: 0 }}>
          Maximize your Season 2 points with active tasks, raids, and staking rewards.
        </p>
      </div>

      {/* Daily Actions Stack — Clean & Concise */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Check-in Button */}
        <div>
          <button
            onClick={() => setTxModal('checkin')}
            disabled={checkedToday}
            style={{
              width: '100%',
              padding: '14px 20px',
              borderRadius: 16,
              border: checkedToday ? '1px solid #E5E9F0' : 'none',
              background: checkedToday ? '#F8F9FC' : 'linear-gradient(135deg, #0052FF 0%, #0043D0 100%)',
              color: checkedToday ? '#94A3B8' : '#FFFFFF',
              fontSize: 13,
              fontWeight: 800,
              cursor: checkedToday ? 'not-allowed' : 'pointer',
              boxShadow: checkedToday ? 'none' : '0 4px 16px rgba(0,82,255,0.15)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'all 0.2s',
              outline: 'none'
            }}
            onMouseEnter={e => { if (!checkedToday) e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { if (!checkedToday) e.currentTarget.style.transform = 'none' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>📆</span>
              <span>Daily Check-in</span>
              {streakCount > 0 && (
                <span style={{
                  background: checkedToday ? 'rgba(148, 163, 184, 0.15)' : 'rgba(255,255,255,0.2)',
                  color: checkedToday ? '#64748B' : '#FFFFFF',
                  fontSize: 10,
                  fontWeight: 900,
                  padding: '2px 8px',
                  borderRadius: 10,
                  border: checkedToday ? '1.5px solid rgba(148, 163, 184, 0.3)' : '1.5px solid rgba(255,255,255,0.4)',
                  marginLeft: 4
                }}>
                  {streakCount}d streak
                </span>
              )}
            </span>
            <span>{checkedToday ? 'Checked In ✓' : 'Claim +1 HP →'}</span>
          </button>
          {checkinError && (
            <div style={{ marginTop: 6, color: '#FC401F', fontSize: 10.5, fontWeight: 700, paddingLeft: 12 }}>
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
              borderRadius: 16,
              border: boostedToday ? '1px solid #E5E9F0' : 'none',
              background: boostedToday ? '#F8F9FC' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              color: boostedToday ? '#94A3B8' : '#FFFFFF',
              fontSize: 13,
              fontWeight: 800,
              cursor: boostedToday ? 'not-allowed' : 'pointer',
              boxShadow: boostedToday ? 'none' : '0 4px 16px rgba(16,185,129,0.15)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              transition: 'all 0.2s',
              outline: 'none'
            }}
            onMouseEnter={e => { if (!boostedToday) e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { if (!boostedToday) e.currentTarget.style.transform = 'none' }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>⚡</span>
              <span>Daily HP Boost</span>
              <span style={{
                background: boostedToday ? 'rgba(148, 163, 184, 0.15)' : 'rgba(255,255,255,0.2)',
                color: boostedToday ? '#64748B' : '#FFFFFF',
                fontSize: 10,
                fontWeight: 900,
                padding: '2px 8px',
                borderRadius: 10,
                border: boostedToday ? '1.5px solid rgba(148, 163, 184, 0.3)' : '1.5px solid rgba(255,255,255,0.4)',
                marginLeft: 4
              }}>
                Cost: $0.10
              </span>
            </span>
            <span>{boostedToday ? 'Boost Claimed ✓' : 'Get +2 HP →'}</span>
          </button>
          {boostError && (
            <div style={{ marginTop: 6, color: '#FC401F', fontSize: 10.5, fontWeight: 700, paddingLeft: 12 }}>
              ⚠️ {boostError}
            </div>
          )}
        </div>
      </div>

      {/* Feature Blocks (2-Column Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Block 1: Happy Raids */}
        <div
          onClick={() => setTab('raid')}
          style={{
            background: 'linear-gradient(135deg, rgba(0, 82, 255, 0.03) 0%, rgba(228, 198, 255, 0.05) 100%)',
            border: '1px solid #E5E9F0',
            borderRadius: 24,
            padding: '16px 14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 16px rgba(0,0,0,0.01)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 82, 255, 0.05)'
            e.currentTarget.style.borderColor = 'rgba(0, 82, 255, 0.15)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.01)'
            e.currentTarget.style.borderColor = '#E5E9F0'
          }}
        >
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 900, color: '#0A0B0D', marginBottom: 4 }}>⚔️ Happy Raids</div>
            <div style={{ fontSize: 9.5, color: '#64748B', lineHeight: 1.4, fontWeight: 500 }}>
              Fight for USDC/HH pools. Win huge rewards & passive HP points.
            </div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#0052FF', marginTop: 16, display: 'flex', alignItems: 'center', gap: 2 }}>
            <span>Play now</span>
            <span>→</span>
          </div>
        </div>

        {/* Block 2: Happy Boxes */}
        <div
          onClick={() => setTab('boxes')}
          style={{
            background: 'linear-gradient(135deg, rgba(0, 82, 255, 0.03) 0%, rgba(228, 198, 255, 0.05) 100%)',
            border: '1px solid #E5E9F0',
            borderRadius: 24,
            padding: '16px 14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            boxShadow: '0 4px 16px rgba(0,0,0,0.01)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-2px)'
            e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 82, 255, 0.05)'
            e.currentTarget.style.borderColor = 'rgba(0, 82, 255, 0.15)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'none'
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.01)'
            e.currentTarget.style.borderColor = '#E5E9F0'
          }}
        >
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 900, color: '#0A0B0D', marginBottom: 4 }}>🎁 Happy Boxes</div>
            <div style={{ fontSize: 9.5, color: '#64748B', lineHeight: 1.4, fontWeight: 500 }}>
              Open mystery chests to claim high multiplier passive rewards.
            </div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#0052FF', marginTop: 16, display: 'flex', alignItems: 'center', gap: 2 }}>
            <span>Open now</span>
            <span>→</span>
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
