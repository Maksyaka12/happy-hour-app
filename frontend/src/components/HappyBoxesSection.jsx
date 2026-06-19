import React, { useState, useEffect } from 'react'
import { useChainId, useSwitchChain, useReadContract } from 'wagmi'
import { parseUnits, formatUnits } from 'viem'
import { base } from 'wagmi/chains'
import { CHECKIN_TARGET, USDC_ADDRESS, USDC_ABI, HH_ADDRESS, HH_ABI, HH_MANAGER_ADDRESS } from '../config/constants'
import { db } from '../config/supabase'
import { useBuilderWrite } from '../hooks/useBuilderWrite'
import { TxModal } from './TxModal'

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

export function HappyBoxesSection({ address, onUpdate, setTab }) {
  // State for the 6 chest cells
  const [chests, setChests] = useState([
    { id: 1, status: 'locked', hp: null, mult: null },
    { id: 2, status: 'locked', hp: null, mult: null },
    { id: 3, status: 'locked', hp: null, mult: null },
    { id: 4, status: 'locked', hp: null, mult: null },
    { id: 5, status: 'locked', hp: null, mult: null },
    { id: 6, status: 'locked', hp: null, mult: null },
  ])

  // Color logic for multiplier badges
  const getOpenedCardDetails = (mult) => {
    const m = parseFloat(mult) || 1.0
    if (m >= 2.0) {
      return {
        badgeBg: 'linear-gradient(135deg, #10B981, #059669)', // green
        badgeColor: '#FFFFFF',
        badgeText: `⚡ ${m}x`
      }
    }
    if (m > 1.0) {
      return {
        badgeBg: 'linear-gradient(135deg, #F59E0B, #D97706)', // orange/amber
        badgeColor: '#FFFFFF',
        badgeText: `⚡ ${m}x`
      }
    }
    return {
      badgeBg: 'linear-gradient(135deg, #6B7280, #4B5563)', // gray
      badgeColor: '#FFFFFF',
      badgeText: `⚡ 1x`
    }
  }

  const [hasActiveChoice, setHasActiveChoice] = useState(false)
  const [activeTxHash, setActiveTxHash] = useState(null)
  const [txModal, setTxModal] = useState(false) // 'single' | 'bundle' | false
  const [revealingIndex, setRevealingIndex] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [clickedBoxIndex, setClickedBoxIndex] = useState(null)

  const [dailyStats, setDailyStats] = useState({
    boxes_opened: 0,
    bonus_opens: 0,
    ap_burned: 0,
    score: 0
  })

  const [paymentCurrency, setPaymentCurrency] = useState('USDC')
  const [hhPrice, setHhPrice] = useState(0.00025)
  const [isProcessingBuyAttempt, setIsProcessingBuyAttempt] = useState(false)

  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const wrongChain = chainId !== base.id

  // Separate write hooks for box opening and buying attempts
  const boxWrite = useBuilderWrite()
  const buyAttemptWrite = useBuilderWrite()

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
        console.error('DexScreener API error in HappyBoxes:', err)
      }
    }
    getPrice()
    const interval = setInterval(getPrice, 30000)
    return () => clearInterval(interval)
  }, [])

  // Read allowance
  const { data: allowanceRaw } = useReadContract({
    address: HH_ADDRESS,
    abi: HH_ABI,
    functionName: 'allowance',
    args: address && HH_MANAGER_ADDRESS ? [address, HH_MANAGER_ADDRESS] : undefined,
    query: { enabled: !!address, refetchInterval: 10000 }
  })
  
  const currentAllowance = allowanceRaw !== undefined
    ? parseFloat(formatUnits(allowanceRaw, 18))
    : 0

  const loadDailyStats = async () => {
    if (!address) return
    const todayStr = new Date().toISOString().split('T')[0]
    const { data, error } = await db
      .from('daily_stats')
      .select('boxes_opened, bonus_opens, ap_burned, score')
      .eq('address', address.toLowerCase())
      .eq('day', todayStr)
      .maybeSingle()

    if (!error && data) {
      setDailyStats({
        boxes_opened: data.boxes_opened || 0,
        bonus_opens: data.bonus_opens || 0,
        ap_burned: data.ap_burned || 0,
        score: data.score || 0
      })
    } else {
      setDailyStats({
        boxes_opened: 0,
        bonus_opens: 0,
        ap_burned: 0,
        score: 0
      })
    }
  }

  useEffect(() => {
    loadDailyStats()
  }, [address])

  const maxDailyOpens = 12 + dailyStats.bonus_opens
  const remainingOpens = Math.max(0, maxDailyOpens - dailyStats.boxes_opened)

  // Recovery of pending choice across tab unmounts
  useEffect(() => {
    const pendingHash = localStorage.getItem('happy_boxes_pending')
    if (pendingHash) {
      setActiveTxHash(pendingHash)
      setHasActiveChoice(true)
      
      const savedBoard = localStorage.getItem('happy_boxes_board')
      if (savedBoard) {
        try {
          const parsed = JSON.parse(savedBoard)
          if (Array.isArray(parsed) && parsed.length === 6) {
            setChests(parsed.map(c => c.status === 'locked' ? { ...c, status: 'active' } : c))
            return
          }
        } catch (e) {
          console.error('Failed to parse saved board:', e)
        }
      }
      setChests(prev => prev.map(c => c.status === 'locked' ? { ...c, status: 'active' } : c))
    } else {
      localStorage.removeItem('happy_boxes_board')
    }
  }, [])

  // Persist board state to localStorage whenever chests change
  useEffect(() => {
    const hasOpenOrActive = chests.some(c => c.status === 'opened' || c.status === 'active')
    if (hasOpenOrActive) {
      localStorage.setItem('happy_boxes_board', JSON.stringify(chests))
    }
  }, [chests])

  // Reset the grid board to start fresh
  const handleResetBoard = () => {
    localStorage.removeItem('happy_boxes_pending')
    localStorage.removeItem('happy_boxes_board')
    setChests([
      { id: 1, status: 'locked', hp: null, mult: null },
      { id: 2, status: 'locked', hp: null, mult: null },
      { id: 3, status: 'locked', hp: null, mult: null },
      { id: 4, status: 'locked', hp: null, mult: null },
      { id: 5, status: 'locked', hp: null, mult: null },
      { id: 6, status: 'locked', hp: null, mult: null },
    ])
    setHasActiveChoice(false)
    setActiveTxHash(null)
    setRevealingIndex(null)
    setClickedBoxIndex(null)
    setErrorMessage('')
    boxWrite.reset()
    buyAttemptWrite.reset()
  }

  // Watch for buy attempt transaction success
  useEffect(() => {
    if (buyAttemptWrite.isSuccess && buyAttemptWrite.data && !isProcessingBuyAttempt) {
      const hhAmount = 0.10 / hhPrice
      if (currentAllowance < hhAmount) {
        // This was approval tx. Just reset and return.
        buyAttemptWrite.reset()
        return
      }
      handleRegisterBuyAttempt(buyAttemptWrite.data)
    }
  }, [buyAttemptWrite.isSuccess, buyAttemptWrite.data, currentAllowance, hhPrice])

  const handleRegisterBuyAttempt = async (hash) => {
    setIsProcessingBuyAttempt(true)
    const hhAmount = 0.10 / hhPrice
    try {
      const { data, error } = await db.rpc('burn_hh_for_boxes', {
        p_address: address.toLowerCase(),
        p_tx_hash: hash,
        p_amount: hhAmount
      })
      if (error) throw error
      if (data?.ok) {
        await loadDailyStats()
        if (onUpdate) onUpdate()
        buyAttemptWrite.reset()
      } else {
        setErrorMessage(data?.error || 'Failed to register extra attempt.')
      }
    } catch (e) {
      console.error(e)
      setErrorMessage('Failed to register extra attempt in database.')
    } finally {
      setIsProcessingBuyAttempt(false)
    }
  }

  const handleBuyAttempt = () => {
    if (wrongChain) { switchChain({ chainId: base.id }); return }
    setErrorMessage('')
    
    const hhAmount = 0.10 / hhPrice
    if (currentAllowance < hhAmount) {
      buyAttemptWrite.writeContract({
        address: HH_ADDRESS,
        abi: HH_ABI,
        functionName: 'approve',
        args: [HH_MANAGER_ADDRESS, 115792089237316195423570985008687907853269984665640564039457584007913129639935n], // max uint256
        chainId: base.id
      })
    } else {
      buyAttemptWrite.writeContract({
        address: HH_MANAGER_ADDRESS,
        abi: [
          {
            name: 'burnHHForBoxes',
            type: 'function',
            inputs: [{ name: '_amount', type: 'uint256' }],
            outputs: [],
            stateMutability: 'nonpayable',
          }
        ],
        functionName: 'burnHHForBoxes',
        args: [parseUnits(hhAmount.toFixed(18), 18)],
        chainId: base.id
      })
    }
  }

  // Handle successful box transactions
  useEffect(() => {
    if (boxWrite.isSuccess && boxWrite.data) {
      if (paymentCurrency === 'HH') {
        const hhAmount = txModal === 'bundle' ? (1.00 / hhPrice) : (0.20 / hhPrice)
        if (currentAllowance < hhAmount) {
          // This was approval tx. Reset and return.
          boxWrite.reset()
          return
        }
      }

      const txHash = boxWrite.data
      const currentTxModal = txModal
      const currentClickedBoxIndex = clickedBoxIndex

      // Close the modal immediately so it doesn't get stuck or revert to confirm state
      setTxModal(false)

      if (currentTxModal === 'bundle') {
        handleOpenAllChests(txHash)
      } else if (currentTxModal === 'single') {
        if (currentClickedBoxIndex !== null) {
          handleSelectChest(currentClickedBoxIndex, txHash)
        } else {
          // Clicked bottom button: activate board so they can pick any chest
          setActiveTxHash(txHash)
          setHasActiveChoice(true)
          setChests(prev => prev.map(c => c.status === 'locked' ? { ...c, status: 'active' } : c))
          localStorage.setItem('happy_boxes_pending', txHash)
          boxWrite.reset()
        }
      }
    }
  }, [boxWrite.isSuccess, boxWrite.data, txModal, clickedBoxIndex, paymentCurrency, currentAllowance, hhPrice])

  // Single chest transaction confirm
  const handleSinglePayment = () => {
    if (wrongChain) { switchChain({ chainId: base.id }); return }
    setErrorMessage('')
    
    if (paymentCurrency === 'HH') {
      const hhAmount = 0.20 / hhPrice
      if (currentAllowance < hhAmount) {
        boxWrite.writeContract({
          address: HH_ADDRESS,
          abi: HH_ABI,
          functionName: 'approve',
          args: [HH_MANAGER_ADDRESS, 115792089237316195423570985008687907853269984665640564039457584007913129639935n], // max uint256
          chainId: base.id
        })
      } else {
        boxWrite.writeContract({
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
          args: [parseUnits(hhAmount.toFixed(18), 18), 'box_open'],
          chainId: base.id
        })
      }
    } else {
      boxWrite.writeContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [CHECKIN_TARGET, parseUnits('0.30', 6)],
        chainId: base.id
      })
    }
  }

  // Bundle transaction confirm
  const handleBundlePayment = () => {
    if (wrongChain) { switchChain({ chainId: base.id }); return }
    setErrorMessage('')

    if (paymentCurrency === 'HH') {
      const hhAmount = 1.00 / hhPrice
      if (currentAllowance < hhAmount) {
        boxWrite.writeContract({
          address: HH_ADDRESS,
          abi: HH_ABI,
          functionName: 'approve',
          args: [HH_MANAGER_ADDRESS, 115792089237316195423570985008687907853269984665640564039457584007913129639935n], // max uint256
          chainId: base.id
        })
      } else {
        boxWrite.writeContract({
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
          args: [parseUnits(hhAmount.toFixed(18), 18), 'box_bundle'],
          chainId: base.id
        })
      }
    } else {
      boxWrite.writeContract({
        address: USDC_ADDRESS,
        abi: USDC_ABI,
        functionName: 'transfer',
        args: [CHECKIN_TARGET, parseUnits('1.50', 6)],
        chainId: base.id
      })
    }
  }

  // User selects an active chest to open
  async function handleSelectChest(index, hash = null) {
    const txHashToUse = hash || activeTxHash
    if (!txHashToUse) return
    if (!hash && (!hasActiveChoice || chests[index].status !== 'active')) return

    setRevealingIndex(index)
    setHasActiveChoice(false)
    localStorage.removeItem('happy_boxes_pending')

    try {
      const rpcName = paymentCurrency === 'HH' ? 'open_standard_chest_hh' : 'open_standard_chest'
      const { data, error } = await db.rpc(rpcName, {
        p_address: address.toLowerCase(),
        p_tx_hash: txHashToUse
      })

      if (error) throw error

      if (data?.ok) {
        setChests(prev => {
          const nextChests = prev.map((c, i) => i === index 
            ? { ...c, status: 'opened', hp: data.hp_won, mult: data.applied_multiplier } 
            : { ...c, status: c.status === 'active' ? 'locked' : c.status }
          )
          
          const allOpen = nextChests.every(c => c.status === 'opened')
          if (allOpen) {
            setTimeout(() => {
              handleResetBoard()
            }, 2500)
          }
          
          return nextChests
        })
        if (onUpdate) onUpdate()
        loadDailyStats()
      } else {
        setErrorMessage(data?.error || 'Failed to open box')
        setChests(prev => prev.map(c => c.status === 'active' ? { ...c, status: 'locked' } : c))
      }
    } catch (err) {
      console.error(err)
      setErrorMessage('Something went wrong opening the box.')
      setChests(prev => prev.map(c => c.status === 'active' ? { ...c, status: 'locked' } : c))
    } finally {
      setRevealingIndex(null)
      setActiveTxHash(null)
      setClickedBoxIndex(null)
      boxWrite.reset()
    }
  }

  // Open all 6 chests automatically with bundle transaction
  const handleOpenAllChests = async (hash) => {
    setErrorMessage('')
    setRevealingIndex('all')

    try {
      const rpcName = paymentCurrency === 'HH' ? 'open_all_chests_hh' : 'open_all_chests'
      const { data, error } = await db.rpc(rpcName, {
        p_address: address.toLowerCase(),
        p_tx_hash: hash
      })

      if (error) throw error

      if (data?.ok && data.rewards) {
        const rewards = data.rewards
        const newChests = [...chests]
        
        for (let i = 0; i < 6; i++) {
          const rewardObj = rewards.find(r => r.index === i + 1)
          newChests[i] = {
            id: i + 1,
            status: 'opened',
            hp: rewardObj ? rewardObj.hp_won : 0,
            mult: rewardObj ? rewardObj.applied_multiplier : 1.0
          }
          await new Promise(r => setTimeout(r, 120))
          setChests([...newChests])
        }

        if (onUpdate) onUpdate()
        loadDailyStats()

        setTimeout(() => {
          handleResetBoard()
        }, 2500)
      } else {
        setErrorMessage(data?.error || 'Failed to open all boxes')
      }
    } catch (err) {
      console.error(err)
      setErrorMessage('Something went wrong opening all boxes.')
    } finally {
      setRevealingIndex(null)
      boxWrite.reset()
    }
  }

  const allOpened = chests.every(c => c.status === 'opened')
  const anyOpened = chests.some(c => c.status === 'opened')
  const isBuyingAttemptLoading = buyAttemptWrite.isPending || buyAttemptWrite.isConfirming || isProcessingBuyAttempt

  return (
    <div style={{ padding: '0 16px 120px', animation: 'hbFadeIn 0.4s ease' }}>
      <style>{`
        @keyframes hbFadeIn { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes hbBob { 0%,100% { transform:translateY(0) scale(1); } 50% { transform:translateY(-4px) scale(1.03); } }
        @keyframes hbPulseGlow { 0%,100% { box-shadow: 0 0 12px rgba(167,139,250,0.15); } 50% { box-shadow: 0 0 24px rgba(167,139,250,0.4); } }
        @keyframes hbGiftFloat { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        @keyframes hbActivePulse { 
          0%, 100% { border-color: rgba(167, 139, 250, 0.5); box-shadow: 0 0 8px rgba(167, 139, 250, 0.2); } 
          50% { border-color: rgba(167, 139, 250, 0.9); box-shadow: 0 0 18px rgba(167, 139, 250, 0.45); } 
        }
        @keyframes hbBurnFlame {
          0%, 100% {
            box-shadow: 0 0 10px rgba(255, 61, 0, 0.6), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.15);
            border-color: rgba(245, 158, 11, 0.5);
          }
          50% {
            box-shadow: 0 0 25px rgba(255, 61, 0, 0.95), inset 0 1px 0 rgba(255,255,255,0.60), inset 0 -1px 0 rgba(0,0,0,0.15);
            border-color: rgba(239, 68, 68, 0.9);
            transform: scale(1.03);
          }
        }
        @keyframes flame-float {
          0%, 100% {
            transform: translateX(-50%) translateY(0px) scale(1.0) rotate(-0.5deg);
            opacity: 0.55;
            filter: blur(1.2px) drop-shadow(0 0 10px rgba(245, 158, 11, 0.4));
          }
          50% {
            transform: translateX(-50%) translateY(-6px) scale(1.06) rotate(1deg);
            opacity: 0.8;
            filter: blur(1.5px) drop-shadow(0 0 18px rgba(245, 158, 11, 0.7));
          }
        }
        .chest-slot { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); position: relative; }
        .chest-slot:hover { transform: translateY(-2px); }
        
        .card-inner {
          transform-style: preserve-3d;
          transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .card-inner.flipped {
          transform: rotateY(180deg);
        }
        .card-face {
          backface-visibility: hidden;
        }
      `}</style>

      {setTab && (
        <button
          onClick={() => setTab('earn')}
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            borderRadius: 100,
            padding: '6px 14px',
            fontSize: 11,
            fontWeight: 800,
            cursor: 'pointer',
            marginBottom: 12,
            outline: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
            color: '#0A0B0D',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-0.5px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'none'}
        >
          ← Back to Earn
        </button>
      )}

      {/* Wrong Chain Banner */}
      {wrongChain && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 14, padding: '10px 16px', marginBottom: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: '#D97706', fontWeight: 700 }}>⚠ Switch to Base Mainnet</span>
          <button onClick={() => switchChain({ chainId: base.id })} style={{ background: '#D97706', color: '#fff', borderRadius: 50, padding: '5px 14px', fontSize: 11, fontWeight: 800, border: 'none', cursor: 'pointer' }}>
            {isSwitching ? 'Switching…' : 'Switch'}
          </button>
        </div>
      )}

      {/* ═══ HERO BANNER ═══ */}
      <div style={{
        background: '#090514',
        borderRadius: 24,
        padding: '22px 20px',
        marginBottom: 16,
        position: 'relative',
        minHeight: 144,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        boxShadow: '0 8px 32px rgba(32,10,60,0.4)',
        overflow: 'hidden',
        border: '1px solid rgba(139,92,246,0.2)'
      }}>
        {/* Branded background banner in purple tones */}
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
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(9, 5, 20, 0.25) 0%, rgba(46, 16, 101, 0.75) 100%)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />

        {/* Glow overlay */}
        <div style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: '180px',
          height: '180px',
          background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)',
          zIndex: 0,
          pointerEvents: 'none'
        }} />

        {/* Floating gift background decorations */}
        {[
          { top: '-5px', left: '5%', size: 54, opacity: 0.14, r: '-12deg', blur: 0.5, dur: 4.2 },
          { top: '10px', right: '25%', size: 40, opacity: 0.11, r: '14deg', blur: 0, dur: 4.8 },
          { bottom: '5px', left: '40%', size: 48, opacity: 0.12, r: '22deg', blur: 1, dur: 5.4 },
          { bottom: '15px', right: '5%', size: 62, opacity: 0.16, r: '8deg', blur: 1.2, dur: 4.6 }
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
            animation: `hbGiftFloat ${s.dur}s ease-in-out infinite`,
          }}>
            <div style={{
              fontSize: `${s.size}px`,
              opacity: s.opacity,
              filter: s.blur > 0 ? `blur(${s.blur}px) drop-shadow(0 0 10px rgba(139,92,246,0.25))` : 'drop-shadow(0 0 10px rgba(139,92,246,0.25))',
              transform: `rotate(${s.r})`,
            }}>
              🎁
            </div>
          </div>
        ))}

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'flex-start' }}>
          <div style={{
            fontSize: '26px',
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '0.5px',
            marginBottom: '4px'
          }}>
            Happy Boxes
          </div>
          
          <div style={{
            fontSize: '11px',
            color: 'rgba(255,255,255,0.75)',
            marginTop: '8px',
            letterSpacing: '0.1px',
            fontWeight: 500,
            lineHeight: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '6px', color: '#A78BFA' }}>●</span>
              <span>Each box contains from 2 to 5 HP.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '6px', color: '#A78BFA' }}>●</span>
              <span>Each user can open up to 12 boxes per day.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '6px', color: '#A78BFA' }}>●</span>
              <span>Burn $HH to unlock extra openings.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ CARD 1: DAILY LIMITS ═══ */}
      <div style={{
        background: 'linear-gradient(145deg, rgba(20, 10, 40, 0.94) 0%, rgba(35, 15, 70, 0.90) 50%, rgba(10, 5, 25, 0.96) 100%)',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        border: '1px solid rgba(139, 92, 246, 0.25)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(20, 6, 40, 0.5), inset 0 1px 0 rgba(139, 92, 246, 0.10)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Shimmer accent */}
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(139, 92, 246, 0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Title + Indicator Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, color: '#FFFFFF', letterSpacing: '0.2px' }}>Daily Box Limits</div>
          </div>
          <div style={{ 
            background: remainingOpens === 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(139, 92, 246, 0.12)', 
            color: remainingOpens === 0 ? '#EF4444' : '#C084FC', 
            padding: '3px 10px', 
            borderRadius: 12, 
            fontSize: 11, 
            fontWeight: 800,
            border: `1px solid ${remainingOpens === 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(139, 92, 246, 0.25)'}`
          }}>
            {remainingOpens} / {maxDailyOpens} left
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ background: 'rgba(255,255,255,0.06)', height: 4, borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
          <div style={{
            background: remainingOpens === 0 
              ? '#EF4444' 
              : 'linear-gradient(90deg, #A78BFA 0%, #EC4899 100%)',
            height: '100%',
            width: `${(remainingOpens / maxDailyOpens) * 100}%`,
            transition: 'width 0.4s ease'
          }} />
        </div>

        {/* Info & Buy Button Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4, paddingTop: 4 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.95)', fontWeight: 500 }}>
              Burn <span style={{ color: '#FFD700', fontWeight: 900, textShadow: '0 0 8px rgba(255, 215, 0, 0.5)' }}>$HH</span> for extra attempts
            </span>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', fontWeight: 650 }}>Each burn grants +1 box opening</span>
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Floating fire emoji behind the button */}
            <div style={{
              position: 'absolute',
              bottom: '-12px', // aligns nicely with the bottom area
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              zIndex: 0,
              fontSize: '54px',
              lineHeight: 1,
              opacity: 0.65,
              filter: 'blur(1.2px) drop-shadow(0 0 10px rgba(245, 158, 11, 0.45))',
              animation: 'flame-float 2.4s ease-in-out infinite',
              userSelect: 'none'
            }}>
              🔥
            </div>

            <button
              onClick={handleBuyAttempt}
              disabled={isBuyingAttemptLoading}
              style={{
                position: 'relative',
                zIndex: 1,
                background: isBuyingAttemptLoading 
                  ? 'rgba(255, 255, 255, 0.08)' 
                  : 'rgba(255, 255, 255, 0.18)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255, 255, 255, 0.42)',
                color: '#FFF',
                borderRadius: 12,
                padding: '6px 14px',
                cursor: isBuyingAttemptLoading ? 'not-allowed' : 'pointer',
                boxShadow: '0 0 15px rgba(255, 61, 0, 0.45), inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -1px 0 rgba(0,0,0,0.15)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 110,
                outline: 'none',
                animation: isBuyingAttemptLoading ? 'none' : 'hbBurnFlame 1.8s infinite ease-in-out',
                transition: 'all 0.2s'
              }}
              onMouseEnter={e => {
                if (!isBuyingAttemptLoading) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.28)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.60)'
                  e.currentTarget.style.boxShadow = '0 0 25px rgba(255, 61, 0, 0.8), inset 0 1px 0 rgba(255,255,255,0.40), inset 0 -1px 0 rgba(0,0,0,0.15)'
                }
              }}
              onMouseLeave={e => {
                if (!isBuyingAttemptLoading) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.18)'
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.42)'
                  e.currentTarget.style.boxShadow = '0 0 15px rgba(255, 61, 0, 0.45), inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -1px 0 rgba(0,0,0,0.15)'
                }
              }}
            >
              {isBuyingAttemptLoading ? (
                <span style={{ fontSize: 10, fontWeight: 800 }}>Processing...</span>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 900 }}>{formatConcise(0.10 / hhPrice)}</span>
                    <img src="/logo.jfif" alt="HH" style={{ width: 10, height: 10, borderRadius: '50%', objectFit: 'cover' }} />
                  </div>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>
                    (≈$0.10)
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ═══ CARD 2: HAPPY BOXES ═══ */}
      <div style={{
        background: 'linear-gradient(145deg, rgba(12, 10, 45, 0.94) 0%, rgba(24, 18, 75, 0.90) 50%, rgba(6, 5, 25, 0.96) 100%)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(167, 139, 250, 0.25)',
        borderRadius: 20,
        padding: '16px 20px',
        boxShadow: '0 8px 32px rgba(15, 6, 45, 0.5), inset 0 1px 0 rgba(167, 139, 250, 0.10)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Shimmer accent */}
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(167, 139, 250, 0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

        {/* Card Header */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#FFFFFF' }}>Happy Boxes</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
            Open boxes to earn random HP rewards from 2 to 5.
          </div>
        </div>

        {/* Paid Active / State Banners */}
        {hasActiveChoice && (
          <div style={{
            background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
            color: '#fff',
            borderRadius: 14,
            padding: '10px 14px',
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 800,
            boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
            animation: 'hbFadeIn 0.3s ease, hbPulseGlow 2s infinite',
            position: 'relative',
            zIndex: 2
          }}>
            Paid! Tap any box to reveal!
          </div>
        )}

        {errorMessage && (
          <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 14, padding: '10px 14px', fontSize: 11, color: '#EF4444', fontWeight: 700, textAlign: 'center', position: 'relative', zIndex: 2 }}>
            ⚠️ {errorMessage}
          </div>
        )}

        {/* 3x2 Grid (Compact Boxes) */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          position: 'relative',
          zIndex: 2
        }}>
          {chests.map((chest, index) => {
            const isRevealing = revealingIndex === index || revealingIndex === 'all'
            const details = chest.status === 'opened' ? getOpenedCardDetails(chest.mult) : null
            const anyOpened = chests.some(c => c.status === 'opened')
            
            let imageFilter = 'drop-shadow(0 4px 8px rgba(139, 92, 246, 0.15))'
            let imageOpacity = 1

            if (chest.status === 'locked') {
              if (anyOpened) {
                imageFilter = 'blur(1px) grayscale(30%)'
                imageOpacity = 0.55
              } else {
                imageFilter = 'grayscale(50%) brightness(0.8)'
                imageOpacity = 0.25
              }
            }
            
            return (
              <div
                key={chest.id}
                onClick={() => {
                  if (chest.status === 'active') {
                    handleSelectChest(index)
                  } else if (chest.status === 'locked' && !hasActiveChoice && !allOpened && anyOpened) {
                    setClickedBoxIndex(index)
                    setPaymentCurrency('USDC')
                    setTxModal('single')
                  }
                }}
                className="chest-slot"
                style={{
                  aspectRatio: '1',
                  position: 'relative',
                  perspective: '1000px',
                  cursor: (chest.status === 'active' || (chest.status === 'locked' && !hasActiveChoice && !allOpened && anyOpened)) ? 'pointer' : 'default',
                  opacity: (hasActiveChoice && chest.status !== 'active' && chest.status !== 'opened') ? 0.45 : 1,
                }}
              >
                <div 
                  className={`card-inner ${chest.status === 'opened' ? 'flipped' : ''}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  {/* FRONT FACE */}
                  <div 
                    className="card-face card-front"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backfaceVisibility: 'hidden',
                      borderRadius: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      background: chest.status === 'active'
                        ? 'linear-gradient(135deg, rgba(167, 139, 250, 0.20) 0%, rgba(167, 139, 250, 0.05) 100%)'
                        : 'linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)',
                      border: chest.status === 'active'
                        ? '2px solid rgba(167, 139, 250, 0.8)'
                        : '1px dashed rgba(255, 255, 255, 0.15)',
                      boxShadow: chest.status === 'active'
                        ? '0 0 16px rgba(167, 139, 250, 0.35)'
                        : 'none',
                      animation: chest.status === 'active' ? 'hbBob 1.6s ease-in-out infinite, hbActivePulse 2s infinite' : 'none',
                      transform: chest.status === 'active' ? 'scale(1.01)' : 'none',
                      zIndex: 2
                    }}
                  >
                    {isRevealing ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{
                          width: 20, height: 20,
                          border: '2px solid rgba(255,255,255,0.1)',
                          borderTop: '2px solid #A78BFA',
                          borderRadius: '50%',
                          animation: 'spin 0.8s linear infinite'
                        }} />
                        <span style={{ fontSize: 7, fontWeight: 900, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: 0.5 }}>Opening...</span>
                      </div>
                    ) : (
                      <>
                        <img
                          src="/box2.png"
                          alt="Box"
                          style={{
                            width: '76%',
                            height: '76%',
                            objectFit: 'contain',
                            filter: imageFilter,
                            opacity: imageOpacity,
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          }}
                        />

                        {chest.status === 'locked' && !hasActiveChoice && anyOpened && (
                          <div style={{
                            position: 'absolute',
                            inset: 0,
                            background: 'rgba(5, 10, 20, 0.7)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 4,
                            borderRadius: 14,
                            zIndex: 10
                          }}>
                            <span style={{ fontSize: 9, fontWeight: 800, color: '#FFF' }}>Open</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(255,255,255,0.15)', padding: '2px 6px', borderRadius: 20 }}>
                              <span style={{ fontSize: 8, fontWeight: 900, color: '#A78BFA' }}>0.30</span>
                              <img src="/usdc-logo.png" alt="USDC" style={{ width: 8, height: 8 }} />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* BACK FACE */}
                  <div 
                    className="card-face card-back"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      backfaceVisibility: 'hidden',
                      borderRadius: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      transform: 'rotateY(180deg)',
                      background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.25) 0%, rgba(79, 70, 229, 0.15) 100%)',
                      border: '1px solid rgba(167, 139, 250, 0.4)',
                      boxShadow: '0 4px 16px rgba(167, 139, 250, 0.15)',
                      zIndex: 1
                    }}
                  >
                    {chest.status === 'opened' && details && (
                      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', position: 'relative' }}>
                        {/* Radial dots decoration */}
                        <div style={{
                          position: 'absolute',
                          inset: 0,
                          opacity: 0.08,
                          pointerEvents: 'none',
                          backgroundImage: 'radial-gradient(circle, #FFFFFF 1.2px, transparent 1.2px)',
                          backgroundSize: '10px 10px'
                        }} />

                        {/* Multiplier Badge */}
                        {chest.mult && parseFloat(chest.mult) > 1.0 && (
                          <div style={{
                            position: 'absolute',
                            top: 6,
                            background: details.badgeBg,
                            color: details.badgeColor,
                            padding: '1.5px 6px',
                            borderRadius: 20,
                            fontSize: 7,
                            fontWeight: 900,
                            letterSpacing: '0.1px',
                            textTransform: 'uppercase',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                          }}>
                            {details.badgeText}
                          </div>
                        )}

                        {/* HP amount */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, marginTop: 8 }}>
                          <div style={{
                            fontSize: 22,
                            fontWeight: 950,
                            fontFamily: "'Outfit', 'Inter', sans-serif",
                            letterSpacing: '-1px',
                            lineHeight: 1,
                            color: '#FFFFFF'
                          }}>
                            {chest.hp}
                          </div>
                          <div style={{
                            fontSize: 8,
                            fontWeight: 900,
                            color: '#A78BFA',
                            letterSpacing: '1px',
                            marginTop: 2,
                            textTransform: 'uppercase'
                          }}>
                            HP
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* 2x2 Buttons Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 12,
          marginTop: 8,
          position: 'relative',
          zIndex: 2
        }}>
          {/* Button 1: Single USDC (0.30 USDC) */}
          <button
            onClick={() => {
              setPaymentCurrency('USDC')
              setTxModal('single')
            }}
            disabled={boxWrite.isPending || boxWrite.isConfirming || hasActiveChoice || revealingIndex !== null || allOpened || remainingOpens === 0}
            style={{
              position: 'relative',
              background: 'rgba(255,255,255,0.20)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.42)',
              color: '#FFF',
              borderRadius: 14,
              padding: 0,
              height: 52,
              cursor: (boxWrite.isPending || boxWrite.isConfirming || hasActiveChoice || revealingIndex !== null || allOpened || remainingOpens === 0) ? 'not-allowed' : 'pointer',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -1px 0 rgba(0,0,0,0.15)',
              opacity: (boxWrite.isPending || boxWrite.isConfirming || hasActiveChoice || revealingIndex !== null || allOpened || remainingOpens === 0) ? 0.4 : 1,
              outline: 'none',
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch'
            }}
            onMouseEnter={e => {
              if (!(boxWrite.isPending || boxWrite.isConfirming || hasActiveChoice || revealingIndex !== null || allOpened || remainingOpens === 0)) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.30)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.60)'
              }
            }}
            onMouseLeave={e => {
              if (!(boxWrite.isPending || boxWrite.isConfirming || hasActiveChoice || revealingIndex !== null || allOpened || remainingOpens === 0)) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.20)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.42)'
              }
            }}
          >
            <div style={{
              background: 'rgba(255, 255, 255, 0.12)',
              height: '100%',
              minWidth: 54,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRight: '1px solid rgba(255, 255, 255, 0.20)',
              borderRadius: '13px 0 0 13px',
              fontSize: 20,
              fontWeight: 900,
              gap: 4
            }}>
              1 🎁
            </div>
            <div style={{
              flex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 10px',
              gap: 1
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3.5 }}>
                <span style={{ fontSize: 11.5, fontWeight: 900 }}>0.30</span>
                <img src="/usdc-logo.png" alt="USDC" style={{ width: 10, height: 10 }} />
              </div>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.48)', fontWeight: 600 }}>≈$0.30</span>
            </div>
          </button>

          {/* Button 2: Single $HH (0.20$ equivalent in HH, -33% Badge) */}
          <button
            onClick={() => {
              setPaymentCurrency('HH')
              setTxModal('single')
            }}
            disabled={boxWrite.isPending || boxWrite.isConfirming || hasActiveChoice || revealingIndex !== null || allOpened || remainingOpens === 0}
            style={{
              position: 'relative',
              background: 'rgba(255,255,255,0.20)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.42)',
              color: '#FFF',
              borderRadius: 14,
              padding: 0,
              height: 52,
              cursor: (boxWrite.isPending || boxWrite.isConfirming || hasActiveChoice || revealingIndex !== null || allOpened || remainingOpens === 0) ? 'not-allowed' : 'pointer',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -1px 0 rgba(0,0,0,0.15)',
              opacity: (boxWrite.isPending || boxWrite.isConfirming || hasActiveChoice || revealingIndex !== null || allOpened || remainingOpens === 0) ? 0.4 : 1,
              outline: 'none',
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch'
            }}
            onMouseEnter={e => {
              if (!(boxWrite.isPending || boxWrite.isConfirming || hasActiveChoice || revealingIndex !== null || allOpened || remainingOpens === 0)) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.30)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.60)'
              }
            }}
            onMouseLeave={e => {
              if (!(boxWrite.isPending || boxWrite.isConfirming || hasActiveChoice || revealingIndex !== null || allOpened || remainingOpens === 0)) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.20)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.42)'
              }
            }}
          >
            <span style={{
              position: 'absolute',
              top: -8,
              right: -3,
              background: 'linear-gradient(135deg, #EC4899 0%, #8B5CF6 100%)',
              color: '#FFFFFF',
              fontSize: 7.5,
              fontWeight: 900,
              padding: '1px 4px',
              borderRadius: 5,
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.25)',
              lineHeight: 1,
              letterSpacing: '0.2px',
              whiteSpace: 'nowrap',
              zIndex: 10
            }}>-33%</span>

            <div style={{
              background: 'rgba(255, 255, 255, 0.12)',
              height: '100%',
              minWidth: 54,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRight: '1px solid rgba(255, 255, 255, 0.20)',
              borderRadius: '13px 0 0 13px',
              fontSize: 20,
              fontWeight: 900,
              gap: 4
            }}>
              1 🎁
            </div>
            <div style={{
              flex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 10px',
              gap: 1
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3.5 }}>
                <span style={{ fontSize: 11.5, fontWeight: 900 }}>{formatConcise(0.20 / hhPrice)}</span>
                <img src="/logo.jfif" alt="$HH" style={{ width: 10, height: 10, borderRadius: '50%', objectFit: 'cover' }} />
              </div>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.48)', fontWeight: 600 }}>≈$0.20</span>
            </div>
          </button>

          {/* Button 3: Bundle USDC (1.50 USDC, "1 free box" Badge) */}
          <button
            onClick={() => {
              setPaymentCurrency('USDC')
              setTxModal('bundle')
            }}
            disabled={boxWrite.isPending || boxWrite.isConfirming || hasActiveChoice || revealingIndex !== null || anyOpened || allOpened || remainingOpens < 6}
            style={{
              position: 'relative',
              background: 'rgba(255,255,255,0.20)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.42)',
              color: '#FFF',
              borderRadius: 14,
              padding: 0,
              height: 52,
              cursor: (boxWrite.isPending || boxWrite.isConfirming || hasActiveChoice || revealingIndex !== null || anyOpened || allOpened || remainingOpens < 6) ? 'not-allowed' : 'pointer',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -1px 0 rgba(0,0,0,0.15)',
              opacity: (boxWrite.isPending || boxWrite.isConfirming || hasActiveChoice || revealingIndex !== null || anyOpened || allOpened || remainingOpens < 6) ? 0.4 : 1,
              outline: 'none',
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch'
            }}
            onMouseEnter={e => {
              if (!(boxWrite.isPending || boxWrite.isConfirming || hasActiveChoice || revealingIndex !== null || anyOpened || allOpened || remainingOpens < 6)) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.30)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.60)'
              }
            }}
            onMouseLeave={e => {
              if (!(boxWrite.isPending || boxWrite.isConfirming || hasActiveChoice || revealingIndex !== null || anyOpened || allOpened || remainingOpens < 6)) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.20)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.42)'
              }
            }}
          >
            <span style={{
              position: 'absolute',
              top: -8,
              right: -3,
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              color: '#FFF',
              fontSize: 7.5,
              fontWeight: 950,
              padding: '1px 5px',
              borderRadius: 6,
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.25)',
              zIndex: 10
            }}>1 Free Box</span>

            <div style={{
              background: 'rgba(255, 255, 255, 0.12)',
              height: '100%',
              minWidth: 54,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRight: '1px solid rgba(255, 255, 255, 0.20)',
              borderRadius: '13px 0 0 13px',
              fontSize: 20,
              fontWeight: 900,
              gap: 4
            }}>
              6 🎁
            </div>
            <div style={{
              flex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 10px',
              gap: 1
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3.5 }}>
                <span style={{ fontSize: 11.5, fontWeight: 900 }}>1.50</span>
                <img src="/usdc-logo.png" alt="USDC" style={{ width: 10, height: 10 }} />
              </div>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.48)', fontWeight: 600 }}>≈$1.50</span>
            </div>
          </button>

          {/* Button 4: Bundle $HH (1.00$ equivalent in HH, "1 free box" Badge) */}
          <button
            onClick={() => {
              setPaymentCurrency('HH')
              setTxModal('bundle')
            }}
            disabled={boxWrite.isPending || boxWrite.isConfirming || hasActiveChoice || revealingIndex !== null || anyOpened || allOpened || remainingOpens < 6}
            style={{
              position: 'relative',
              background: 'rgba(255,255,255,0.20)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.42)',
              color: '#FFF',
              borderRadius: 14,
              padding: 0,
              height: 52,
              cursor: (boxWrite.isPending || boxWrite.isConfirming || hasActiveChoice || revealingIndex !== null || anyOpened || allOpened || remainingOpens < 6) ? 'not-allowed' : 'pointer',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -1px 0 rgba(0,0,0,0.15)',
              opacity: (boxWrite.isPending || boxWrite.isConfirming || hasActiveChoice || revealingIndex !== null || anyOpened || allOpened || remainingOpens < 6) ? 0.4 : 1,
              outline: 'none',
              transition: 'all 0.2s',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch'
            }}
            onMouseEnter={e => {
              if (!(boxWrite.isPending || boxWrite.isConfirming || hasActiveChoice || revealingIndex !== null || anyOpened || allOpened || remainingOpens < 6)) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.30)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.60)'
              }
            }}
            onMouseLeave={e => {
              if (!(boxWrite.isPending || boxWrite.isConfirming || hasActiveChoice || revealingIndex !== null || anyOpened || allOpened || remainingOpens < 6)) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.20)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.42)'
              }
            }}
          >
            <span style={{
              position: 'absolute',
              top: -8,
              right: -3,
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              color: '#FFF',
              fontSize: 7.5,
              fontWeight: 950,
              padding: '1px 5px',
              borderRadius: 6,
              boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.25)',
              zIndex: 10
            }}>1 Free Box</span>

            <div style={{
              background: 'rgba(255, 255, 255, 0.12)',
              height: '100%',
              minWidth: 54,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRight: '1px solid rgba(255, 255, 255, 0.20)',
              borderRadius: '13px 0 0 13px',
              fontSize: 20,
              fontWeight: 900,
              gap: 4
            }}>
              6 🎁
            </div>
            <div style={{
              flex: 1,
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 10px',
              gap: 1
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3.5 }}>
                <span style={{ fontSize: 11.5, fontWeight: 900 }}>{formatConcise(1.00 / hhPrice)}</span>
                <img src="/logo.jfif" alt="$HH" style={{ width: 10, height: 10, borderRadius: '50%', objectFit: 'cover' }} />
              </div>
              <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.48)', fontWeight: 600 }}>≈$1.00</span>
            </div>
          </button>
        </div>
      </div>

      {/* ═══ TX MODAL ═══ */}
      {txModal && (
        <TxModal
          title={
            txModal === 'single'
              ? 'Open Box'
              : 'Open All 6 Boxes'
          }
          subtitle={
            txModal === 'single'
              ? 'Pick a box to reveal your reward!'
              : 'Unlock all 6 boxes instantly with 1 box FREE!'
          }
          amount={
            txModal === 'single'
              ? (paymentCurrency === 'HH' ? formatConcise(0.20 / hhPrice) : '0.30')
              : (paymentCurrency === 'HH' ? formatConcise(1.00 / hhPrice) : '1.50')
          }
          currency={
            paymentCurrency === 'HH' ? '$HH' : 'USDC'
          }
          isPending={boxWrite.isPending}
          isConfirming={boxWrite.isConfirming}
          isSuccess={boxWrite.isSuccess}
          error={boxWrite.error}
          onConfirm={txModal === 'single' ? handleSinglePayment : handleBundlePayment}
          onCancel={() => {
            setTxModal(false);
            boxWrite.reset();
            setClickedBoxIndex(null);
          }}
        />
      )}

      {/* Spin Animation Style */}
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
