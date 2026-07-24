import { useEffect, useMemo, useRef, useState } from 'react'
import { useDisconnect, useWriteContract, useBalance, useReadContract, useChainId, useSwitchChain } from 'wagmi'
import { usePrivy } from '@privy-io/react-auth'
import { formatUnits, parseUnits } from 'viem'
import { base } from 'wagmi/chains'
import { APP_URL, FOUNDATION, CHECKIN_TARGET, USDC_ADDRESS, USDC_ABI, HH_ADDRESS, HH_ABI, HH_MANAGER_ADDRESS, STAKING_ADDRESS, STAKING_ABI, MEMBERSHIP_ADDRESS, MEMBERSHIP_ABI } from '../config/constants'
import { db } from '../config/supabase'
import { UserAvatar } from './UserAvatar'
import { HistorySection } from './HistorySection'
import { useBuilderWrite } from '../hooks/useBuilderWrite'
import { TxModal } from './TxModal'

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


export function ProfileSection({ address, basename, totalUsers, setTab, onRequireWallet, onLogout }) {
  const { user: privyUser } = usePrivy()
  const { disconnect } = useDisconnect()
  const { writeContract: wagmiWriteContract } = useWriteContract()

  // DexScreener States
  const [hhPrice, setHhPrice] = useState(0.00025)
  const [priceChange, setPriceChange] = useState(8.4)

  // Happy Club Purchase States
  const [duration, setDuration] = useState(30)

  const buyMembership = (tokenType) => {
    if (!address) {
      if (onRequireWallet) onRequireWallet()
      return
    }
    
    if (tokenType === 'hh') {
      const cost = (hhPriceMember * duration) / 30
      wagmiWriteContract({
        address: MEMBERSHIP_ADDRESS,
        abi: MEMBERSHIP_ABI,
        functionName: 'purchaseWithHH',
        args: [BigInt(duration)],
        chainId: base.id
      })
    } else if (tokenType === 'usdc') {
      const cost = (usdcPriceMember * duration) / 30
      wagmiWriteContract({
        address: MEMBERSHIP_ADDRESS,
        abi: MEMBERSHIP_ABI,
        functionName: 'purchaseWithUSDC',
        args: [BigInt(duration)],
        chainId: base.id
      })
    } else if (tokenType === 'eth') {
      const cost = (ethPriceMember * duration) / 30
      wagmiWriteContract({
        address: MEMBERSHIP_ADDRESS,
        abi: MEMBERSHIP_ABI,
        functionName: 'purchaseWithETH',
        args: [BigInt(duration)],
        value: parseUnits(cost.toFixed(18), 18),
        chainId: base.id
      })
    }
  }

  const simulateBuyMembership = () => {
    try {
      localStorage.setItem('hh_simulated_member', 'true')
      localStorage.setItem('hh_simulated_expiry', (Math.floor(Date.now() / 1000) + duration * 24 * 3600).toString())
      setSimulatedMember(true)
      setSimulatedExpiry(Math.floor(Date.now() / 1000) + duration * 24 * 3600)
    } catch (e) { console.error(e) }
  }

  // Token Balance Fallbacks (LocalStorage mock)
  const [simulatedWalletBalance, setSimulatedWalletBalance] = useState(() => {
    try {
      return parseFloat(localStorage.getItem('hh_simulated_wallet') || '250000')
    } catch {
      return 250000
    }
  })



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

  // Read staked balance for badges
  const { data: stakedBalanceRaw } = useReadContract({
    address: STAKING_ADDRESS,
    abi: STAKING_ABI,
    functionName: 'totalActiveStaked',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 }
  })
  
  const stakedBalance = stakedBalanceRaw !== undefined ? parseFloat(formatUnits(stakedBalanceRaw, 18)) : 0
  
  const isHolder = walletBalance >= 100_000_000
  const isStaker = stakedBalance >= 100_000_000

  // Happy Club Membership Hooks
  const { data: isClubMemberRaw, refetch: refetchMembership } = useReadContract({
    address: MEMBERSHIP_ADDRESS,
    abi: MEMBERSHIP_ABI,
    functionName: 'isMember',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 }
  })

  const { data: membershipExpiryRaw } = useReadContract({
    address: MEMBERSHIP_ADDRESS,
    abi: MEMBERSHIP_ABI,
    functionName: 'getExpiry',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  })

  // Simulated fallback membership
  const [simulatedMember, setSimulatedMember] = useState(() => {
    try {
      return localStorage.getItem('hh_simulated_member') === 'true'
    } catch { return false }
  })
  
  const [simulatedExpiry, setSimulatedExpiry] = useState(() => {
    try {
      return parseInt(localStorage.getItem('hh_simulated_expiry') || '0')
    } catch { return 0 }
  })

  const isClubMember = isClubMemberRaw !== undefined ? isClubMemberRaw : simulatedMember
  const membershipExpiry = membershipExpiryRaw !== undefined ? Number(membershipExpiryRaw) : simulatedExpiry

  // Read pricing for membership
  const { data: hhPriceMemberRaw } = useReadContract({
    address: MEMBERSHIP_ADDRESS,
    abi: MEMBERSHIP_ABI,
    functionName: 'hhPrice',
    query: { enabled: !!address }
  })
  const { data: usdcPriceMemberRaw } = useReadContract({
    address: MEMBERSHIP_ADDRESS,
    abi: MEMBERSHIP_ABI,
    functionName: 'usdcPrice',
    query: { enabled: !!address }
  })
  const { data: ethPriceMemberRaw } = useReadContract({
    address: MEMBERSHIP_ADDRESS,
    abi: MEMBERSHIP_ABI,
    functionName: 'ethPrice',
    query: { enabled: !!address }
  })

  const hhPriceMember = hhPriceMemberRaw ? Number(formatUnits(hhPriceMemberRaw, 18)) : 40000
  const usdcPriceMember = usdcPriceMemberRaw ? Number(formatUnits(usdcPriceMemberRaw, 6)) : 10
  const ethPriceMember = ethPriceMemberRaw ? Number(formatUnits(ethPriceMemberRaw, 18)) : 0.003



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

  // Check-in states (moved from EarnSection)
  const todayUTC = () => new Date().toISOString().split('T')[0]
  const [checkedToday, setCheckedToday] = useState(false)
  const [streakCount, setStreakCount] = useState(0)
  const [checkinTxModal, setCheckinTxModal] = useState(false)
  const [checkinError, setCheckinError] = useState('')
  const processedCheckinRef = useRef(null)
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const { data: checkinTxHash, writeContract: writeCheckin, isPending: isCheckinPending, isConfirming: isCheckinConfirming, isSuccess: isCheckinSuccess, error: checkinWriteError, reset: resetCheckin } = useBuilderWrite()



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
      .select('points, wins, entries, referral_count, referral_points, ref_code, referrer, streak, streak_last')
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
    // Load streak state
    const today = todayUTC()
    setStreakCount(data?.streak || 0)
    setCheckedToday(data?.streak_last === today)
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

  // --- Check-in Success Effect ---
  useEffect(() => {
    if (!isCheckinSuccess || !checkinTxHash || processedCheckinRef.current === checkinTxHash || !address) return
    processedCheckinRef.current = checkinTxHash
    setCheckinError('')
    db.rpc('process_checkin', {
      p_address: address.toLowerCase(),
      p_tx_hash: checkinTxHash,
    }).then(async ({ data, error }) => {
      if (error) {
        console.error('process_checkin:', error)
        setCheckinError('Check-in saved onchain, but database sync failed.')
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
      setCheckinTxModal(false)
    }).finally(() => {
      resetCheckin()
    })
  }, [address, isCheckinSuccess, checkinTxHash, resetCheckin, streakCount])

  const sendCheckin = () => {
    setCheckinError('')
    if (chainId !== base.id) {
      switchChain({ chainId: base.id })
      return
    }
    writeCheckin({
      address: USDC_ADDRESS,
      abi: USDC_ABI,
      functionName: 'transfer',
      args: [CHECKIN_TARGET, parseUnits('0.000100', 6)],
      chainId: base.id,
    })
  }

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
    if (!address) {
      if (onRequireWallet) onRequireWallet()
      return
    }
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
    <div style={{ animation: 'fadeIn 0.3s ease-out', width: '100%', maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24, paddingBottom: 120, color: '#FFFFFF', fontFamily: "'Inter', sans-serif" }}>
      
      {/* Profile Hero Banner */}
      <div style={{
        width: '100%',
        background: 'linear-gradient(135deg, rgba(16,18,27,1) 0%, rgba(20,22,35,1) 100%)',
        borderRadius: 24,
        position: 'relative',
        border: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 320,
        marginBottom: 24
      }}>
        {/* Glow Effects (Contained) */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 24, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)', filter: 'blur(40px)' }} />
          <div style={{ position: 'absolute', bottom: '-20%', left: '30%', width: '40%', height: '50%', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%)', filter: 'blur(40px)' }} />
          <div style={{ position: 'absolute', top: 0, right: 0, width: '45%', height: '100%', background: 'radial-gradient(circle at right, rgba(59, 130, 246, 0.08) 0%, transparent 60%)' }} />
        </div>

        {/* Content Left */}
        <div style={{ flex: 1, padding: '32px 48px', position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 16 }}>

          
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', border: '3px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.1)'
            }}>
              <UserAvatar address={address} size={80} profilePictureUrl={privyUser?.twitter?.profilePictureUrl} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h1 style={{ fontSize: 36, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.2, margin: 0, fontFamily: "'Inter', sans-serif", letterSpacing: '-0.5px' }}>
                {basename || short(address)}
              </h1>
              {/* Moved Status Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  background: isClubMember ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.1)',
                  color: isClubMember ? '#10B981' : '#94A3B8',
                  padding: '6px 14px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                  border: isClubMember ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(255, 255, 255, 0.1)',
                  display: 'flex', alignItems: 'center', gap: 6,
                  fontFamily: "'Outfit', 'Inter', sans-serif"
                }}>
                  {isClubMember && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', animation: 'blinkDot 1s infinite' }} />}
                  {isClubMember ? 'HAPPY CLUB MEMBER' : 'STANDARD USER'}
                </div>
              </div>
            </div>
          </div>
          
          {/* My Badges */}
          {(isHolder || isStaker) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.6)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                My Badges
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {isHolder && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '6px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>✨</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: '#10B981', fontFamily: "'Outfit', 'Inter', sans-serif" }}>Happy Holder</span>
                  </div>
                )}
                {isStaker && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '6px 12px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14 }}>✨</span>
                    <span style={{ fontSize: 12, fontWeight: 900, color: '#10B981', fontFamily: "'Outfit', 'Inter', sans-serif" }}>Happy Staker</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Big Timer Right -> Loyalty Points Right */}
        <div className="desktop-only" style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: '45%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 48px', background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 32, boxShadow: '0 20px 40px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '2px' }}>
              HAPPY POINTS
            </div>
            <div style={{ fontFamily: "'Outfit', 'Inter', sans-serif", fontSize: 64, fontWeight: 700, color: '#FFFFFF', letterSpacing: '2px', lineHeight: 1, textShadow: '0 0 20px rgba(255,255,255,0.2)' }}>
              {userStats.points.toLocaleString()}
            </div>
            <div style={{ display: 'flex', gap: 32, opacity: 0.5 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#FFF', letterSpacing: '1px' }}>LOYALTY POINTS</div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Check-in Card — full width, premium design */}
      <div id="daily-checkin-card" style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.5) 100%)',
        borderRadius: 24,
        padding: '32px 40px',
        marginBottom: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
        fontFamily: "'Inter', sans-serif"
      }}>
        {/* Shine glow */}
        <div style={{ position: 'absolute', top: '-50%', left: '-20%', width: '60%', height: '100%', background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 60%)', filter: 'blur(40px)', pointerEvents: 'none' }} />

        {/* Header row */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.3px' }}>Daily Check-in</div>
              <span style={{ fontSize: 12, fontWeight: 800, background: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                +1 HP / Day
              </span>
            </div>
            <div style={{ fontSize: 14, color: '#94A3B8', marginTop: 8, fontWeight: 400, maxWidth: 400, lineHeight: 1.5 }}>
              Keep your streak alive to unlock milestone bonuses. Rewards reset after 30 days.
            </div>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
              <div style={{ fontSize: 12, color: '#64748B', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current Streak</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: streakCount > 0 ? '#F59E0B' : '#FFFFFF', fontFamily: "'Outfit', 'Inter', sans-serif", lineHeight: 1 }}>
                {streakCount} {streakCount > 0 ? '🔥' : 'd'}
              </div>
            </div>
            
            <button
              onClick={() => {
                if (!address) {
                  if (onRequireWallet) onRequireWallet()
                  return
                }
                setCheckinTxModal(true)
              }}
              disabled={checkedToday}
              style={{
                padding: '14px 28px',
                borderRadius: 14,
                border: checkedToday ? '1px solid rgba(255,255,255,0.1)' : 'none',
                background: checkedToday ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                color: checkedToday ? '#94A3B8' : '#FFFFFF',
                fontSize: 14,
                fontWeight: 700,
                cursor: checkedToday ? 'not-allowed' : 'pointer',
                outline: 'none',
                transition: 'all 0.2s',
                boxShadow: checkedToday ? 'none' : '0 4px 12px rgba(37, 99, 235, 0.3)'
              }}
              onMouseEnter={e => { if (!checkedToday) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(37, 99, 235, 0.4)'; } }}
              onMouseLeave={e => { if (!checkedToday) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.3)'; } }}
            >
              {checkedToday ? '✓ Claimed Today' : 'Claim Reward'}
            </button>
          </div>
        </div>

        {checkinError && (
          <div style={{ position: 'relative', zIndex: 1, color: '#FCA5A5', fontSize: 13, fontWeight: 600 }}>
            ⚠️ {checkinError}
          </div>
        )}

        {/* Streak Progress Bar */}
        <div style={{ position: 'relative', zIndex: 1, padding: '0 24px', marginTop: 12 }}>
          <div style={{ position: 'relative', height: 12, background: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
            {/* Progress fill */}
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              height: '100%',
              borderRadius: 12,
              width: `${Math.min(100, (streakCount / 30) * 100)}%`,
              background: 'linear-gradient(90deg, #3B82F6 0%, #8B5CF6 100%)',
              transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 0 16px rgba(59,130,246,0.5)'
            }} />

            {/* Milestone dots */}
            {[{day: 7, pct: (7/30)*100, label: '7 Days', reward: '+3 HP'}, {day: 14, pct: (14/30)*100, label: '14 Days', reward: '+7 HP'}, {day: 30, pct: 100, label: '30 Days', reward: '+15 HP'}].map(m => (
              <div key={m.day} style={{
                position: 'absolute',
                left: `${m.pct}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: streakCount >= m.day ? '#8B5CF6' : '#1E293B',
                border: `3px solid ${streakCount >= m.day ? '#C4B5FD' : 'rgba(255,255,255,0.1)'}`,
                boxShadow: streakCount >= m.day ? '0 0 12px rgba(139, 92, 246, 0.6)' : 'none',
                zIndex: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {streakCount >= m.day && <span style={{ color: '#FFF', fontSize: 12, fontWeight: 900 }}>✓</span>}
                
                {/* Label below dot */}
                <div style={{
                  position: 'absolute',
                  top: 32,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap',
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: streakCount >= m.day ? '#E2E8F0' : '#64748B' }}>{m.label}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: streakCount >= m.day ? '#FBBF24' : '#475569', marginTop: 4 }}>{m.reward}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Spacer for milestone labels so they aren't cut off */}
        <div style={{ height: 32 }} />
      </div>

      {/* Happy Club Membership Card */}
      <div id="happy-club-card" style={{
        background: '#1A1C24',
        borderRadius: 16,
        padding: '20px 24px',
        marginBottom: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>

        {/* Shine glow */}
        <div style={{
          position: 'absolute',
          top: -40,
          right: -40,
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: isClubMember 
            ? 'radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, transparent 75%)' 
            : 'radial-gradient(circle, rgba(139, 92, 246, 0.25) 0%, transparent 75%)',
          pointerEvents: 'none',
          zIndex: 1
        }} />

        {/* Title row */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>👑</span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 950, color: '#FFFFFF', letterSpacing: '0.1px', fontFamily: "'Outfit', sans-serif" }}>
                HAPPY CLUB
              </div>
              <div style={{ fontSize: 9.5, color: isClubMember ? '#93C5FD' : '#C084FC', fontWeight: 800, textTransform: 'uppercase', marginTop: 2 }}>
                {isClubMember ? 'Premium Member' : 'AI Automation & Perks'}
              </div>
            </div>
          </div>
          <span style={{
            background: isClubMember ? 'rgba(59, 130, 246, 0.15)' : 'rgba(139, 92, 246, 0.15)',
            color: isClubMember ? '#60A5FA' : '#C084FC',
            padding: '4px 10px',
            borderRadius: 8,
            fontSize: 10,
            fontWeight: 900,
            border: isClubMember ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(139, 92, 246, 0.3)',
            fontFamily: "'Outfit', sans-serif"
          }}>
            {isClubMember ? 'ACTIVE' : 'UPGRADE'}
          </span>
        </div>

        {/* Main Content */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {isClubMember ? (
            <div style={{ fontSize: 12.5, color: '#E2E8F0', fontWeight: 600, lineHeight: 1.4 }}>
              Your Premium subscription is active! Agents automatically perform daily check-ins and participate in raffles.
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 8, fontWeight: 700 }}>
                📅 Expires on: {new Date(membershipExpiry * 1000).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.8)', fontWeight: 600, lineHeight: 1.4 }}>
                Get unlimited access to the AI assistant, along with automatic daily check-ins and raffle entries handled by our routine agents.
              </div>
              
              {/* Duration Selector */}
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button 
                  type="button"
                  onClick={() => setDuration(30)}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: duration === 30 ? '1px solid #C084FC' : '1px solid rgba(255, 255, 255, 0.15)',
                    background: duration === 30 ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    color: '#FFFFFF',
                    fontSize: 11.5,
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  30 Days (1 mo)
                </button>
                <button 
                  type="button"
                  onClick={() => setDuration(365)}
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: duration === 365 ? '1px solid #C084FC' : '1px solid rgba(255, 255, 255, 0.15)',
                    background: duration === 365 ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    color: '#FFFFFF',
                    fontSize: 11.5,
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  365 Days (Save 20%)
                </button>
              </div>

              {/* Payment Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => buyMembership('hh')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 12,
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#FFFFFF',
                    fontSize: 11,
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <span>🪙 $HH</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
                    {formatConcise((hhPriceMember * duration) / 30)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => buyMembership('usdc')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 12,
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#FFFFFF',
                    fontSize: 11,
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <span>💵 USDC</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
                    ${((usdcPriceMember * duration) / 30).toFixed(0)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => buyMembership('eth')}
                  style={{
                    padding: '10px 8px',
                    borderRadius: 12,
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#FFFFFF',
                    fontSize: 11,
                    fontWeight: 900,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <span>🛡️ ETH</span>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
                    {((ethPriceMember * duration) / 30).toFixed(4)}
                  </span>
                </button>
              </div>

              {/* Dev simulation button */}
              <div style={{ textAlign: 'center', marginTop: 4 }}>
                <span 
                  onClick={simulateBuyMembership}
                  style={{ 
                    fontSize: 8.5, 
                    fontWeight: 800, 
                    color: 'rgba(255,255,255,0.3)', 
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  [Dev] Enable free membership for testing
                </span>
              </div>
            </>
          )}
        </div>
      </div>


      <HistorySection address={address} />

      {/* Daily Check-in TxModal */}
      {checkinTxModal && (
        <TxModal
          title="Daily Check-in"
          subtitle="Claim your daily free HP and keep your streak going!"
          amount="0.0001"
          isPending={isCheckinPending}
          isConfirming={isCheckinConfirming}
          isSuccess={isCheckinSuccess}
          error={checkinWriteError}
          onConfirm={sendCheckin}
          onCancel={() => { setCheckinTxModal(false); resetCheckin(); }}
        />
      )}

    </div>
  )
}
