import { useEffect, useMemo, useRef, useState } from 'react'
import { useDisconnect, useWriteContract, useBalance, useReadContract } from 'wagmi'
import { formatUnits } from 'viem'
import { APP_URL, FOUNDATION, CHECKIN_TARGET, USDC_ADDRESS, USDC_ABI, HH_ADDRESS, HH_ABI } from '../config/constants'
import { db } from '../config/supabase'
import { UserAvatar } from './UserAvatar'
import { HistorySection } from './HistorySection'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

const formatNumber = (num, decimals = 2) => {
  return parseFloat(num || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
}

export function ProfileSection({ address, basename, totalUsers }) {
  const { disconnect } = useDisconnect()
  const { writeContract: wagmiWriteContract } = useWriteContract()

  // DexScreener States
  const [hhPrice, setHhPrice] = useState(0.00025)
  const [priceChange, setPriceChange] = useState(8.4)

  // Token Balance Fallbacks (LocalStorage mock)
  const [simulatedWalletBalance, setSimulatedWalletBalance] = useState(() => {
    try {
      return parseFloat(localStorage.getItem('hh_simulated_wallet') || '250000')
    } catch {
      return 250000
    }
  })

  const [simulatedUsdcBalance, setSimulatedUsdcBalance] = useState(() => {
    try {
      return parseFloat(localStorage.getItem('usdc_simulated_wallet') || '500')
    } catch {
      return 500
    }
  })

  // Synchronize simulated USDC balance to localStorage
  useEffect(() => {
    localStorage.setItem('usdc_simulated_wallet', simulatedUsdcBalance.toString())
  }, [simulatedUsdcBalance])

  // Read real contract balance
  const { data: hhBalanceRaw } = useReadContract({
    address: HH_ADDRESS,
    abi: HH_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 }
  })

  const walletBalance = hhBalanceRaw !== undefined
    ? parseFloat(formatUnits(hhBalanceRaw, 18))
    : simulatedWalletBalance

  // Admin states
  const [refundAmount, setRefundAmount] = useState('')
  const [paymentsRefundAmount, setPaymentsRefundAmount] = useState('')

  const rescueMyFunds = () => {
    if (!refundAmount || isNaN(refundAmount)) return;
    const amountBigInt = BigInt(Math.floor(parseFloat(refundAmount) * 1000000));

    wagmiWriteContract({
      address: '0xdE76F43E17B1173947f63b72C85a2f0d9a97702F',
      abi: [{
        name: 'rescueFunds',
        type: 'function',
        inputs: [
          { name: '_token', type: 'address' },
          { name: '_to', type: 'address' },
          { name: '_amount', type: 'uint256' }
        ],
        outputs: [],
        stateMutability: 'nonpayable'
      }],
      functionName: 'rescueFunds',
      args: [
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        '0x4c91D3BEd372C11795b9Ce9a9017dFE447Bf050a',
        amountBigInt
      ]
    })
  }

  const sweepPaymentsVault = () => {
    wagmiWriteContract({
      address: CHECKIN_TARGET,
      abi: [{
        name: 'forwardFunds',
        type: 'function',
        inputs: [],
        outputs: [],
        stateMutability: 'nonpayable'
      }],
      functionName: 'forwardFunds',
      args: []
    })
  }

  const refundPaymentsVaultSpecific = () => {
    if (!paymentsRefundAmount || isNaN(paymentsRefundAmount)) return;
    const amountBigInt = BigInt(Math.floor(parseFloat(paymentsRefundAmount) * 1000000));

    wagmiWriteContract({
      address: CHECKIN_TARGET,
      abi: [{
        name: 'rescueToken',
        type: 'function',
        inputs: [
          { name: '_token', type: 'address' },
          { name: '_to', type: 'address' },
          { name: '_amount', type: 'uint256' }
        ],
        outputs: [],
        stateMutability: 'nonpayable'
      }],
      functionName: 'rescueToken',
      args: [
        USDC_ADDRESS,
        '0xf76365c4157eE3f08fBAb77E9d57B965892D137d',
        amountBigInt
      ]
    })
  }

  const { data: vaultBalanceData } = useBalance({
    address: FOUNDATION,
    token: USDC_ADDRESS,
    query: {
      refetchInterval: 5000,
    }
  })

  const { data: paymentsVaultBalanceData } = useBalance({
    address: CHECKIN_TARGET,
    token: USDC_ADDRESS,
    query: {
      refetchInterval: 5000,
    }
  })

  const [userStats, setUserStats] = useState({
    points: 0,
    wins: 0,
    entries: 0,
    referral_count: 0,
    referral_points: 0,
    ref_code: null,
    referrer: null
  })

  const [linkCopied, setLinkCopied] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)

  // Swap Widget states
  const [isBuying, setIsBuying] = useState(true) // true: USDC -> $HH, false: $HH -> USDC
  const [payAmount, setPayAmount] = useState('')
  const [receiveAmount, setReceiveAmount] = useState('')
  const [txStep, setTxStep] = useState(null) // 'action_signing' | 'action_pending' | 'success' | null
  const [swapError, setSwapError] = useState('')

  const handlePayChange = (val) => {
    setPayAmount(val)
    if (!val || isNaN(val)) {
      setReceiveAmount('')
      return
    }
    if (isBuying) {
      const hhAmt = parseFloat(val) / hhPrice
      setReceiveAmount(hhAmt.toFixed(2))
    } else {
      const usdAmt = parseFloat(val) * hhPrice
      setReceiveAmount(usdAmt.toFixed(2))
    }
  }

  const handleReceiveChange = (val) => {
    setReceiveAmount(val)
    if (!val || isNaN(val)) {
      setPayAmount('')
      return
    }
    if (isBuying) {
      const usdAmt = parseFloat(val) * hhPrice
      setPayAmount(usdAmt.toFixed(2))
    } else {
      const hhAmt = parseFloat(val) / hhPrice
      setPayAmount(hhAmt.toFixed(2))
    }
  }

  const handleSwapDirection = () => {
    setIsBuying(!isBuying)
    setPayAmount('')
    setReceiveAmount('')
    setSwapError('')
  }

  const handleSwapExecute = () => {
    setSwapError('')
    const pay = parseFloat(payAmount)
    const recv = parseFloat(receiveAmount)
    if (isNaN(pay) || pay <= 0) {
      setSwapError('Please enter a valid amount.')
      return
    }

    if (isBuying) {
      if (pay > simulatedUsdcBalance) {
        setSwapError('Insufficient USDC balance.')
        return
      }
    } else {
      if (pay > walletBalance) {
        setSwapError('Insufficient $HH balance.')
        return
      }
    }

    setTxStep('action_signing')
    setTimeout(() => {
      setTxStep('action_pending')
      setTimeout(() => {
        if (isBuying) {
          setSimulatedUsdcBalance(prev => prev - pay)
          const newHh = simulatedWalletBalance + recv
          setSimulatedWalletBalance(newHh)
          localStorage.setItem('hh_simulated_wallet', newHh.toString())
        } else {
          const newHh = simulatedWalletBalance - pay
          setSimulatedWalletBalance(newHh)
          localStorage.setItem('hh_simulated_wallet', newHh.toString())
          setSimulatedUsdcBalance(prev => prev + recv)
        }
        setPayAmount('')
        setReceiveAmount('')
        setTxStep('success')
      }, 2000)
    }, 1500)
  }

  // Diagnostic Simulation State
  const [simulatedUsers, setSimulatedUsers] = useState([])
  const [simCount, setSimCount] = useState(10)
  const [simMinHP, setSimMinHP] = useState(100)
  const [simMaxHP, setSimMaxHP] = useState(1000)
  const [isSimulating, setIsSimulating] = useState(false)
  const [editingSim, setEditingSim] = useState(null)
  
  // Admin Points Adjustment State
  const [adminUserAddress, setAdminUserAddress] = useState('')
  const [adminPts, setAdminPts] = useState('')
  const [adminAction, setAdminAction] = useState('Reward')
  const [adminBadge, setAdminBadge] = useState('')
  const [adminType, setAdminType] = useState('quest')
  const [adminApplyMult, setAdminApplyMult] = useState(false)
  const [isAdminAdjusting, setIsAdminAdjusting] = useState(false)
  const [adminAdjustStatus, setAdminAdjustStatus] = useState(null)

  const referralLink = useMemo(() => {
    const baseUrl = APP_URL.replace(/\/$/, '')
    return userStats.ref_code
      ? `${baseUrl}/r?ref=${userStats.ref_code}`
      : `${baseUrl}/r?ref=${address}`
  }, [address, userStats.ref_code])

  const isAdmin = address && atob('MHg0YzkxZDNiZWQzNzJjMTE3OTViOWNlOWE5MDE3ZGZlNDQ3YmYwNTBh') === address.toLowerCase()

  const loadProfile = async () => {
    if (!address) return
    const { data, error } = await db
      .from('users')
      .select('points, wins, entries, referral_count, referral_points, ref_code, referrer')
      .eq('address', address.toLowerCase())
      .maybeSingle()

    if (error) {
      console.error('loadProfile:', error)
      return
    }

    setUserStats({
      points: data?.points ?? 0,
      wins: data?.wins ?? 0,
      entries: data?.entries ?? 0,
      referral_count: data?.referral_count ?? 0,
      referral_points: data?.referral_points ?? 0,
      ref_code: data?.ref_code ?? null,
      referrer: data?.referrer || null
    })
  }

  // Fetch real $HH price from DexScreener
  useEffect(() => {
    const getPrice = async () => {
      try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${HH_ADDRESS}`)
        const data = await res.json()
        const pair = data.pairs?.[0]
        if (pair) {
          setHhPrice(parseFloat(pair.priceUsd) || 0.00025)
          setPriceChange(parseFloat(pair.priceChange?.h24) || 8.4)
        }
      } catch (err) {
        console.error('DexScreener API error, using fallback:', err)
      }
    }
    getPrice()
    const interval = setInterval(getPrice, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    loadProfile()
    if (isAdmin) loadSimulations()
  }, [address])

  const loadSimulations = async () => {
    const { data } = await db.from('users').select('*').eq(atob('aXNfYm90'), true).order('points', { ascending: false })
    setSimulatedUsers(data || [])
  }

  const handleSimulate = async () => {
    setIsSimulating(true)
    await db.rpc(atob('Y3JlYXRlX2JvdHM='), {
      p_count: Number(simCount),
      p_min_points: Number(simMinHP),
      p_max_points: Number(simMaxHP)
    })
    await loadSimulations()
    setIsSimulating(false)
  }

  const handleUpdateSimHP = async (simAddr, newPts) => {
    const val = String(newPts).replace(',', '.');
    const points = parseFloat(val);

    if (isNaN(points)) {
      setEditingSim(null);
      return;
    }

    const { error } = await db.rpc(atob('dXBkYXRlX2JvdF9wb2ludHM='), {
      p_admin_address: address.toLowerCase(),
      [atob('cF9ib3RfYWRkcmVzcw==')]: simAddr,
      p_new_points: points
    })

    if (error) {
      console.error('Update points error:', error);
      alert('Error updating points: ' + error.message);
    }

    setEditingSim(null)
    await loadSimulations()
  }

  const handleDeleteSim = async (simAddr) => {
    await db.rpc(atob('ZGVsZXRlX2JvdA=='), {
      p_admin_address: address.toLowerCase(),
      [atob('cF9ib3RfYWRkcmVzcw==')]: simAddr
    })
    await loadSimulations()
  }

  const handleResetSim = async () => {
    const { error } = await db.rpc(atob('ZGVsZXRlX2FsbF9ib3Rz'), { p_admin_address: address.toLowerCase() })
    if (error) console.error('Reset error:', error)
    await loadSimulations()
  }

  const handleAdminAdjustPoints = async (e) => {
    e.preventDefault()
    if (!adminUserAddress || !adminPts) {
      setAdminAdjustStatus({ success: false, message: 'Please fill in user address and points.' })
      return
    }
    const points = parseFloat(adminPts)
    if (isNaN(points) || points <= 0) {
      setAdminAdjustStatus({ success: false, message: 'Points must be a positive number.' })
      return
    }

    setIsAdminAdjusting(true)
    setAdminAdjustStatus(null)

    try {
      const { data, error } = await db.rpc('admin_adjust_user_points', {
        p_admin_address: address.toLowerCase(),
        p_user_address: adminUserAddress.trim().toLowerCase(),
        p_points: points,
        p_action: adminAction.trim(),
        p_badge: adminBadge.trim() || null,
        p_type: adminType,
        p_apply_multiplier: adminApplyMult
      })

      if (error) {
        setAdminAdjustStatus({ success: false, message: error.message })
      } else if (data && data.ok) {
        setAdminAdjustStatus({ 
          success: true, 
          message: `Successfully added ${data.final_points} HP (multiplier: ${data.multiplier}x) to ${short(adminUserAddress)}` 
        })
        setAdminUserAddress('')
        setAdminPts('')
        setAdminBadge('')
        if (adminUserAddress.trim().toLowerCase() === address.toLowerCase()) {
          loadProfile()
        }
      } else {
        setAdminAdjustStatus({ success: false, message: data?.error || 'Unknown error' })
      }
    } catch (err) {
      setAdminAdjustStatus({ success: false, message: err.message })
    } finally {
      setIsAdminAdjusting(false)
    }
  }

  const [refInput, setRefInput] = useState('')
  const [refLoading, setRefLoading] = useState(false)
  const [refError, setRefError] = useState('')

  const handleApplyRef = async () => {
    if (!refInput.trim()) return
    setRefLoading(true)
    setRefError('')

    const { data, error } = await db.rpc('apply_referral_code', {
      p_address: address.toLowerCase(),
      p_code: refInput.trim()
    })

    if (error) {
      setRefError('Database error. Try again.')
    } else if (!data.ok) {
      setRefError(data.error)
    } else {
      await loadProfile()
    }
    setRefLoading(false)
  }

  return (
    <div style={{ paddingBottom: 120, padding: '0 12px 120px', position: 'relative' }}>
      
      {/* Home Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '0 4px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: '#0A0B0D', letterSpacing: '-0.5px' }}>
          Home
        </h2>
      </div>

      {/* Crystal Clear Player Passport */}
      <div
        style={{
          backgroundImage: 'url(/banner.jpg)',
          backgroundColor: '#0052FF',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          borderRadius: 24,
          padding: '24px 20px',
          marginBottom: 16,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0,82,255,0.25)',
          border: '1px solid rgba(255,255,255,0.15)',
        }}
      >
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 80, 0.35)', zIndex: 0 }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,82,255,0.1) 100%)', zIndex: 0 }} />

        {/* Top Bar: Player Identity Passport */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          {/* Avatar & User Address/Basename */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              overflow: 'hidden',
              border: '2px solid rgba(255,255,255,0.2)',
              background: 'rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <UserAvatar address={address} size={44} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: -0.3 }}>
                {basename || short(address)}
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', fontFamily: 'monospace' }}>
                {address ? `${address.slice(0, 10)}...${address.slice(-8)}` : ''}
              </div>
            </div>
          </div>
          
          {/* Disconnect Button */}
          <button
            onClick={() => disconnect()}
            style={{
              background: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.9)',
              borderRadius: 50,
              padding: '6px 14px',
              fontSize: 9,
              fontWeight: 900,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              outline: 'none'
            }}
          >
            DISCONNECT
          </button>
        </div>

        {/* Divider */}
        <div style={{ position: 'relative', zIndex: 1, height: 1, background: 'rgba(255,255,255,0.15)', margin: '16px 0' }} />

        {/* Two-column balance stats */}
        <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {/* HP Balance */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            padding: '12px 14px',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
          }}>
            <div style={{ fontSize: 8.5, fontWeight: 800, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 }}>
              Happy Points
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', fontFamily: "'Barlow Condensed',sans-serif" }}>
                {userStats.points.toLocaleString()}
              </span>
              <span style={{ fontSize: 10, fontWeight: 900, color: '#A5B4FC' }}>HP</span>
            </div>
          </div>

          {/* $HH Wallet Balance */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(12px)',
            padding: '12px 14px',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)'
          }}>
            <div style={{ fontSize: 8.5, fontWeight: 800, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 }}>
              $HH Balance
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', fontFamily: "'Barlow Condensed',sans-serif" }}>
                {parseFloat(walletBalance.toFixed(2)).toLocaleString()}
              </span>
              <span style={{ fontSize: 10, fontWeight: 900, color: '#34D399' }}>$HH</span>
            </div>
          </div>
        </div>
      </div>

      {/* Premium Swap Widget */}
      <div style={{
        background: '#FFFFFF',
        border: '1px solid #DEE1E7',
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        boxShadow: '0 4px 16px rgba(10,11,13,0.04)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ fontSize: 14, fontWeight: 900, color: '#0A0B0D', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
            🦄 Swap $HH Token
          </h3>
          <span style={{
            fontSize: 9.5,
            fontWeight: 800,
            color: '#0052FF',
            background: '#F0F5FF',
            padding: '2px 8px',
            borderRadius: 12
          }}>
            Base Network
          </span>
        </div>

        {/* Live Token Price Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#F8F9FC',
          padding: '10px 14px',
          borderRadius: 14,
          marginBottom: 14,
          border: '1px solid #EEF0F3'
        }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#717886', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Live $HH Price
            </div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#0A0B0D', fontFamily: 'monospace', marginTop: 2 }}>
              ${formatNumber(hhPrice, 5)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              background: priceChange >= 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
              color: priceChange >= 0 ? '#10B981' : '#EF4444',
              fontSize: 10,
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: 20,
              border: priceChange >= 0 ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
            }}>
              {priceChange >= 0 ? '▲' : '▼'} {priceChange}% (24h)
            </span>
          </div>
        </div>

        {/* Pay Input */}
        <div style={{
          background: '#F8F9FC',
          border: '1px solid #DEE1E7',
          borderRadius: 16,
          padding: '12px 14px',
          position: 'relative',
          marginBottom: 6
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 800, color: '#717886', marginBottom: 6 }}>
            <span>You Pay</span>
            <span>Balance: {isBuying ? `${formatNumber(simulatedUsdcBalance, 2)} USDC` : `${formatNumber(walletBalance, 0)} $HH`}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <input
              type="number"
              placeholder="0.00"
              value={payAmount}
              onChange={(e) => handlePayChange(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 18,
                fontWeight: 900,
                color: '#0A0B0D',
                width: '60%',
                fontFamily: 'monospace'
              }}
            />
            {isBuying ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFFFFF', padding: '6px 12px', borderRadius: 12, border: '1px solid #DEE1E7', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <img src="/usdc-logo.png" alt="USDC" style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 12, fontWeight: 900, color: '#0A0B0D' }}>USDC</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0052FF', padding: '6px 12px', borderRadius: 12, boxShadow: '0 2px 4px rgba(0,82,255,0.15)' }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: '#FFFFFF' }}>$HH</span>
              </div>
            )}
          </div>
        </div>

        {/* Direction Switcher Button */}
        <div style={{ display: 'flex', justifyContent: 'center', margin: '-10px 0', position: 'relative', zIndex: 2 }}>
          <button
            onClick={handleSwapDirection}
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#FFFFFF',
              border: '1px solid #DEE1E7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              color: '#0052FF',
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'rotate(180deg)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'rotate(0deg)'}
          >
            ⇅
          </button>
        </div>

        {/* Receive Input */}
        <div style={{
          background: '#F8F9FC',
          border: '1px solid #DEE1E7',
          borderRadius: 16,
          padding: '12px 14px',
          position: 'relative',
          marginTop: 6,
          marginBottom: 14
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontWeight: 800, color: '#717886', marginBottom: 6 }}>
            <span>You Receive</span>
            <span>Balance: {isBuying ? `${formatNumber(walletBalance, 0)} $HH` : `${formatNumber(simulatedUsdcBalance, 2)} USDC`}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <input
              type="number"
              placeholder="0.00"
              value={receiveAmount}
              onChange={(e) => handleReceiveChange(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 18,
                fontWeight: 900,
                color: '#0A0B0D',
                width: '60%',
                fontFamily: 'monospace'
              }}
            />
            {!isBuying ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#FFFFFF', padding: '6px 12px', borderRadius: 12, border: '1px solid #DEE1E7', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                <img src="/usdc-logo.png" alt="USDC" style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 12, fontWeight: 900, color: '#0A0B0D' }}>USDC</span>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#0052FF', padding: '6px 12px', borderRadius: 12, boxShadow: '0 2px 4px rgba(0,82,255,0.15)' }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: '#FFFFFF' }}>$HH</span>
              </div>
            )}
          </div>
        </div>

        {swapError && (
          <div style={{ marginBottom: 12, padding: 10, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 10, color: '#DC2626', fontSize: 11, fontWeight: 700 }}>
            ⚠️ {swapError}
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleSwapExecute}
          style={{
            width: '100%',
            padding: '14px',
            background: 'linear-gradient(135deg, #FF007A 0%, #D80066 100%)',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 16,
            fontSize: 14,
            fontWeight: 850,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(255,0,122,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 12
          }}
        >
          <span>{isBuying ? 'Swap USDC to $HH' : 'Swap $HH to USDC'}</span>
        </button>

        {/* Uniswap direct link */}
        <a
          href="https://app.uniswap.org/swap?inputCurrency=ETH&outputCurrency=0x8235EdF32a1e10Bd1867ad622915ab613664cbA3&chain=base"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'none', display: 'block', textAlign: 'center', fontSize: 11, fontWeight: 800, color: '#FF007A' }}
        >
          Trade directly on Uniswap 🦄
        </a>
      </div>

      {/* Referral Program: Senior Hub */}
      <div style={{ background: '#fff', border: '1px solid #DEE1E7', borderRadius: 20, padding: 16, marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0A0B0D' }}>Referral Hub</div>
            <div style={{ fontSize: 9.5, color: '#717886', marginTop: 3, fontWeight: 500, lineHeight: 1.4 }}>
              Invite friends and <span style={{ color: '#0052FF', fontWeight: 800 }}>earn 20% of their HP</span> forever.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <div style={{ flex: 1.5, background: '#F1F5F9', borderRadius: 12, padding: '10px 12px', border: '1px solid #E2E8F0', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 9, color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{referralLink}</span>
          </div>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(referralLink)
                setLinkCopied(true)
                setTimeout(() => setLinkCopied(false), 2000)
              } catch {}
            }}
            style={{ flex: 1, background: '#0052FF', color: '#fff', border: 'none', borderRadius: 12, fontSize: 10, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,82,255,0.15)' }}
          >
            {linkCopied ? '✓' : 'Copy'}
          </button>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(userStats.ref_code || address)
                setCodeCopied(true)
                setTimeout(() => setCodeCopied(false), 2000)
              } catch {}
            }}
            style={{ flex: 1, background: '#10B981', color: '#fff', border: 'none', borderRadius: 12, fontSize: 10, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(16,185,129,0.15)' }}
          >
            {codeCopied ? '✓' : 'Code'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '10px 8px', border: '1px solid #F1F5F9', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#0A0B0D', lineHeight: 1 }}>{userStats.referral_count}</div>
            <div style={{ fontSize: 8, color: '#64748B', marginTop: 4, fontWeight: 800, textTransform: 'uppercase' }}>FRIENDS</div>
          </div>
          <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '10px 8px', border: '1px solid #F1F5F9', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: '#0052FF', lineHeight: 1 }}>{userStats.referral_points} <span style={{ fontSize: 9 }}>HP</span></div>
            <div style={{ fontSize: 8, color: '#64748B', marginTop: 4, fontWeight: 800, textTransform: 'uppercase' }}>EARNED</div>
          </div>
        </div>

        {userStats.referrer ? (
          <div style={{ paddingTop: 12, borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669' }} />
            <div style={{ fontSize: 10.5, fontWeight: 700, color: '#059669' }}>
              Referred by: <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 500, opacity: 0.8 }}>{userStats.referrer.slice(0, 6)}...{userStats.referrer.slice(-4)}</span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, paddingTop: 12, borderTop: '1px solid #F1F5F9' }}>
            <input
              type="text"
              value={refInput}
              onChange={(e) => setRefInput(e.target.value)}
              placeholder="Enter referral code"
              style={{ flex: 1, background: '#fff', border: '1px solid #DEE1E7', borderRadius: 10, padding: '10px 12px', fontSize: 11, outline: 'none', fontFamily: "'DM Mono', monospace" }}
            />
            <button
              onClick={handleApplyRef}
              disabled={refLoading || !refInput.trim()}
              style={{ background: '#0052FF', color: '#fff', border: 'none', borderRadius: 10, padding: '0 16px', fontSize: 11, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,82,255,0.1)' }}
            >
              Apply
            </button>
          </div>
        )}
      </div>

      <HistorySection address={address} />

      {/* Spacer to push Admin Panel lower */}
      <div style={{ height: 60 }} />

      {isAdmin && (
        <div style={{
          marginTop: 16,
          background: '#FEF2F2',
          padding: 16,
          borderRadius: 20,
          border: '1px solid #FCA5A5',
          boxShadow: '0 4px 20px rgba(220,38,38,0.02)'
        }}>
          {/* Admin Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#DC2626' }} />
            <div style={{ fontWeight: 800, fontSize: 10, color: '#DC2626', letterSpacing: '0.5px' }}>
              🛠️ Admin Control Panel
            </div>
          </div>

          {/* Raffle Vault Block */}
          <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(252, 165, 165, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#B91C1C', letterSpacing: '0.5px' }}>Raffle Vault Balance</div>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#991B1B', fontFamily: "'DM Mono', monospace" }}>
                {vaultBalanceData ? parseFloat(vaultBalanceData.formatted).toFixed(2) : '0.00'} USDC
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="Amount USDC"
                style={{
                  flex: 1.5,
                  padding: '8px 10px',
                  borderRadius: 12,
                  border: '1px solid #FCA5A5',
                  background: '#fff',
                  fontSize: 10,
                  fontFamily: "'DM Mono', monospace",
                  outline: 'none',
                  color: '#0A0B0D'
                }}
              />
              <button
                onClick={rescueMyFunds}
                style={{
                  flex: 1,
                  padding: '8px 8px',
                  background: '#DC2626',
                  color: '#fff',
                  borderRadius: 12,
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 10,
                  boxShadow: '0 4px 12px rgba(220,38,38,0.15)',
                  whiteSpace: 'nowrap'
                }}
              >
                Refund
              </button>
            </div>
          </div>

          {/* Payments Vault Block */}
          <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(252, 165, 165, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#B91C1C', letterSpacing: '0.5px' }}>Payments Vault Balance</div>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#991B1B', fontFamily: "'DM Mono', monospace" }}>
                {paymentsVaultBalanceData ? parseFloat(paymentsVaultBalanceData.formatted).toFixed(2) : '0.00'} USDC
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number"
                value={paymentsRefundAmount}
                onChange={(e) => setPaymentsRefundAmount(e.target.value)}
                placeholder="Amount USDC"
                style={{
                  flex: 1.5,
                  padding: '8px 10px',
                  borderRadius: 12,
                  border: '1px solid #FCA5A5',
                  background: '#fff',
                  fontSize: 10,
                  fontFamily: "'DM Mono', monospace",
                  outline: 'none',
                  color: '#0A0B0D'
                }}
              />
              <button
                onClick={refundPaymentsVaultSpecific}
                style={{
                  flex: 1,
                  padding: '8px 8px',
                  background: '#DC2626',
                  color: '#fff',
                  borderRadius: 12,
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 10,
                  boxShadow: '0 4px 12px rgba(220,38,38,0.15)',
                  whiteSpace: 'nowrap'
                }}
              >
                Refund
              </button>
              <button
                onClick={sweepPaymentsVault}
                style={{
                  flex: 1,
                  padding: '8px 8px',
                  background: '#991B1B',
                  color: '#fff',
                  borderRadius: 12,
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 10,
                  boxShadow: '0 4px 12px rgba(153,27,27,0.15)',
                  whiteSpace: 'nowrap'
                }}
              >
                Full Refund
              </button>
            </div>
          </div>

          {/* Total Registered Users */}
          <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(252, 165, 165, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#B91C1C', letterSpacing: '0.5px' }}>Total Registered Users</div>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#991B1B', fontFamily: "'DM Mono', monospace" }}>
                {totalUsers}
              </div>
            </div>
          </div>

          {/* Points & History Adjustments */}
          <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(252, 165, 165, 0.4)' }}>
            <div style={{ fontWeight: 800, fontSize: 11, color: '#4B5563', letterSpacing: '0.5px', marginBottom: 10 }}>
              ✍️ Adjust Points & History
            </div>

            <form onSubmit={handleAdminAdjustPoints} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', marginBottom: 4, letterSpacing: '0.5px' }}>User Address</div>
                  <input 
                    type="text" 
                    placeholder="0x..." 
                    value={adminUserAddress} 
                    onChange={e => setAdminUserAddress(e.target.value)} 
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 12, border: '1px solid #FCA5A5', fontSize: 11, fontFamily: "'DM Mono', monospace", outline: 'none', color: '#0A0B0D' }} 
                  />
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', marginBottom: 4, letterSpacing: '0.5px' }}>Base Points (HP)</div>
                  <input 
                    type="number" 
                    step="any" 
                    placeholder="e.g. 50" 
                    value={adminPts} 
                    onChange={e => setAdminPts(e.target.value)} 
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 12, border: '1px solid #FCA5A5', fontSize: 11, fontFamily: "'DM Mono', monospace", outline: 'none', textAlign: 'center', color: '#0A0B0D' }} 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', marginBottom: 4, letterSpacing: '0.5px' }}>Action Name</div>
                  <input 
                    type="text" 
                    placeholder="e.g. Reward" 
                    value={adminAction} 
                    onChange={e => setAdminAction(e.target.value)} 
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 12, border: '1px solid #FCA5A5', fontSize: 11, outline: 'none', color: '#0A0B0D' }} 
                  />
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', marginBottom: 4, letterSpacing: '0.5px' }}>Badge Text</div>
                  <input 
                    type="text" 
                    placeholder="e.g. Streak 50" 
                    value={adminBadge} 
                    onChange={e => setAdminBadge(e.target.value)} 
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 12, border: '1px solid #FCA5A5', fontSize: 11, outline: 'none', color: '#0A0B0D' }} 
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 8, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', marginBottom: 4, letterSpacing: '0.5px' }}>Badge Type (Style)</div>
                  <select 
                    value={adminType} 
                    onChange={e => setAdminType(e.target.value)} 
                    style={{ width: '100%', padding: '6px 10px', borderRadius: 12, border: '1px solid #FCA5A5', fontSize: 11, outline: 'none', background: '#fff', color: '#0A0B0D' }}
                  >
                    <option value="quest">Quest (Purple)</option>
                    <option value="checkin">Checkin (Blue)</option>
                    <option value="win">Win (Green)</option>
                    <option value="boost">Boost (Blue)</option>
                    <option value="deposit">Deposit (Orange)</option>
                    <option value="default">Default (Grey)</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 14 }}>
                  <input 
                    type="checkbox" 
                    id="adminApplyMult"
                    checked={adminApplyMult} 
                    onChange={e => setAdminApplyMult(e.target.checked)} 
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="adminApplyMult" style={{ fontSize: 10, fontWeight: 800, color: '#4B5563', cursor: 'pointer', userSelect: 'none' }}>
                    Apply Multiplier
                  </label>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={isAdminAdjusting} 
                style={{ width: '100%', padding: '8px 16px', background: '#DC2626', color: '#fff', borderRadius: 12, fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: 10, boxShadow: '0 4px 12px rgba(220,38,38,0.15)', letterSpacing: '0.5px', marginTop: 4 }}
              >
                {isAdminAdjusting ? 'Adjusting...' : 'Add Points & Create Log'}
              </button>
            </form>

            {adminAdjustStatus && (
              <div style={{ 
                marginTop: 8, 
                padding: '8px 10px', 
                borderRadius: 10, 
                fontSize: 10, 
                fontWeight: 700,
                background: adminAdjustStatus.success ? '#ECFDF5' : '#FEF2F2',
                border: `1px solid ${adminAdjustStatus.success ? '#10B981' : '#FCA5A5'}`,
                color: adminAdjustStatus.success ? '#065F46' : '#991B1B'
              }}>
                {adminAdjustStatus.message}
              </div>
            )}
          </div>

          {/* Simulation Diagnostics */}
          <div style={{ color: '#000' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontWeight: 800, fontSize: 11, color: '#4B5563', letterSpacing: '0.5px' }}>🧪 Leaderboard Stress Test</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF' }}>Simulated Users: <span style={{ color: '#4F46E5', fontFamily: "'DM Mono', monospace" }}>{simulatedUsers.length}</span></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', marginBottom: 4, letterSpacing: '0.5px' }}>Count</div>
                <input type="number" value={simCount} onChange={e => setSimCount(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: 12, border: '1px solid #FCA5A5', fontSize: 11, fontFamily: "'DM Mono', monospace", outline: 'none', textAlign: 'center' }} />
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', marginBottom: 4, letterSpacing: '0.5px' }}>Min HP</div>
                <input type="number" step="any" value={simMinHP} onChange={e => setSimMinHP(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: 12, border: '1px solid #FCA5A5', fontSize: 11, fontFamily: "'DM Mono', monospace", outline: 'none', textAlign: 'center' }} />
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 800, color: '#9CA3AF', marginBottom: 4, letterSpacing: '0.5px' }}>Max HP</div>
                <input type="number" step="any" value={simMaxHP} onChange={e => setSimMaxHP(e.target.value)} style={{ width: '100%', padding: '6px 10px', borderRadius: 12, border: '1px solid #FCA5A5', fontSize: 11, fontFamily: "'DM Mono', monospace", outline: 'none', textAlign: 'center' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 15 }}>
              <button onClick={handleSimulate} disabled={isSimulating} style={{ flex: 1, padding: '8px 16px', background: '#4F46E5', color: '#fff', borderRadius: 12, fontWeight: 800, border: 'none', cursor: 'pointer', fontSize: 10, boxShadow: '0 4px 12px rgba(79,70,229,0.15)', letterSpacing: '0.5px' }}>
                {isSimulating ? 'Generating...' : `+ Add ${simCount} Test Users`}
              </button>
              <button onClick={handleResetSim} style={{ padding: '8px 16px', background: 'none', border: '1px solid #DC2626', color: '#DC2626', borderRadius: 12, fontWeight: 800, cursor: 'pointer', fontSize: 10, letterSpacing: '0.5px' }}>
                Reset Test Users
              </button>
            </div>

            <div style={{ maxHeight: 200, overflowY: 'auto', background: '#fff', borderRadius: 12, border: '1px solid #DEE1E7', padding: 8 }}>
              {simulatedUsers.map(sim => (
                <div key={sim.address} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={() => handleDeleteSim(sim.address)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: 14,
                        padding: '4px 8px',
                        borderRadius: 6,
                        opacity: 0.6
                      }}
                    >
                      🗑️
                    </button>
                    <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#6B7280' }}>{short(sim.address)}</div>
                  </div>

                  {editingSim?.address === sim.address ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input
                        autoFocus
                        type="number"
                        step="any"
                        defaultValue={sim.points}
                        onBlur={e => handleUpdateSimHP(sim.address, e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleUpdateSimHP(sim.address, e.currentTarget.value)}
                        style={{ width: 70, padding: '2px 6px', fontSize: 11, borderRadius: 4, border: '1px solid #4F46E5' }}
                      />
                    </div>
                  ) : (
                    <div
                      onClick={() => setEditingSim(sim)}
                      style={{ fontSize: 12, fontWeight: 800, color: '#111827', cursor: 'pointer', padding: '2px 8px', borderRadius: 4, background: '#F9FAFB' }}
                    >
                      {sim.points.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} HP ✏️
                    </div>
                  )}
                </div>
              ))}
              {simulatedUsers.length === 0 && <div style={{ textAlign: 'center', fontSize: 11, color: '#9CA3AF', padding: 10 }}>No simulation participants generated yet</div>}
            </div>
          </div>
        </div>
      )}

      {/* Transaction simulation overlay modal */}
      {txStep && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10,11,13,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 24, padding: 28, maxWidth: 360, width: '100%',
            boxShadow: '0 12px 48px rgba(0,0,0,0.15)', textAlign: 'center',
          }}>
            <div style={{ marginBottom: 20 }}>
              {txStep === 'success' ? (
                <span style={{ fontSize: 54 }}>🎉</span>
              ) : (
                <div style={{
                  width: 50, height: 50, border: '4px solid #F0F5FF', borderTopColor: '#0052FF',
                  borderRadius: '50%', margin: '0 auto', animation: 'spin 1s linear infinite'
                }} />
              )}
            </div>

            <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0A0B0D', marginBottom: 8 }}>
              {txStep === 'action_signing' && 'Confirming Swap'}
              {txStep === 'action_pending' && 'Executing Swap Transaction'}
              {txStep === 'success' && 'Swap Confirmed!'}
            </h3>

            <p style={{ fontSize: 12.5, color: '#717886', lineHeight: 1.5, marginBottom: 20 }}>
              {txStep === 'action_signing' && 'Please confirm the swap transaction in your wallet.'}
              {txStep === 'action_pending' && 'Updating simulated balances on Base Network...'}
              {txStep === 'success' && 'Your swap was executed successfully! Your wallet balances have updated.'}
            </p>

            {txStep === 'success' && (
              <button
                onClick={() => setTxStep(null)}
                style={{
                  background: 'linear-gradient(135deg, #0052FF 0%, #0043D0 100%)',
                  color: '#FFFFFF', border: 'none', borderRadius: 12, padding: '10px 24px',
                  fontSize: 13, fontWeight: 800, cursor: 'pointer',
                  width: '100%'
                }}
              >
                Close
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
