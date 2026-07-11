import { useState, useEffect, useRef } from 'react'
import { useAccount, useReadContract, useChainId, useSwitchChain } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { base } from 'wagmi/chains'
import { db } from '../config/supabase'
import { CHECKIN_TARGET, USDC_ADDRESS, USDC_ABI, CHECKIN_AMOUNT, HH_ADDRESS, HH_MANAGER_ADDRESS, HH_ABI } from '../config/constants'
import { useBuilderWrite } from '../hooks/useBuilderWrite'
import { TxModal } from './TxModal'
import { StakingSection } from './StakingSection'

// Helper for date
const todayUTC = () => new Date().toISOString().split('T')[0]

const formatConcise = (num) => {
  const n = parseFloat(num || 0)
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'm'
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k'
  return Math.round(n).toString()
}

export function EarnSection({ setTab, address: propAddress, onRequireWallet, isAdmin }) {
  const { address: accountAddress } = useAccount()
  const address = propAddress || accountAddress
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  
  const [checkedToday, setCheckedToday] = useState(false)
  const [streakCount, setStreakCount] = useState(0)
  const [points, setPoints] = useState(0)
  const [txModal, setTxModal] = useState(false) // 'checkin' | false
  
  const [checkinError, setCheckinError] = useState('')
  const [hhPrice, setHhPrice] = useState(0.00025)
  
  const today = todayUTC()
  const processedTxRef = useRef(null)

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

  // Load user profile details for Check-in & Boost
  const loadProfile = async () => {
    if (!address) return
    try {
      const { data, error } = await db
        .from('users')
        .select('streak, streak_last, points')
        .eq('address', address.toLowerCase())
        .maybeSingle()

      if (!error && data) {
        setStreakCount(data.streak || 0)
        setCheckedToday(data.streak_last === today)
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
    <div style={{ maxWidth: 1200, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 12px 120px', animation: 'fadeIn 0.3s ease-out' }}>


      {/* Yield & Staking details */}
      <StakingSection setTab={setTab} onRequireWallet={onRequireWallet} isAdmin={isAdmin} />



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

    </div>
  )
}
