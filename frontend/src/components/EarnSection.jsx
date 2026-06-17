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
  
  const [activeSubTab, setActiveSubTab] = useState('checkin') // 'checkin' | 'raids' | 'staking'
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
    <div style={{ maxWidth: 640, margin: '0 auto', animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* Segmented Top navigation switcher */}
      <div style={{ padding: '0 16px' }}>
        <div style={{
          display: 'flex',
          background: '#EEF0F3',
          border: '1px solid #DEE1E7',
          borderRadius: 16,
          padding: 4,
          marginBottom: 20,
          boxShadow: 'inset 0 2px 4px rgba(10,11,13,0.05)',
          gap: 6
        }}>
          <button
            onClick={() => setActiveSubTab('checkin')}
            style={{
              flex: 1,
              padding: '10px 8px',
              borderRadius: 12,
              border: activeSubTab === 'checkin' ? 'none' : '1px solid rgba(255,255,255,0.8)',
              background: activeSubTab === 'checkin' 
                ? 'linear-gradient(135deg, #0052FF 0%, #3B82F6 100%)' 
                : 'rgba(255, 255, 255, 0.6)',
              color: activeSubTab === 'checkin' ? '#fff' : '#717886',
              fontWeight: 850,
              fontSize: 11.5,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: activeSubTab === 'checkin' 
                ? '0 4px 12px rgba(0,82,255,0.15)' 
                : 'none'
            }}
          >
            📆 Check-in & Boost
          </button>
          <button
            onClick={() => setActiveSubTab('raids')}
            style={{
              flex: 1,
              padding: '10px 8px',
              borderRadius: 12,
              border: activeSubTab === 'raids' ? 'none' : '1px solid rgba(255,255,255,0.8)',
              background: activeSubTab === 'raids' 
                ? 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)' 
                : 'rgba(255, 255, 255, 0.6)',
              color: activeSubTab === 'raids' ? '#fff' : '#717886',
              fontWeight: 850,
              fontSize: 11.5,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: activeSubTab === 'raids' 
                ? '0 4px 12px rgba(239,68,68,0.15)' 
                : 'none'
            }}
          >
            ⚔️ Happy Raids
          </button>
          <button
            onClick={() => setActiveSubTab('staking')}
            style={{
              flex: 1,
              padding: '10px 8px',
              borderRadius: 12,
              border: activeSubTab === 'staking' ? 'none' : '1px solid rgba(255,255,255,0.8)',
              background: activeSubTab === 'staking' 
                ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' 
                : 'rgba(255, 255, 255, 0.6)',
              color: activeSubTab === 'staking' ? '#fff' : '#717886',
              fontWeight: 850,
              fontSize: 11.5,
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: activeSubTab === 'staking' 
                ? '0 4px 12px rgba(16,185,129,0.15)' 
                : 'none'
            }}
          >
            🥩 HH Staking
          </button>
        </div>
      </div>

      {/* Render sub-tabs */}
      {activeSubTab === 'checkin' && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* Card 1: Check-in */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #DEE1E7',
            borderRadius: 24,
            padding: 24,
            boxShadow: '0 4px 16px rgba(10,11,13,0.04)',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>📆</span>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0A0B0D' }}>Daily Check-in</h3>
            <p style={{ fontSize: 13, color: '#717886', marginTop: 4, marginBottom: 16 }}>
              Check-in every day to build your streak and earn HP.
            </p>

            <div style={{ display: 'inline-flex', background: '#F0F5FF', border: '1px solid rgba(0, 82, 255, 0.15)', borderRadius: 20, padding: '6px 16px', fontSize: 13, fontWeight: 800, color: '#0052FF', marginBottom: 20 }}>
              🔥 Current Streak: {streakCount} Days
            </div>

            <button
              onClick={() => setTxModal('checkin')}
              disabled={checkedToday}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 14,
                border: 'none',
                background: checkedToday ? '#EEF0F3' : 'linear-gradient(135deg, #0052FF 0%, #0043D0 100%)',
                color: checkedToday ? '#94A3B8' : '#FFFFFF',
                fontSize: 14,
                fontWeight: 800,
                cursor: checkedToday ? 'not-allowed' : 'pointer',
                boxShadow: checkedToday ? 'none' : '0 4px 12px rgba(0,82,255,0.2)'
              }}
            >
              {checkedToday ? '✓ Checked In Today' : `Check In (+1.00 HP)`}
            </button>

            {checkinError && (
              <div style={{ marginTop: 12, color: '#FC401F', fontSize: 12, fontWeight: 700 }}>
                ⚠️ {checkinError}
              </div>
            )}
          </div>

          {/* Card 2: Paid Boost */}
          <div style={{
            background: '#FFFFFF',
            border: '1px solid #DEE1E7',
            borderRadius: 24,
            padding: 24,
            boxShadow: '0 4px 16px rgba(10,11,13,0.04)',
            textAlign: 'center'
          }}>
            <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>⚡</span>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0A0B0D' }}>Daily HP Boost</h3>
            <p style={{ fontSize: 13, color: '#717886', marginTop: 4, marginBottom: 20 }}>
              Buy a quick daily boost to add points directly to your season score.
            </p>

            <button
              onClick={() => setTxModal('boost')}
              disabled={boostedToday}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 14,
                border: 'none',
                background: boostedToday ? '#EEF0F3' : 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                color: boostedToday ? '#94A3B8' : '#FFFFFF',
                fontSize: 14,
                fontWeight: 800,
                cursor: boostedToday ? 'not-allowed' : 'pointer',
                boxShadow: boostedToday ? 'none' : '0 4px 12px rgba(16,185,129,0.2)'
              }}
            >
              {boostedToday ? '✓ Boost Claimed Today' : `Claim HP Boost (+2.00 HP - Cost: $0.10)`}
            </button>

            {boostError && (
              <div style={{ marginTop: 12, color: '#FC401F', fontSize: 12, fontWeight: 700 }}>
                ⚠️ {boostError}
              </div>
            )}
          </div>

        </div>
      )}

      {activeSubTab === 'raids' && <RaidMode address={address} />}

      {activeSubTab === 'staking' && <StakingSection />}

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
