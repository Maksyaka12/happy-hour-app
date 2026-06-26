import { useEffect, useMemo, useRef, useState } from 'react'
import { useDisconnect, useWriteContract, useBalance, useReadContract } from 'wagmi'
import { formatUnits, parseUnits } from 'viem'
import { APP_URL, FOUNDATION, CHECKIN_TARGET, USDC_ADDRESS, USDC_ABI, HH_ADDRESS, HH_ABI, HH_MANAGER_ADDRESS } from '../config/constants'
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

const formatConcise = (num) => {
  const n = parseFloat(num || 0)
  if (n >= 1e9) {
    const val = (n / 1e9).toFixed(2)
    return val.endsWith('.00') ? val.slice(0, -3) + 'b' : val.endsWith('0') ? val.slice(0, -1) + 'b' : val + 'b'
  }
  if (n >= 1e6) {
    const val = (n / 1e6).toFixed(2)
    return val.endsWith('.00') ? val.slice(0, -3) + 'm' : val.endsWith('0') ? val.slice(0, -1) + 'm' : val + 'm'
  }
  if (n >= 1e3) {
    const val = (n / 1e3).toFixed(2)
    return val.endsWith('.00') ? val.slice(0, -3) + 'k' : val.endsWith('0') ? val.slice(0, -1) + 'k' : val + 'k'
  }
  return n.toFixed(2).replace(/\.00$/, '')
}

const formatExactOrConcise = (balanceData) => {
  if (!balanceData) return '0.00';
  const num = parseFloat(balanceData.formatted);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6
  });
}

const safeParseUnits = (amountStr, decimals = 18) => {
  if (!amountStr || isNaN(amountStr)) return 0n;
  const parts = amountStr.trim().split('.');
  let processed = amountStr.trim();
  if (parts.length > 1) {
    processed = `${parts[0]}.${parts[1].slice(0, decimals)}`;
  }
  try {
    return parseUnits(processed, decimals);
  } catch (e) {
    console.error("Error parsing units:", e);
    return 0n;
  }
}


export function ProfileSection({ address, basename, totalUsers, setTab }) {
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

  // List of swap-eligible tokens in Base Network
  const swapTokens = [
    { symbol: 'ETH', name: 'Ethereum', logo: '/eth-logo.png', logoBg: '#627EEA', priceUsd: 3500.00, balanceKey: 'eth_simulated_wallet', defaultBalance: 0.15 },
    { symbol: 'USDC', name: 'USD Coin', logo: '/usdc-logo.png', priceUsd: 1.00, balanceKey: 'usdc_simulated_wallet', defaultBalance: 500.00 },
    { symbol: 'WETH', name: 'Wrapped Ether', logo: '/weth-logo.png', logoBg: '#8C8C8C', priceUsd: 3500.00, balanceKey: 'weth_simulated_wallet', defaultBalance: 0.05 },
  ]

  // Read real native ETH balance
  const { data: ethBalanceRaw } = useBalance({
    address: address ? address : undefined,
    query: { enabled: !!address, refetchInterval: 15000 }
  })
  const realEthBalance = ethBalanceRaw !== undefined
    ? parseFloat(ethBalanceRaw.formatted)
    : 0.15

  // Read real contract balance for USDC
  const { data: usdcBalanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 }
  })
  const realUsdcBalance = usdcBalanceRaw !== undefined
    ? parseFloat(formatUnits(usdcBalanceRaw, 6))
    : simulatedUsdcBalance

  // Read real WETH balance (WETH address is 0x4200000000000000000000000000000000000006 on Base)
  const WETH_ADDRESS = '0x4200000000000000000000000000000000000006'
  const { data: wethBalanceRaw } = useReadContract({
    address: WETH_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 }
  })
  const realWethBalance = wethBalanceRaw !== undefined
    ? parseFloat(formatUnits(wethBalanceRaw, 18))
    : 0.05

  const tokenBalances = useMemo(() => {
    return {
      ETH: realEthBalance,
      USDC: realUsdcBalance,
      WETH: realWethBalance,
    }
  }, [realEthBalance, realUsdcBalance, realWethBalance])

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
  const [paymentsHHRefundAmount, setPaymentsHHRefundAmount] = useState('')
  const [hhRaffleRefundAmount, setHhRaffleRefundAmount] = useState('')
  const HH_RAFFLE_VAULT = '0x3bdF461984142C473F2185B4F0F64a918B8ce49b'

  const rescueMyFunds = () => {
    const amountBigInt = safeParseUnits(refundAmount, 6);
    if (amountBigInt === 0n) return;

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

  const refundHHRaffleSpecific = () => {
    const amountBigInt = safeParseUnits(hhRaffleRefundAmount, 18);
    if (amountBigInt === 0n) return;

    wagmiWriteContract({
      address: HH_RAFFLE_VAULT,
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
        HH_ADDRESS,
        address,
        amountBigInt
      ]
    })
  }

  const refundHHRaffleAll = () => {
    if (!hhRaffleVaultBalanceData?.value) return;

    wagmiWriteContract({
      address: HH_RAFFLE_VAULT,
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
        HH_ADDRESS,
        address,
        hhRaffleVaultBalanceData.value
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
    const amountBigInt = safeParseUnits(paymentsRefundAmount, 6);
    if (amountBigInt === 0n) return;

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

  const refundPaymentsHHSpecific = () => {
    const amountBigInt = safeParseUnits(paymentsHHRefundAmount, 18);
    if (amountBigInt === 0n) return;

    wagmiWriteContract({
      address: HH_MANAGER_ADDRESS,
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
        HH_ADDRESS,
        address,
        amountBigInt
      ]
    })
  }

  const refundPaymentsHHAll = () => {
    if (!paymentsVaultHHBalanceData?.value) return;

    wagmiWriteContract({
      address: HH_MANAGER_ADDRESS,
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
        HH_ADDRESS,
        address,
        paymentsVaultHHBalanceData.value
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

  const { data: hhRaffleVaultBalanceData } = useBalance({
    address: HH_RAFFLE_VAULT,
    token: HH_ADDRESS,
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

  const { data: paymentsVaultHHBalanceData } = useBalance({
    address: HH_MANAGER_ADDRESS,
    token: HH_ADDRESS,
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
  const [isBuying, setIsBuying] = useState(true) // true: SelectToken -> $HH, false: $HH -> SelectToken
  const [payAmount, setPayAmount] = useState('')
  const [receiveAmount, setReceiveAmount] = useState('')
  const [txStep, setTxStep] = useState(null) // 'action_signing' | 'action_pending' | 'success' | 'redirected' | null
  const [swapError, setSwapError] = useState('')
  const [uniswapUrl, setUniswapUrl] = useState('')
  
  // Selectable Token State (defaults to USDC)
  const [selectedSymbol, setSelectedSymbol] = useState('USDC')
  const [isSelectorOpen, setIsSelectorOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Sort tokens by descending USD Value
  const sortedTokens = useMemo(() => {
    return swapTokens.map(t => {
      const bal = tokenBalances[t.symbol] ?? t.defaultBalance
      return {
        ...t,
        balance: bal,
        usdValue: bal * t.priceUsd
      }
    }).sort((a, b) => b.usdValue - a.usdValue)
  }, [tokenBalances])

  const activeSelectedToken = useMemo(() => {
    return sortedTokens.find(t => t.symbol === selectedSymbol) || sortedTokens[0]
  }, [sortedTokens, selectedSymbol])

  // Handle Input Changes
  const handlePayChange = (val) => {
    setPayAmount(val)
    if (!val || isNaN(val)) {
      setReceiveAmount('')
      return
    }
    const pay = parseFloat(val)
    if (isBuying) {
      // Token -> $HH
      const hhAmt = (pay * activeSelectedToken.priceUsd) / hhPrice
      setReceiveAmount(hhAmt.toFixed(2))
    } else {
      // $HH -> Token
      const tokenAmt = (pay * hhPrice) / activeSelectedToken.priceUsd
      const decimals = activeSelectedToken.symbol === 'ETH' || activeSelectedToken.symbol === 'WETH' ? 6 : 2
      setReceiveAmount(tokenAmt.toFixed(decimals))
    }
  }

  const handlePercentClick = (pct) => {
    const maxBal = isBuying 
      ? (tokenBalances[activeSelectedToken.symbol] ?? 0)
      : walletBalance;

    let multiplier = 0.25;
    if (pct === '50%') multiplier = 0.50;
    if (pct === 'MAX') multiplier = 1.0;

    const val = maxBal * multiplier;
    handlePayChange(val.toFixed(6).replace(/\.?0+$/, ''));
  }

  const handleReceiveChange = (val) => {
    setReceiveAmount(val)
    if (!val || isNaN(val)) {
      setPayAmount('')
      return
    }
    const recv = parseFloat(val)
    if (isBuying) {
      // Token -> $HH
      const tokenAmt = (recv * hhPrice) / activeSelectedToken.priceUsd
      const decimals = activeSelectedToken.symbol === 'ETH' || activeSelectedToken.symbol === 'WETH' ? 6 : 2
      setPayAmount(tokenAmt.toFixed(decimals))
    } else {
      // $HH -> Token
      const hhAmt = (recv * activeSelectedToken.priceUsd) / hhPrice
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

    const tokenBal = tokenBalances[activeSelectedToken.symbol] ?? activeSelectedToken.defaultBalance

    if (isBuying) {
      if (pay > tokenBal) {
        setSwapError(`Insufficient ${activeSelectedToken.symbol} balance.`)
        return
      }
    } else {
      if (pay > walletBalance) {
        setSwapError('Insufficient $HH balance.')
        return
      }
    }

    const inputToken = isBuying 
      ? (activeSelectedToken.symbol === 'ETH' ? 'ETH' : USDC_ADDRESS) 
      : HH_ADDRESS
    const outputToken = isBuying 
      ? HH_ADDRESS 
      : (activeSelectedToken.symbol === 'ETH' ? 'ETH' : USDC_ADDRESS)
    const url = `https://app.uniswap.org/swap?inputCurrency=${inputToken}&outputCurrency=${outputToken}&chain=base`
    
    setUniswapUrl(url)
    window.open(url, '_blank', 'noopener,noreferrer')
    
    setPayAmount('')
    setReceiveAmount('')
    setTxStep('redirected')
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

  // Filtered Tokens for Modal search
  const filteredTokens = useMemo(() => {
    return sortedTokens.filter(t => 
      t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [sortedTokens, searchQuery])

  return (
    <div style={{ paddingBottom: 120, padding: '0 12px 120px', position: 'relative' }}>
      

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
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(12px)',
            padding: '16px 14px',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 32, fontWeight: 900, color: '#fff', fontFamily: "'Barlow Condensed',sans-serif" }}>
                {userStats.points.toLocaleString()}
              </span>
              <span style={{ fontSize: 14, fontWeight: 900, color: '#A5B4FC' }}>HP</span>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255, 255, 255, 0.48)' }}>
              app points
            </div>
          </div>

          {/* $HH Wallet Balance */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(12px)',
            padding: '16px 14px',
            borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 32, fontWeight: 900, color: '#fff', fontFamily: "'Barlow Condensed',sans-serif" }}>
                {formatConcise(walletBalance)}
              </span>
              <span style={{ fontSize: 14, fontWeight: 900, color: '#A5B4FC' }}>$HH</span>
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255, 255, 255, 0.48)' }}>
              ≈${walletBalance * hhPrice >= 0.01 
                ? (walletBalance * hhPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : (walletBalance * hhPrice).toFixed(4)}
            </div>
          </div>
        </div>
      </div>

      {/* Premium Base App Style Swap Widget — Compact & Elegant */}
      <div style={{
        borderRadius: 24,
        padding: '16px 16px 14px',
        marginBottom: 16,
        boxShadow: '0 8px 32px rgba(236, 72, 153, 0.15)',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        background: '#1A0815'
      }}>
        {/* Grayscaled background image overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/banner.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'grayscale(100%) brightness(0.25) contrast(1.2)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />

        {/* Pink/plum gradient overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.22) 0%, rgba(147, 51, 234, 0.22) 100%)',
          zIndex: 1,
          pointerEvents: 'none'
        }} />

        {/* Content Container */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* Swap Panel Stack */}
          <div style={{ position: 'relative' }}>
            
            {/* FROM FIELD */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.06)',
              backdropFilter: 'blur(8px)',
              borderRadius: 18,
              padding: '10px 14px 8px',
              marginBottom: 4,
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 800, color: 'rgba(255, 255, 255, 0.6)', marginBottom: 4 }}>
                <span>From</span>
                <span>
                  Balance: {isBuying 
                    ? `${formatConcise(tokenBalances[activeSelectedToken.symbol])} ${activeSelectedToken.symbol}` 
                    : `${formatConcise(walletBalance)} $HH`}
                </span>
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
                    fontSize: 20,
                    fontWeight: 800,
                    color: '#FFFFFF',
                    width: '55%',
                    fontFamily: 'monospace'
                  }}
                />
                
                {/* Right Stack: Token Selector + Percentage shortcuts */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                  {isBuying ? (
                    <button
                      onClick={() => setIsSelectorOpen(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        background: 'rgba(255, 255, 255, 0.1)',
                        padding: '6px 0',
                        borderRadius: 10,
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                        cursor: 'pointer',
                        outline: 'none',
                        transition: 'all 0.2s',
                        height: 30,
                        width: 100,
                        boxSizing: 'border-box'
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                    >
                      {activeSelectedToken.logo.startsWith('/') ? (
                        <img src={activeSelectedToken.logo} alt="" style={{ width: 16, height: 16, borderRadius: '50%' }} />
                      ) : (
                        <span style={{
                          width: 16, height: 16, borderRadius: '50%',
                          background: activeSelectedToken.logoBg || '#8C8C8C',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, color: '#fff'
                        }}>
                          {activeSelectedToken.logo}
                        </span>
                      )}
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#FFFFFF' }}>{activeSelectedToken.symbol}</span>
                      <span style={{ fontSize: 7, color: 'rgba(255, 255, 255, 0.6)' }}>▼</span>
                    </button>
                  ) : (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      background: 'rgba(0, 82, 255, 0.25)',
                      padding: '6px 0',
                      borderRadius: 10,
                      boxShadow: '0 2px 8px rgba(0,82,255,0.15)',
                      border: '1px solid rgba(0, 82, 255, 0.4)',
                      height: 30,
                      width: 100,
                      boxSizing: 'border-box'
                    }}>
                      <img src="/logo.jfif" alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }} />
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#FFFFFF' }}>$HH</span>
                      <span style={{ fontSize: 7, color: 'transparent', userSelect: 'none' }}>▼</span>
                    </div>
                  )}

                  {/* Percentage buttons shortcut row */}
                  <div style={{ display: 'flex', gap: 3 }}>
                    {['25%', '50%', 'MAX'].map(pct => (
                      <button
                        key={pct}
                        onClick={() => handlePercentClick(pct)}
                        style={{
                          background: 'rgba(255,255,255,0.08)',
                          border: '1px solid rgba(255,255,255,0.12)',
                          color: 'rgba(255,255,255,0.7)',
                          fontSize: 7.5,
                          fontWeight: 900,
                          padding: '1px 4px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          outline: 'none'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.18)';
                          e.currentTarget.style.color = '#FFFFFF';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                          e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                        }}
                      >
                        {pct}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 9.5, color: 'rgba(255, 255, 255, 0.4)', marginTop: 2, fontFamily: 'monospace' }}>
                {payAmount ? `~$${formatNumber(parseFloat(payAmount) * (isBuying ? activeSelectedToken.priceUsd : hhPrice), 2)}` : '$0.00'}
              </div>
            </div>

            {/* Direction Switcher Button in middle */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '-12px 0', position: 'relative', zIndex: 10 }}>
              <button
                onClick={handleSwapDirection}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1) rotate(180deg)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                ⇅
              </button>
            </div>

            {/* TO FIELD */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.06)',
              backdropFilter: 'blur(8px)',
              borderRadius: 18,
              padding: '10px 14px 8px',
              marginTop: 4,
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontWeight: 800, color: 'rgba(255, 255, 255, 0.6)', marginBottom: 4 }}>
                <span>To</span>
                <span>
                  Balance: {isBuying 
                    ? `${formatConcise(walletBalance)} $HH` 
                    : `${formatConcise(tokenBalances[activeSelectedToken.symbol])} ${activeSelectedToken.symbol}`}
                </span>
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
                    fontSize: 20,
                    fontWeight: 800,
                    color: '#FFFFFF',
                    width: '55%',
                    fontFamily: 'monospace'
                  }}
                />

                {!isBuying ? (
                  <button
                    onClick={() => setIsSelectorOpen(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      background: 'rgba(255, 255, 255, 0.1)',
                      padding: '6px 0',
                      borderRadius: 10,
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                      cursor: 'pointer',
                      outline: 'none',
                      transition: 'all 0.2s',
                      height: 30,
                      width: 100,
                      boxSizing: 'border-box'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                  >
                    {activeSelectedToken.logo.startsWith('/') ? (
                      <img src={activeSelectedToken.logo} alt="" style={{ width: 16, height: 16, borderRadius: '50%' }} />
                    ) : (
                      <span style={{
                        width: 16, height: 16, borderRadius: '50%',
                        background: activeSelectedToken.logoBg || '#8C8C8C',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, color: '#fff'
                      }}>
                        {activeSelectedToken.logo}
                      </span>
                    )}
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#FFFFFF' }}>{activeSelectedToken.symbol}</span>
                    <span style={{ fontSize: 7, color: 'rgba(255, 255, 255, 0.6)' }}>▼</span>
                  </button>
                ) : (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    background: 'rgba(0, 82, 255, 0.25)',
                    padding: '6px 0',
                    borderRadius: 10,
                    boxShadow: '0 2px 8px rgba(0,82,255,0.15)',
                    border: '1px solid rgba(0, 82, 255, 0.4)',
                    height: 30,
                    width: 100,
                    boxSizing: 'border-box'
                  }}>
                    <img src="/logo.jfif" alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }} />
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#FFFFFF' }}>$HH</span>
                    <span style={{ fontSize: 7, color: 'transparent', userSelect: 'none' }}>▼</span>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 9.5, color: 'rgba(255, 255, 255, 0.4)', marginTop: 2, fontFamily: 'monospace' }}>
                {receiveAmount ? `~$${formatNumber(parseFloat(receiveAmount) * (isBuying ? hhPrice : activeSelectedToken.priceUsd), 2)}` : '$0.00'}
              </div>
            </div>
          </div>

          {/* Compact Price / Information Line */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 8,
            padding: '0 4px',
            fontSize: 9.5,
            fontWeight: 800,
            color: 'rgba(255, 255, 255, 0.6)'
          }}>
            <span>1 $HH = ${formatNumber(hhPrice, 8)}</span>
            <span style={{ color: priceChange >= 0 ? '#10B981' : '#EF4444' }}>
              {priceChange >= 0 ? '▲' : '▼'} {priceChange}% (24h)
            </span>
          </div>

          {swapError && (
            <div style={{ marginTop: 8, padding: 8, background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: 12, color: '#FCA5A5', fontSize: 10.5, fontWeight: 700 }}>
              ⚠️ {swapError}
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleSwapExecute}
            style={{
              width: '100%',
              padding: '11px',
              background: 'linear-gradient(135deg, #EC4899 0%, #C084FC 100%)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(236, 72, 153, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginTop: 10,
              marginBottom: 8,
              transition: 'all 0.2s',
              outline: 'none'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'none'}
          >
            <span>
              Swap {isBuying ? activeSelectedToken.symbol : '$HH'} ⇄ {isBuying ? '$HH' : activeSelectedToken.symbol}
            </span>
          </button>

          {/* Uniswap direct link */}
          <a
            href="https://app.uniswap.org/swap?inputCurrency=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&outputCurrency=0x8235edf32a1e10bd1867ad622915ab613664cba3&chain=base"
            target="_blank"
            rel="noopener noreferrer"
            style={{ textDecoration: 'none', display: 'block', textAlign: 'center', fontSize: 9.5, fontWeight: 800, color: '#F472B6', marginTop: 6 }}
          >
            Trade directly on Uniswap 🦄
          </a>
        </div>
      </div>

      {/* Referral Program: Senior Hub */}
      <div id="referrals-card" style={{
        borderRadius: 20,
        padding: '16px 18px',
        marginBottom: 16,
        boxShadow: '0 8px 32px rgba(245, 158, 11, 0.15)',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(245, 158, 11, 0.25)',
        background: '#1D0F02'
      }}>
        {/* Grayscaled background image overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'url(/banner.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'grayscale(100%) brightness(0.22) contrast(1.2)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />

        {/* Orange/Amber gradient overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.22) 0%, rgba(239, 68, 68, 0.18) 100%)',
          zIndex: 1,
          pointerEvents: 'none'
        }} />

        {/* Content Container */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 900, color: '#FFFFFF', letterSpacing: '0.2px' }}>Referral Hub</div>
              <div style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.7)', marginTop: 2, fontWeight: 600, lineHeight: 1.4 }}>
                Invite friends and <span style={{ color: '#FBBF24', fontWeight: 800 }}>earn 20% of their HP</span> forever.
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.06)',
              backdropFilter: 'blur(8px)',
              borderRadius: 10,
              padding: '0 12px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              height: 30,
              boxSizing: 'border-box'
            }}>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255, 255, 255, 0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{referralLink}</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(referralLink)
                    setLinkCopied(true)
                    setTimeout(() => setLinkCopied(false), 2000)
                  } catch {}
                }}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 8px rgba(245,158,129,0.15)',
                  transition: 'all 0.2s',
                  outline: 'none',
                  height: 30,
                  boxSizing: 'border-box'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                {linkCopied ? '✓ Copied' : 'Copy Link'}
              </button>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(userStats.ref_code || address)
                    setCodeCopied(true)
                    setTimeout(() => setCodeCopied(false), 2000)
                  } catch {}
                }}
                style={{
                  flex: 1,
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  color: '#FFFFFF',
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 800,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  outline: 'none',
                  height: 30,
                  boxSizing: 'border-box'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                {codeCopied ? '✓ Copied' : 'Copy Code'}
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.06)',
              backdropFilter: 'blur(12px)',
              borderRadius: 14,
              padding: '10px 8px',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#FFFFFF', lineHeight: 1, fontFamily: "'Outfit', 'Inter', sans-serif" }}>{userStats.referral_count}</div>
              <div style={{ fontSize: 9, color: 'rgba(255, 255, 255, 0.45)', marginTop: 3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2px' }}>Friends</div>
            </div>
            <div style={{
              background: 'rgba(245, 158, 11, 0.08)',
              backdropFilter: 'blur(12px)',
              borderRadius: 14,
              padding: '10px 8px',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#FFFFFF', lineHeight: 1, fontFamily: "'Outfit', 'Inter', sans-serif" }}>
                {userStats.referral_points} <span style={{ fontSize: 10, color: '#FFFFFF' }}>HP</span>
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255, 255, 255, 0.45)', marginTop: 3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2px' }}>Earned</div>
            </div>
          </div>

          {userStats.referrer ? (
            <div style={{ paddingTop: 12, borderTop: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F59E0B' }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: '#FBBF24' }}>
                Referred by: <span style={{ fontFamily: 'monospace', fontWeight: 500, color: '#FFFFFF' }}>{userStats.referrer.slice(0, 6)}...{userStats.referrer.slice(-4)}</span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 6, paddingTop: 12, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <input
                type="text"
                value={refInput}
                onChange={(e) => setRefInput(e.target.value)}
                placeholder="Enter referral code"
                style={{
                  flex: 1.5,
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 10,
                  padding: '0 12px',
                  fontSize: 11,
                  outline: 'none',
                  fontFamily: 'monospace',
                  color: '#FFFFFF',
                  height: 30,
                  boxSizing: 'border-box'
                }}
              />
              <button
                onClick={handleApplyRef}
                disabled={refLoading || !refInput.trim()}
                style={{
                  flex: 1,
                  background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 10,
                  padding: '0 16px',
                  fontSize: 11,
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(245,158,11,0.15)',
                  transition: 'all 0.2s',
                  outline: 'none',
                  height: 30,
                  boxSizing: 'border-box'
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                Apply
              </button>
            </div>
          )}
        </div>
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

          {/* Raffle Vault Balance */}
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

          {/* HH Raffle Vault Balance */}
          <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(252, 165, 165, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#B91C1C', letterSpacing: '0.5px' }}>$HH Raffle Vault Balance</div>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#991B1B', fontFamily: "'DM Mono', monospace" }}>
                {hhRaffleVaultBalanceData
                  ? formatExactOrConcise(hhRaffleVaultBalanceData)
                  : '0.00'} $HH
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number"
                value={hhRaffleRefundAmount}
                onChange={(e) => setHhRaffleRefundAmount(e.target.value)}
                placeholder="Amount $HH"
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
                onClick={refundHHRaffleSpecific}
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
                onClick={refundHHRaffleAll}
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

          {/* Payments Vault Balance */}
          <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid rgba(252, 165, 165, 0.4)' }}>
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

          {/* $HH Payment Vault Balance */}
          <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid rgba(252, 165, 165, 0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#B91C1C', letterSpacing: '0.5px' }}>$HH Payment Vault Balance</div>
              <div style={{ fontSize: 12, fontWeight: 900, color: '#991B1B', fontFamily: "'DM Mono', monospace" }}>
                {paymentsVaultHHBalanceData
                  ? formatExactOrConcise(paymentsVaultHHBalanceData)
                  : '0.00'} $HH
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number"
                value={paymentsHHRefundAmount}
                onChange={(e) => setPaymentsHHRefundAmount(e.target.value)}
                placeholder="Amount $HH"
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
                onClick={refundPaymentsHHSpecific}
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
                onClick={refundPaymentsHHAll}
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

      {/* Selector Modal for selecting token */}
      {isSelectorOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(10,11,13,0.6)', backdropFilter: 'blur(10px)',
          zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 24, padding: 20, maxWidth: 360, width: '100%',
            boxShadow: '0 12px 48px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
            maxHeight: '80vh'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 900, color: '#0A0B0D', margin: 0 }}>Select a token</h3>
              <button 
                onClick={() => { setIsSelectorOpen(false); setSearchQuery(''); }}
                style={{ background: 'none', border: 'none', fontSize: 18, color: '#717886', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <input
              type="text"
              placeholder="Search by name or address"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: 14,
                border: '1px solid #DEE1E7',
                fontSize: 12,
                fontWeight: 750,
                outline: 'none',
                marginBottom: 16,
                background: '#F8F9FC'
              }}
            />

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredTokens.map(token => (
                <div
                  key={token.symbol}
                  onClick={() => {
                    setSelectedSymbol(token.symbol);
                    setIsSelectorOpen(false);
                    setSearchQuery('');
                    setPayAmount('');
                    setReceiveAmount('');
                  }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: 14,
                    cursor: 'pointer',
                    background: selectedSymbol === token.symbol ? '#F0F5FF' : 'transparent',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = selectedSymbol === token.symbol ? '#F0F5FF' : '#F8F9FC'}
                  onMouseLeave={e => e.currentTarget.style.background = selectedSymbol === token.symbol ? '#F0F5FF' : 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {token.logo.startsWith('/') ? (
                      <img src={token.logo} alt="" style={{ width: 26, height: 26, borderRadius: '50%' }} />
                    ) : (
                      <span style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: token.logoBg || '#8C8C8C',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, color: '#fff'
                      }}>
                        {token.logo}
                      </span>
                    )}
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 900, color: '#0A0B0D' }}>{token.symbol}</div>
                      <div style={{ fontSize: 9.5, color: '#717886', marginTop: 1 }}>{token.name}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12.5, fontWeight: 900, color: '#0A0B0D' }}>
                      {formatConcise(token.balance)}
                    </div>
                    <div style={{ fontSize: 9.5, color: '#717886', marginTop: 1, fontFamily: 'monospace' }}>
                      ${formatNumber(token.usdValue, 2)}
                    </div>
                  </div>
                </div>
              ))}
              {filteredTokens.length === 0 && (
                <div style={{ textAlign: 'center', fontSize: 11, color: '#717886', padding: 20 }}>No tokens found</div>
              )}
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
              ) : txStep === 'redirected' ? (
                <span style={{ fontSize: 54 }}>🦄</span>
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
              {txStep === 'redirected' && 'Redirected to Uniswap'}
            </h3>

            <p style={{ fontSize: 12.5, color: '#717886', lineHeight: 1.5, marginBottom: 20 }}>
              {txStep === 'action_signing' && 'Please confirm the swap transaction in your wallet.'}
              {txStep === 'action_pending' && 'Updating simulated balances on Base Network...'}
              {txStep === 'success' && 'Your swap was executed successfully! Your wallet balances have updated.'}
              {txStep === 'redirected' && 'Please complete your swap on the Uniswap interface in the new tab.'}
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

            {txStep === 'redirected' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <button
                  onClick={() => window.open(uniswapUrl, '_blank', 'noopener,noreferrer')}
                  style={{
                    background: 'linear-gradient(135deg, #FF007A 0%, #CC0062 100%)',
                    color: '#FFFFFF', border: 'none', borderRadius: 12, padding: '10px 24px',
                    fontSize: 13, fontWeight: 800, cursor: 'pointer',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}
                >
                  <span>Open Uniswap</span>
                </button>
                <button
                  onClick={() => setTxStep(null)}
                  style={{
                    background: '#F0F2F5',
                    color: '#0A0B0D', border: 'none', borderRadius: 12, padding: '10px 24px',
                    fontSize: 13, fontWeight: 800, cursor: 'pointer',
                    width: '100%'
                  }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
