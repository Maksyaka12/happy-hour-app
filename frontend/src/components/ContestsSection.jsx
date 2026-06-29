import { useState, useEffect } from 'react'
import { db } from '../config/supabase'

const CONTEST_TARGET_DATE = new Date(Date.UTC(2026, 5, 27, 19, 52, 0))
const TRADING_CONTEST_TARGET_DATE = new Date(Date.UTC(2026, 6, 4, 15, 0, 0)) // Saturday, July 4, 2026, 15:00 UTC

const calculateContestTimeLeft = () => {
  const now = new Date()
  const diff = CONTEST_TARGET_DATE.getTime() - now.getTime()
  
  if (isNaN(diff) || diff <= 0) return '00d 00h 00m 00s'
  
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  
  return `${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
}

const calculateTradingContestTimeLeft = () => {
  const now = new Date()
  const diff = TRADING_CONTEST_TARGET_DATE.getTime() - now.getTime()
  
  if (isNaN(diff) || diff <= 0) return '00d 00h 00m 00s'
  
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  
  return `${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`
}

export function ContestsSection({ setTab, address }) {
  const [activeContest, setActiveContest] = useState(null)
  const [contestTimeLeft, setContestTimeLeft] = useState(calculateContestTimeLeft())
  const [tradingContestTimeLeft, setTradingContestTimeLeft] = useState(calculateTradingContestTimeLeft())
  const [selectedFilter, setSelectedFilter] = useState('all') // 'all', 'ongoing', 'ended'

  // Trader Contest States
  const [userVolumeHH, setUserVolumeHH] = useState(0)
  const [userVolumeUSD, setUserVolumeUSD] = useState(0)
  const [userTrades, setUserTrades] = useState([])
  const [visibleTradesCount, setVisibleTradesCount] = useState(3)
  const [loadingTraderContest, setLoadingTraderContest] = useState(false)
  const [hhPrice, setHhPrice] = useState(0.0000003458)

  // Admin Leaderboard States
  const [adminLeaderboard, setAdminLeaderboard] = useState([])
  const [showAdminLeaderboard, setShowAdminLeaderboard] = useState(false)
  const [loadingAdminLeaderboard, setLoadingAdminLeaderboard] = useState(false)
  const [adminLeaderboardError, setAdminLeaderboardError] = useState('')

  // Submit Form States
  const [postUrl, setPostUrl] = useState('')
  const [postStatus, setPostStatus] = useState('') // '', 'submitting', 'success', 'error'
  const [postMsg, setPostMsg] = useState('')

  // Admin Review States
  const [submissions, setSubmissions] = useState([])
  const [showAdminSubmissions, setShowAdminSubmissions] = useState(false)
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)

  const handleSubmitPost = async () => {
    if (!address) return
    if (!postUrl.startsWith('http://') && !postUrl.startsWith('https://')) {
      setPostMsg('Link must start with http:// or https://')
      setPostStatus('error')
      return
    }
    setPostStatus('submitting')
    setPostMsg('')
    try {
      const { data, error } = await db.rpc('submit_contest_post', {
        p_address: address.toLowerCase(),
        p_url: postUrl.trim()
      })
      if (error || !data?.ok) {
        setPostMsg(data?.error || 'Failed to submit. Try again.')
        setPostStatus('error')
      } else {
        setPostMsg('Submitted successfully!')
        setPostStatus('success')
        setPostUrl('')
        if (showAdminSubmissions) {
          loadAdminSubmissions()
        }
      }
    } catch (err) {
      console.error(err)
      setPostMsg('An unexpected error occurred.')
      setPostStatus('error')
    }
  }

  const loadAdminSubmissions = async () => {
    if (!address) return
    setLoadingSubmissions(true)
    try {
      const { data, error } = await db.rpc('get_contest_submissions', {
        p_admin_address: address.toLowerCase()
      })
      if (!error && data) {
        setSubmissions(data)
      } else {
        console.error('loadAdminSubmissions error:', error)
      }
    } catch (err) {
      console.error(err)
    }
    setLoadingSubmissions(false)
  }

  useEffect(() => {
    if (showAdminSubmissions && address?.toLowerCase() === '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a') {
      loadAdminSubmissions()
    }
  }, [address, showAdminSubmissions])

  useEffect(() => {
    const timer = setInterval(() => {
      setContestTimeLeft(calculateContestTimeLeft())
      setTradingContestTimeLeft(calculateTradingContestTimeLeft())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchUserTrades = async (walletAddress) => {
    if (!walletAddress) return
    setLoadingTraderContest(true)
    try {
      let currentPrice = hhPrice
      try {
        const res = await fetch('https://api.dexscreener.com/latest/dex/tokens/0x8235EdF32a1e10Bd1867ad622915AB613664cbA3')
        const data = await res.json()
        if (data.pairs && data.pairs[0]) {
          currentPrice = Number(data.pairs[0].priceUsd) || 0.0000003458
          setHhPrice(currentPrice)
        }
      } catch (e) {
        console.error('Error fetching HH price:', e)
      }

      const currentBlockHex = await fetch('https://mainnet.base.org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber' })
      }).then(r => r.json()).then(d => parseInt(d.result, 16))

      const START_BLOCK = 47944627
      const endBlock = currentBlockHex
      const chunkSize = 10000
      const promises = []

      const pad = (a) => '0x' + a.toLowerCase().replace('0x', '').padStart(64, '0')
      const pUser = pad(walletAddress)
      const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
      const token = '0x8235EdF32a1e10Bd1867ad622915AB613664cbA3'

      for (let from = START_BLOCK; from < endBlock; from += chunkSize) {
        const to = Math.min(from + chunkSize - 1, endBlock)
        const fromHex = '0x' + from.toString(16)
        const toHex = '0x' + to.toString(16)

        promises.push(
          fetch('https://mainnet.base.org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 2,
              method: 'eth_getLogs',
              params: [{
                address: token,
                topics: [transferTopic, pUser],
                fromBlock: fromHex,
                toBlock: toHex
              }]
            })
          }).then(r => r.json()).then(d => (d.result || []).map(log => ({ ...log, type: 'sell' })))
        )

        promises.push(
          fetch('https://mainnet.base.org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 3,
              method: 'eth_getLogs',
              params: [{
                address: token,
                topics: [transferTopic, null, pUser],
                fromBlock: fromHex,
                toBlock: toHex
              }]
            })
          }).then(r => r.json()).then(d => (d.result || []).map(log => ({ ...log, type: 'buy' })))
        )
      }

      const results = await Promise.all(promises)
      const allLogs = results.flat()

      allLogs.sort((a, b) => {
        const blockA = parseInt(a.blockNumber, 16)
        const blockB = parseInt(b.blockNumber, 16)
        if (blockA !== blockB) return blockB - blockA
        return parseInt(b.transactionIndex, 16) - parseInt(a.transactionIndex, 16)
      })

      const exclusions = [
        '0xFd23526111280b78FF4e7F38B1fAF5818B9c5214', // Staking
        '0x3bdF461984142C473F2185B4F0F64a918B8ce49b', // Raffle
        '0x7E861466bC2845C9f57051fb9652bC4a56d95542', // Check-in target
        '0x13802fDe66BCf54BcebE2242aF0836A5Dfb45Fc8', // HH Manager
        '0xdE76F43E17B1173947f63b72C85a2f0d9a97702F', // Foundation
        '0x000000000000000000000000000000000000dead', // Dead
        '0x0000000000000000000000000000000000000000'  // Zero
      ].map(a => a.toLowerCase())

      const uniqueCounterparties = Array.from(new Set(allLogs.map(log => {
        const from = '0x' + log.topics[1].substring(26).toLowerCase()
        const to = '0x' + log.topics[2].substring(26).toLowerCase()
        return from === walletAddress.toLowerCase() ? to : from
      })))

      const filteredCounterparties = uniqueCounterparties.filter(cp => !exclusions.includes(cp))

      const codePromises = filteredCounterparties.map(cp =>
        fetch('https://mainnet.base.org', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 4,
            method: 'eth_getCode',
            params: [cp, 'latest']
          })
        }).then(r => r.json()).then(d => ({ address: cp, isContract: d.result && d.result !== '0x' }))
      )

      const codes = await Promise.all(codePromises)
      const contractCounterparties = new Set(codes.filter(c => c.isContract).map(c => c.address))

      let totalHH = 0
      const txMap = new Map()

      for (const log of allLogs) {
        const from = '0x' + log.topics[1].substring(26).toLowerCase()
        const to = '0x' + log.topics[2].substring(26).toLowerCase()
        const value = Number(BigInt(log.data)) / 1e18
        const counterparty = from === walletAddress.toLowerCase() ? to : from

        if (contractCounterparties.has(counterparty)) {
          totalHH += value
          const tradeType = log.type === 'buy' ? 'Buy' : 'Sell'
          const txHash = log.transactionHash

          if (!txMap.has(txHash)) {
            txMap.set(txHash, {
              hash: txHash,
              blockNumber: parseInt(log.blockNumber, 16),
              type: tradeType,
              amountHH: value,
              amountUSD: value * currentPrice
            })
          } else {
            const existing = txMap.get(txHash)
            existing.amountHH += value
            existing.amountUSD = existing.amountHH * currentPrice
          }
        }
      }

      const tradesArray = Array.from(txMap.values())
      setUserTrades(tradesArray)
      setUserVolumeHH(totalHH)
      setUserVolumeUSD(totalHH * currentPrice)
    } catch (e) {
      console.error('Error fetching user trades:', e)
    } finally {
      setLoadingTraderContest(false)
    }
  }

  useEffect(() => {
    if (activeContest === 'trader' && address) {
      fetchUserTrades(address)
    }
  }, [activeContest, address])

  const loadContestLeaderboard = async () => {
    setLoadingAdminLeaderboard(true)
    setAdminLeaderboardError('')
    try {
      const { data: dbUsers, error: dbErr } = await db.from('users').select('address')
      if (dbErr) throw dbErr

      const userAddresses = new Set(dbUsers.map(u => u.address.toLowerCase()))

      const currentBlockHex = await fetch('https://mainnet.base.org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber' })
      }).then(r => r.json()).then(d => parseInt(d.result, 16))

      const START_BLOCK = 47944627
      const endBlock = currentBlockHex
      const chunkSize = 10000
      const promises = []
      const token = '0x8235EdF32a1e10Bd1867ad622915AB613664cbA3'
      const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

      for (let from = START_BLOCK; from < endBlock; from += chunkSize) {
        const to = Math.min(from + chunkSize - 1, endBlock)
        const fromHex = '0x' + from.toString(16)
        const toHex = '0x' + to.toString(16)

        promises.push(
          fetch('https://mainnet.base.org', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 2,
              method: 'eth_getLogs',
              params: [{
                address: token,
                topics: [transferTopic],
                fromBlock: fromHex,
                toBlock: toHex
              }]
            })
          }).then(r => r.json()).then(d => d.result || [])
        )
      }

      const results = await Promise.all(promises)
      const allLogs = results.flat()

      const exclusions = [
        '0xFd23526111280b78FF4e7F38B1fAF5818B9c5214',
        '0x3bdF461984142C473F2185B4F0F64a918B8ce49b',
        '0x7E861466bC2845C9f57051fb9652bC4a56d95542',
        '0x13802fDe66BCf54BcebE2242aF0836A5Dfb45Fc8',
        '0xdE76F43E17B1173947f63b72C85a2f0d9a97702F',
        '0x000000000000000000000000000000000000dead',
        '0x0000000000000000000000000000000000000000'
      ].map(a => a.toLowerCase())

      const uniqueCounterparties = new Set()
      const relevantLogs = []

      for (const log of allLogs) {
        const from = '0x' + log.topics[1].substring(26).toLowerCase()
        const to = '0x' + log.topics[2].substring(26).toLowerCase()

        const isFromUser = userAddresses.has(from)
        const isToUser = userAddresses.has(to)

        if (isFromUser || isToUser) {
          relevantLogs.push(log)
          const counterparty = isFromUser ? to : from
          if (!exclusions.includes(counterparty)) {
            uniqueCounterparties.add(counterparty)
          }
        }
      }

      const codePromises = Array.from(uniqueCounterparties).map(cp =>
        fetch('https://mainnet.base.org', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 4,
            method: 'eth_getCode',
            params: [cp, 'latest']
          })
        }).then(r => r.json()).then(d => ({ address: cp, isContract: d.result && d.result !== '0x' }))
      )

      const codes = await Promise.all(codePromises)
      const contractCounterparties = new Set(codes.filter(c => c.isContract).map(c => c.address))

      const userVolumes = {}

      for (const log of relevantLogs) {
        const from = '0x' + log.topics[1].substring(26).toLowerCase()
        const to = '0x' + log.topics[2].substring(26).toLowerCase()
        const value = Number(BigInt(log.data)) / 1e18

        const isFromUser = userAddresses.has(from)
        const isToUser = userAddresses.has(to)

        if (isFromUser) {
          if (contractCounterparties.has(to)) {
            if (!userVolumes[from]) userVolumes[from] = { buys: 0, sells: 0, total: 0 }
            userVolumes[from].sells += value
            userVolumes[from].total += value
          }
        }
        if (isToUser) {
          if (contractCounterparties.has(from)) {
            if (!userVolumes[to]) userVolumes[to] = { buys: 0, sells: 0, total: 0 }
            userVolumes[to].buys += value
            userVolumes[to].total += value
          }
        }
      }

      const leaderboard = Object.keys(userVolumes)
        .filter(addr => addr !== '0x000000000000000000000000000000000000dead' && addr !== '0x0000000000000000000000000000000000000000')
        .map(addr => ({
          address: addr,
          buys: userVolumes[addr].buys,
          sells: userVolumes[addr].sells,
          total: userVolumes[addr].total
        }))
        .sort((a, b) => b.total - a.total)

      setAdminLeaderboard(leaderboard)
    } catch (e) {
      console.error('Error loading admin leaderboard:', e)
      setAdminLeaderboardError('Failed to load leaderboard. Please try again.')
    } finally {
      setLoadingAdminLeaderboard(false)
    }
  }

  useEffect(() => {
    if (showAdminLeaderboard && address?.toLowerCase() === '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a') {
      loadContestLeaderboard()
    }
  }, [address, showAdminLeaderboard])

  if (activeContest === 'creator') {
    return (
      <div style={{ padding: '0 16px 120px' }}>
        {/* Back Button */}
        <button
          onClick={() => setActiveContest(null)}
          style={{
            background: 'none',
            border: 'none',
            color: '#717886',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 16,
            padding: 0,
            transition: 'color 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#F59E0B'}
          onMouseLeave={e => e.currentTarget.style.color = '#717886'}
        >
          ← Back to Contests
        </button>

        {/* Contest Banner - Themed to match the Contest Card */}
        <div style={{
          backgroundColor: '#2A1A06',
          borderRadius: 24,
          padding: '36px 20px',
          marginBottom: 20,
          position: 'relative',
          minHeight: 120,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(245, 158, 11, 0.15)',
          overflow: 'hidden',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          boxSizing: 'border-box'
        }}>
          {/* Style block for keyframes in case we are in detail view */}
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes floatingLogo {
              0% { transform: translateY(0px); }
              50% { transform: translateY(-6px); }
              100% { transform: translateY(0px); }
            }
          ` }} />

          {/* Graded background image with amber/warm gold hue filter */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(/banner.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'hue-rotate(25deg) brightness(0.5) contrast(1.15)',
            zIndex: 0,
            pointerEvents: 'none'
          }} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.15)', zIndex: 0 }} />
          
          {/* Floating creative emojis */}
          {[
            { char: '🎨', top: '10%', right: '15%', size: 28, opacity: 0.35, r: '15deg', dur: 4.2 },
            { char: '🖌️', bottom: '15%', left: '20%', size: 24, opacity: 0.3, r: '-20deg', dur: 4.8 },
            { char: '✏️', top: '45%', left: '8%', size: 22, opacity: 0.25, r: '10deg', dur: 5.5 },
            { char: '📝', bottom: '10%', right: '25%', size: 20, opacity: 0.3, r: '-15deg', dur: 3.9 }
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
              animation: `floatingLogo ${s.dur}s ease-in-out infinite`,
              fontSize: s.size,
              opacity: s.opacity,
              transform: `rotate(${s.r})`,
              filter: 'blur(0.3px)'
            }}>
              {s.char}
            </div>
          ))}
          
          <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 38,
              fontWeight: 900,
              color: '#FFFFFF',
              lineHeight: 1.1,
              textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              letterSpacing: '-0.5px'
            }}>
              Launch Contest
            </div>
            
            {/* Badges in Banner */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{
                background: 'rgba(255, 255, 255, 0.18)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.28)',
                borderRadius: 50,
                height: 24,
                boxSizing: 'border-box',
                padding: '0 12px',
                fontSize: 10,
                fontWeight: 900,
                color: '#FFFFFF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4
              }}>
                <span style={{ lineHeight: 1 }}>$120 in</span>
                <img src="/logo.jfif" alt="$HH" style={{ width: 12, height: 12, borderRadius: '50%', objectFit: 'cover' }} />
                <span style={{ lineHeight: 1 }}>$HH</span>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.18)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.28)',
                borderRadius: 50,
                height: 24,
                boxSizing: 'border-box',
                padding: '0 12px',
                fontSize: 10,
                fontWeight: 800,
                color: '#FFFFFF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ lineHeight: 1 }}>3 winners</span>
              </div>
              {CONTEST_TARGET_DATE.getTime() <= Date.now() ? (
                <div style={{
                  background: '#EF4444',
                  borderRadius: 50,
                  height: 24,
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                }}>
                  <span style={{
                    fontFamily: "'Outfit', 'Inter', sans-serif",
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#FFFFFF',
                    letterSpacing: '0.5px',
                    lineHeight: 1
                  }}>Ended</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.55)',
                    backdropFilter: 'blur(6px)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: 6,
                    height: 16,
                    padding: '0 5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <span style={{
                      fontFamily: "'Outfit', 'Inter', sans-serif",
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#FFFFFF',
                      fontVariantNumeric: 'tabular-nums',
                      letterSpacing: '0.3px'
                    }}>{contestTimeLeft}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {CONTEST_TARGET_DATE.getTime() <= Date.now() && <WinnersPedestal />}

        {/* Content Details (Glassmorphic Card) */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.03) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid #2A1A06',
          borderRadius: 20,
          padding: '20px',
          boxShadow: '0 8px 32px rgba(245, 158, 11, 0.06)',
          boxSizing: 'border-box',
          color: '#1E293B',
          fontFamily: "'Outfit', 'Inter', sans-serif"
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 800, color: '#D97706' }}>About the Contest</h3>
          <p style={{ margin: '0 0 16px', fontSize: 13, lineHeight: 1.5, color: '#475569', fontWeight: 600 }}>
            In honor of the Season 2 launch - we are kicking off our Launch Contest dedicated to creators! Showcase your creativity to share a prize pool.
          </p>

          <div style={{ margin: '0 0 20px', fontSize: 13, color: '#475569', fontWeight: 500 }}>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
              <li>Explore our updated app</li>
              <li>Create content about Happy Hour: guides, tutorials, videos, threads, art, or memes.</li>
              <li>Publish it on X and submit the link below.</li>
              <li>You can submit multiple links.</li>
            </ul>
          </div>

          <div style={{ borderTop: '1px solid rgba(245, 158, 11, 0.15)', paddingTop: 16 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#1E293B' }}>Rewards breakdown:</h4>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#475569', lineHeight: 1.6, fontWeight: 500 }}>
              <li>1st Place: $60 in $HH coin</li>
              <li>2nd Place: $30 in $HH coin</li>
              <li>3rd Place: $30 in $HH coin</li>
            </ul>
          </div>
        </div>

        {/* Post Submission Form */}
        <div style={{
          background: 'linear-gradient(135deg, #2A1A06 0%, #4F330D 100%)',
          borderRadius: 24,
          padding: '22px 20px',
          marginTop: 16,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(42,26,6,0.2)',
          border: '1px solid rgba(245,158,11,0.3)',
          boxSizing: 'border-box'
        }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✍️ Submit your Contest post</span>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginBottom: 14, lineHeight: 1.5, fontWeight: 500 }}>
              Submit your X posts link below. You can submit as many posts as you want.
            </div>
            
            {postStatus === 'success' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ background: 'rgba(5,150,105,0.25)', borderRadius: 14, padding: '10px 14px', fontSize: 12, color: '#6EE7B7', fontWeight: 800 }}>
                  ✓ {postMsg}
                </div>
                <button
                  onClick={() => { setPostStatus(''); setPostMsg(''); }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    borderRadius: 50,
                    padding: '8px 16px',
                    fontSize: 11,
                    fontWeight: 700,
                    border: 'none',
                    cursor: 'pointer',
                    alignSelf: 'flex-start'
                  }}
                >
                  Submit another link
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={postUrl}
                  onChange={e => { setPostUrl(e.target.value); setPostStatus(''); setPostMsg('') }}
                  placeholder="Paste your link here…"
                  style={{
                    flex: 1, padding: '10px 16px', borderRadius: 50,
                    border: postStatus === 'error' ? '1.5px solid #FCA5A5' : '1.5px solid rgba(255,255,255,0.2)',
                    background: 'rgba(255,255,255,0.1)', color: '#fff',
                    fontSize: 12, outline: 'none', fontFamily: 'inherit',
                    fontWeight: 600
                  }}
                />
                <button
                  onClick={handleSubmitPost}
                  disabled={postStatus === 'submitting' || !postUrl || !address}
                  style={{
                    background: '#fff', color: '#2A1A06', borderRadius: 50,
                    padding: '10px 20px', fontSize: 12, fontWeight: 800,
                    border: 'none', cursor: postStatus === 'submitting' || !postUrl || !address ? 'not-allowed' : 'pointer',
                    opacity: postStatus === 'submitting' || !postUrl || !address ? 0.6 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {postStatus === 'submitting' ? '…' : 'Submit'}
                </button>
              </div>
            )}
            {postStatus === 'error' && (
              <div style={{ fontSize: 10, color: '#FCA5A5', marginTop: 6, fontWeight: 600 }}>{postMsg}</div>
            )}
            {!address && (
              <div style={{ fontSize: 10, color: '#FCA5A5', marginTop: 6, fontWeight: 600 }}>Please connect your wallet to submit a post.</div>
            )}
          </div>
        </div>

        {/* Admin panel */}
        {address?.toLowerCase() === '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a' && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => {
                const next = !showAdminSubmissions
                setShowAdminSubmissions(next)
                if (next) loadAdminSubmissions()
              }}
              style={{
                fontSize: 12,
                padding: '8px 16px',
                borderRadius: 50,
                background: '#F59E0B',
                color: '#fff',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              📬 View Submitted Posts {submissions.length > 0 ? `(${submissions.length})` : ''}
            </button>

            {showAdminSubmissions && (
              <div style={{
                background: '#FFF7ED',
                border: '1px solid #FED7AA',
                borderRadius: 16,
                padding: 16,
                marginTop: 12,
                boxSizing: 'border-box'
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#9A3412', marginBottom: 12 }}>
                  Contest Submissions ({submissions.length})
                </div>

                {loadingSubmissions ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
                    <div style={{ width: 16, height: 16, border: '2px solid rgba(154,52,18,0.3)', borderTopColor: '#9A3412', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : submissions.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#B45309', textAlign: 'center', padding: '12px 0' }}>
                    No submissions found
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
                    {submissions.map(s => (
                      <div key={s.id} style={{ background: '#fff', borderRadius: 12, padding: '10px 12px', border: '1px solid #FED7AA', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#717886', fontFamily: "'DM Mono', monospace" }}>
                            {s.address}
                          </span>
                          <span style={{ fontSize: 9, color: '#A0AEC0' }}>
                            {new Date(s.submitted_at).toLocaleString()}
                          </span>
                        </div>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 11.5,
                            color: '#0052FF',
                            fontWeight: 600,
                            wordBreak: 'break-all',
                            textDecoration: 'none'
                          }}
                          onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                          onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                        >
                          {s.url}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  if (activeContest === 'trader') {
    return (
      <div style={{ padding: '0 16px 120px' }}>
        {/* Back Button */}
        <button
          onClick={() => setActiveContest(null)}
          style={{
            background: 'none',
            border: 'none',
            color: '#717886',
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 16,
            padding: 0,
            transition: 'color 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
          onMouseLeave={e => e.currentTarget.style.color = '#717886'}
        >
          ← Back to Contests
        </button>

        {/* Contest Banner - Red themed */}
        <div style={{
          backgroundColor: '#140505',
          borderRadius: 24,
          padding: '36px 20px',
          marginBottom: 20,
          position: 'relative',
          minHeight: 120,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(239, 68, 68, 0.15)',
          overflow: 'hidden',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          boxSizing: 'border-box'
        }}>
          {/* Graded background image with red hue filter */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(/banner.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'hue-rotate(330deg) brightness(0.4) contrast(1.15)',
            zIndex: 0,
            pointerEvents: 'none'
          }} />
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.15)', zIndex: 0 }} />
          
          {/* Floating financial emojis */}
          {[
            { char: '📈', top: '10%', right: '15%', size: 28, opacity: 0.35, r: '15deg', dur: 4.5 },
            { char: '📉', bottom: '15%', left: '20%', size: 24, opacity: 0.3, r: '-20deg', dur: 5.2 },
            { char: '📊', top: '45%', left: '8%', size: 22, opacity: 0.25, r: '10deg', dur: 3.8 },
            { char: '💸', bottom: '10%', right: '25%', size: 20, opacity: 0.3, r: '-15deg', dur: 4.4 }
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
              animation: `floatingLogo ${s.dur}s ease-in-out infinite`,
              fontSize: s.size,
              opacity: s.opacity,
              transform: `rotate(${s.r})`,
              filter: 'blur(0.3px)'
            }}>
              {s.char}
            </div>
          ))}
          
          <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 38,
              fontWeight: 900,
              color: '#FFFFFF',
              lineHeight: 1.1,
              textShadow: '0 2px 10px rgba(0,0,0,0.5)',
              letterSpacing: '-0.5px'
            }}>
              Trading Contest
            </div>
            
            {/* Badges in Banner */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{
                background: 'linear-gradient(135deg, #0052FF 0%, #7C3AED 100%)',
                border: '1px solid rgba(0, 82, 255, 0.5)',
                borderRadius: 50,
                height: 24,
                boxSizing: 'border-box',
                padding: '0 12px',
                fontSize: 10,
                fontWeight: 900,
                color: '#FFFFFF',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4
              }}>
                <span style={{ lineHeight: 1 }}>$100 in</span>
                <img src="/logo.jfif" alt="$HH" style={{ width: 12, height: 12, borderRadius: '50%', objectFit: 'cover' }} />
                <span style={{ lineHeight: 1 }}>$HH</span>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.22)',
                borderRadius: 50,
                height: 24,
                boxSizing: 'border-box',
                padding: '0 12px',
                fontSize: 10,
                fontWeight: 800,
                color: 'rgba(255, 255, 255, 0.85)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ lineHeight: 1 }}>3 winners</span>
              </div>
              <div style={{
                background: '#10B981',
                border: '1px solid rgba(16, 185, 129, 0.5)',
                borderRadius: 50,
                height: 24,
                padding: '0 12px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{
                  fontFamily: "'Outfit', 'Inter', sans-serif",
                  fontSize: 10,
                  fontWeight: 800,
                  color: '#FFFFFF',
                  letterSpacing: '0.5px'
                }}>{tradingContestTimeLeft}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content Details (Glassmorphic Card) */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.03) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid #2A1A06',
          borderRadius: 20,
          padding: '20px',
          boxShadow: '0 8px 32px rgba(245, 158, 11, 0.06)',
          boxSizing: 'border-box',
          color: '#1E293B',
          fontFamily: "'Outfit', 'Inter', sans-serif"
        }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 800, color: '#D97706' }}>About the Contest</h3>
          <p style={{ margin: '0 0 8px', fontSize: 13, lineHeight: 1.5, color: '#475569', fontWeight: 600 }}>
            Trading contest is dedicated to $HH trading! Simply trade $HH using any platform to participate in the contest and win rewards.
          </p>
          <p style={{ margin: '0 0 16px', fontSize: 12.5, fontFamily: "'DM Mono', monospace", color: '#D97706', fontWeight: 700 }}>
            CA: 0x8235EdF32a1e10Bd1867ad622915AB613664cbA3
          </p>

          <div style={{ margin: '0 0 16px', fontSize: 13, color: '#475569', fontWeight: 500 }}>
            <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>
              <li>Login to Happy Hour using your trading wallet.</li>
              <li>Simply trade $HH through any platform.</li>
              <li>Track your volume in the Trading Card.</li>
              <li>Absolutely all volume made using your connected wallet is tracked in real-time.</li>
              <li>The wallet you connect to Happy Hour is your trading wallet (if you trade with a different address, simply connect it to the app).</li>
            </ul>
          </div>

          <p style={{ margin: '0 0 16px', fontSize: 13, color: '#475569', fontWeight: 600, lineHeight: 1.5 }}>
            The top 3 traders with the highest $HH trading volume at the end of the contest will share the $100 in $HH coin pool.
          </p>

          <div style={{ borderTop: '1px solid rgba(245, 158, 11, 0.15)', paddingTop: 16 }}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 700, color: '#1E293B' }}>Rewards breakdown:</h4>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#475569', lineHeight: 1.6, fontWeight: 500 }}>
              <li>1st Place: $50 in $HH coin</li>
              <li>2nd Place: $25 in $HH coin</li>
              <li>3rd Place: $25 in $HH coin</li>
            </ul>
          </div>
        </div>

        {/* User Trading Status Card (Premium Staking-inspired style) */}
        <div style={{
          background: 'linear-gradient(145deg, rgba(20, 10, 10, 0.95) 0%, rgba(35, 18, 18, 0.90) 50%, rgba(14, 5, 5, 0.98) 100%)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: 20,
          padding: '16px 18px',
          boxShadow: '0 8px 32px rgba(10, 5, 5, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
          boxSizing: 'border-box',
          fontFamily: "'Outfit', 'Inter', sans-serif",
          position: 'relative',
          overflow: 'hidden',
          marginTop: 16
        }}>
          {/* Background image overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: 'url(/banner.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'hue-rotate(330deg) brightness(0.25) contrast(1.2)',
            zIndex: 0,
            pointerEvents: 'none'
          }} />

          {/* Shimmer glow */}
          <div style={{
            position: 'absolute',
            top: -30,
            right: -30,
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255, 255, 255, 0.06) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />

          <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 14.5, fontWeight: 900, color: '#FFFFFF', letterSpacing: '0.2px' }}>
                Trading Card
              </div>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34D399',
                padding: '3px 8px',
                borderRadius: 8,
                fontSize: 10,
                fontWeight: 800,
                border: '1px solid rgba(16, 185, 129, 0.25)'
              }}>
                Active
              </span>
            </div>

            {!address ? (
              <div style={{
                textAlign: 'center',
                padding: '24px 16px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
                borderRadius: 16,
                color: '#FCA5A5',
                fontSize: 13,
                fontWeight: 700,
                marginTop: 4
              }}>
                Please connect your wallet at the top to track your trading volume!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Two Plates Layout */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  marginTop: 2
                }}>
                  {/* Left Plate: Total Trading Volume */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#A0AEC0', letterSpacing: '0.5px' }}>
                      Total Volume
                    </span>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: 14,
                      minHeight: 52,
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                      boxSizing: 'border-box'
                    }}>
                      <img src="/logo.jfif" alt="$HH" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: 14, fontWeight: 900, color: '#FFFFFF', lineHeight: 1.2 }}>
                          {userVolumeHH.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                        <span style={{ fontSize: 11, color: '#FCD34D', fontWeight: 700, marginTop: 1 }}>
                          ≈ ${userVolumeUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Plate: Volume Breakdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#A0AEC0', letterSpacing: '0.5px' }}>
                      Volume Breakdown
                    </span>
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: 14,
                      minHeight: 52,
                      padding: '8px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      gap: 2,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
                      boxSizing: 'border-box'
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#34D399', lineHeight: 1.1 }}>
                        Buys: {userTrades.filter(t => t.type === 'Buy').reduce((acc, t) => acc + t.amountHH, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#FCA5A5', lineHeight: 1.1 }}>
                        Sells: {userTrades.filter(t => t.type === 'Sell').reduce((acc, t) => acc + t.amountHH, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Wallet identifier */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 12,
                  padding: '10px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                  marginTop: 4
                }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.55)', fontWeight: 600 }}>Tracking Wallet:</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", color: '#FFFFFF', fontWeight: 700 }}>
                    {address.substring(0, 8)}...{address.substring(address.length - 8)}
                  </span>
                </div>

                {/* Trade History */}
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#FFFFFF', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Recent Trades ({userTrades.length})</span>
                    {loadingTraderContest && (
                      <div style={{ width: 12, height: 12, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#EF4444', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    )}
                  </div>

                  {loadingTraderContest && userTrades.length === 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 0' }}>
                      <div style={{ width: 20, height: 20, border: '2px solid rgba(255,255,255,0.2)', borderTopColor: '#EF4444', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    </div>
                  ) : userTrades.length === 0 ? (
                    <div style={{
                      textAlign: 'center',
                      padding: '16px 12px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px dashed rgba(255, 255, 255, 0.08)',
                      borderRadius: 14,
                      color: 'rgba(255, 255, 255, 0.4)',
                      fontSize: 12,
                      lineHeight: 1.4
                    }}>
                      No trades detected. Trades will update automatically when you perform swaps.
                    </div>
                  ) : (
                    <>
                      <div className="dark-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: visibleTradesCount <= 3 ? 180 : 360, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        {userTrades.slice(0, visibleTradesCount).map(trade => (
                          <div key={trade.hash} style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            borderRadius: 12,
                            padding: '10px 12px',
                            border: '1px solid rgba(255, 255, 255, 0.06)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{
                                background: trade.type === 'Buy' ? 'rgba(52, 211, 153, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                                color: trade.type === 'Buy' ? '#34D399' : '#FCA5A5',
                                fontSize: 9,
                                fontWeight: 900,
                                padding: '2px 6px',
                                borderRadius: 5,
                                textTransform: 'uppercase'
                              }}>
                                {trade.type}
                              </span>
                              <div>
                                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#FFFFFF' }}>
                                  {trade.amountHH.toLocaleString(undefined, { maximumFractionDigits: 0 })} HH
                                </div>
                                <div style={{ fontSize: 10.5, color: 'rgba(255, 255, 255, 0.5)', marginTop: 0.5 }}>
                                  ≈ ${trade.amountUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                            </div>

                            <a
                              href={`https://basescan.org/tx/${trade.hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontSize: 11,
                                color: '#38BDF8',
                                fontWeight: 700,
                                textDecoration: 'none',
                                fontFamily: "'DM Mono', monospace"
                              }}
                              onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                              onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                            >
                              {trade.hash.substring(0, 6)}...{trade.hash.substring(trade.hash.length - 4)} ↗
                            </a>
                          </div>
                        ))}
                      </div>

                      {userTrades.length > 3 && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
                          {visibleTradesCount < userTrades.length ? (
                            <button
                              onClick={() => setVisibleTradesCount(prev => Math.min(prev + 5, userTrades.length))}
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#38BDF8',
                                borderRadius: 8,
                                padding: '6px 12px',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                outline: 'none'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                              }}
                            >
                              Show More
                            </button>
                          ) : (
                            <button
                              onClick={() => setVisibleTradesCount(3)}
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: '#38BDF8',
                                borderRadius: 8,
                                padding: '6px 12px',
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                outline: 'none'
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                              }}
                            >
                              Show Less
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Admin Contest Leaderboard Button */}
        {address?.toLowerCase() === '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a' && (
          <div style={{ marginTop: 20 }}>
            <button
              onClick={() => setShowAdminLeaderboard(!showAdminLeaderboard)}
              style={{
                background: '#FEE2E2',
                border: '1px solid #FCA5A5',
                color: '#B91C1C',
                borderRadius: 12,
                padding: '8px 14px',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              📊 View Contest Leaderboard {adminLeaderboard.length > 0 ? `(${adminLeaderboard.length})` : ''}
            </button>

            {showAdminLeaderboard && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(239, 68, 68, 0.03) 100%)',
                border: '1px solid rgba(239, 68, 68, 0.22)',
                borderRadius: 16,
                padding: 16,
                marginTop: 12,
                boxSizing: 'border-box'
              }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: '#B91C1C', marginBottom: 12 }}>
                  Real-time Trading Contest Leaderboard
                </div>

                {loadingAdminLeaderboard ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
                    <div style={{ width: 24, height: 24, border: '3px solid rgba(185,28,28,0.2)', borderTopColor: '#B91C1C', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  </div>
                ) : adminLeaderboardError ? (
                  <div style={{ fontSize: 12.5, color: '#B91C1C', textAlign: 'center', padding: '12px 0', fontWeight: 600 }}>
                    {adminLeaderboardError}
                  </div>
                ) : adminLeaderboard.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: '#B91C1C', textAlign: 'center', padding: '12px 0', fontWeight: 600 }}>
                    No trading users detected.
                  </div>
                ) : (
                  <div className="dark-scrollbar" style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 350, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    {adminLeaderboard.map((item, idx) => (
                      <div key={item.address} style={{
                        background: '#FFFFFF',
                        borderRadius: 14,
                        padding: '10px 12px',
                        border: '1px solid rgba(239, 68, 68, 0.15)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <span style={{
                            background: idx < 3 ? 'linear-gradient(135deg, #0052FF 0%, #7C3AED 100%)' : '#E2E8F0',
                            color: idx < 3 ? '#FFFFFF' : '#475569',
                            fontSize: 10,
                            fontWeight: 900,
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            marginTop: 1
                          }}>
                            {idx + 1}
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#1E293B', fontFamily: "'DM Mono', monospace" }}>
                              {item.address.substring(0, 6)}...{item.address.substring(item.address.length - 4)}
                            </div>
                            <div style={{ fontSize: 10, color: '#64748B' }}>
                              buys: <span style={{ fontWeight: 600, color: '#0F766E' }}>{item.buys.toLocaleString(undefined, { maximumFractionDigits: 0 })} HH</span>
                            </div>
                            <div style={{ fontSize: 10, color: '#64748B' }}>
                              sells: <span style={{ fontWeight: 600, color: '#B91C1C' }}>{item.sells.toLocaleString(undefined, { maximumFractionDigits: 0 })} HH</span>
                            </div>
                            <div style={{ fontSize: 10, color: '#64748B' }}>
                              USD Volume: <span style={{ fontWeight: 600, color: '#1E293B' }}>≈ ${((item.buys + item.sells) * hhPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 900, color: '#1E293B' }}>
                            {item.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            <span style={{ fontSize: 9.5, color: '#EF4444', fontWeight: 800, marginLeft: 3 }}>HH</span>
                          </div>
                          <a
                            href={`https://basescan.org/address/${item.address}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ fontSize: 9.5, color: '#0052FF', textDecoration: 'none', fontWeight: 700 }}
                            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                          >
                            Basescan ↗
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const isEnded = CONTEST_TARGET_DATE.getTime() <= Date.now();

  return (
    <div style={{ padding: '0 16px 120px' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes floatingLogo {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0px); }
        }
      ` }} />

      {/* Section Banner - Identical to Earn, but with USDC + HH logos */}
      <div style={{
        backgroundImage: 'url(/banner.jpg)',
        backgroundColor: '#0000FF',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderRadius: 24,
        padding: '36px 20px',
        marginBottom: 16,
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
        
        {/* Floating $HH & USDC Logos */}
        {[
          { type: 'hh', top: '10%', left: '8%', size: 38, opacity: 0.45, r: '-15deg', blur: 0.4, dur: 4.5 },
          { type: 'usdc', bottom: '10%', left: '22%', size: 28, opacity: 0.4, r: '10deg', blur: 0, dur: 5.2 },
          { type: 'hh', top: '8%', right: '12%', size: 44, opacity: 0.5, r: '18deg', blur: 0.5, dur: 3.8 },
          { type: 'usdc', top: '45%', right: '28%', size: 24, opacity: 0.35, r: '-8deg', blur: 0.8, dur: 6.0 },
          { type: 'hh', bottom: '8%', right: '6%', size: 48, opacity: 0.55, r: '12deg', blur: 0, dur: 4.4 },
          { type: 'usdc', top: '40%', left: '4%', size: 32, opacity: 0.4, r: '15deg', blur: 0.3, dur: 5.0 }
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
            animation: `floatingLogo ${s.dur}s ease-in-out infinite`,
          }}>
            <img
              src={s.type === 'hh' ? '/logo.jfif' : '/usdc-logo.png'}
              alt=""
              style={{
                width: s.size,
                height: s.size,
                borderRadius: '50%',
                opacity: s.opacity,
                filter: s.blur > 0 ? `blur(${s.blur}px)` : 'none',
                transform: `rotate(${s.r})`,
                objectFit: 'cover'
              }}
            />
          </div>
        ))}

        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center' }}>
          <div style={{
            fontFamily: "'Outfit', 'Inter', sans-serif",
            fontSize: 32,
            fontWeight: 900,
            color: '#FFFFFF',
            lineHeight: 1.1,
            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
            letterSpacing: '-1px'
          }}>
            Contests Hub
          </div>
        </div>
      </div>

      {/* Info Card (Premium Glassmorphism Theme) */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(0, 82, 255, 0.08) 0%, rgba(0, 82, 255, 0.03) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(0, 82, 255, 0.22)',
        borderRadius: 16,
        padding: '12px 16px',
        marginBottom: 16,
        boxShadow: '0 8px 32px rgba(0, 82, 255, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
        boxSizing: 'border-box'
      }}>
        <div style={{
          color: '#1E293B',
          fontFamily: "'Outfit', 'Inter', sans-serif",
          fontSize: 12.5,
          fontWeight: 600,
          lineHeight: 1.6,
          textAlign: 'center'
        }}>
          Follow contests to participate and earn{" "}
          <img src="/logo.jfif" alt="$HH" style={{ width: 13, height: 13, borderRadius: '50%', objectFit: 'cover', display: 'inline-block', verticalAlign: 'middle', margin: '0 2px 2px' }} />
          {" "}$HH and{" "}
          <img src="/usdc-logo.png" alt="USDC" style={{ width: 13, height: 13, display: 'inline-block', verticalAlign: 'middle', margin: '0 2px 2px' }} />
          {" "}USDC rewards. Contests are added periodically.
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 16,
        fontFamily: "'Outfit', 'Inter', sans-serif"
      }}>
        {[
          { id: 'all', label: 'All', count: 2 },
          { id: 'ongoing', label: 'Ongoing', count: 1 },
          { id: 'ended', label: 'Ended', count: 1 }
        ].map(tab => {
          const isActive = selectedFilter === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedFilter(tab.id)}
              style={{
                background: isActive ? '#0052FF' : 'rgba(255, 255, 255, 0.05)',
                border: isActive ? '1px solid #0052FF' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 50,
                padding: '6px 14px',
                color: isActive ? '#FFFFFF' : '#717886',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                  e.currentTarget.style.color = '#FFFFFF'
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                  e.currentTarget.style.color = '#717886'
                }
              }}
            >
              {tab.label} <span style={{ opacity: 0.6, fontSize: 10 }}>({tab.count})</span>
            </button>
          )
        })}
      </div>

      {/* Feature Blocks Stack (Full width) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Block 1: Trader Contest (Coming Soon / Upcoming) */}
        {(selectedFilter === 'all' || selectedFilter === 'ongoing') && (
          <div
            onClick={() => setActiveContest('trader')}
            style={{
              background: '#140505',
              borderRadius: 20,
              padding: '12px 18px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 8px 32px rgba(239, 68, 68, 0.15)',
              minHeight: 96,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              width: '100%',
              gap: 16
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-1.5px)'
              e.currentTarget.style.boxShadow = '0 12px 36px rgba(239, 68, 68, 0.25)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(239, 68, 68, 0.15)'
            }}
          >
            {/* Graded background image */}
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'url(/banner.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'hue-rotate(330deg) brightness(0.4) contrast(1.15)',
              zIndex: 0,
              pointerEvents: 'none'
            }} />
            
            {/* Left side */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#FFFFFF' }}>Trading Contest</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #0052FF 0%, #7C3AED 100%)',
                  border: '1px solid rgba(0, 82, 255, 0.5)',
                  borderRadius: 6,
                  height: 20,
                  boxSizing: 'border-box',
                  padding: '0 8px',
                  fontSize: 10,
                  fontWeight: 900,
                  color: '#FFFFFF',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                }}>
                  <span>$100 in</span>
                  <img src="/logo.jfif" alt="$HH" style={{ width: 11, height: 11, borderRadius: '50%', objectFit: 'cover' }} />
                  <span>$HH</span>
                </div>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.22)',
                  borderRadius: 6,
                  height: 20,
                  boxSizing: 'border-box',
                  padding: '0 8px',
                  fontSize: 10,
                  fontWeight: 800,
                  color: 'rgba(255, 255, 255, 0.85)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span>3 winners</span>
                </div>
              </div>
            </div>
            
            {/* Right side */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, position: 'relative', zIndex: 1 }}>
              <div style={{
                background: '#10B981',
                border: '1px solid rgba(16, 185, 129, 0.5)',
                borderRadius: 6,
                height: 20,
                padding: '0 8px',
                color: '#FFFFFF',
                fontSize: 10,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span>{tradingContestTimeLeft}</span>
              </div>
              <div style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: 8,
                padding: '6px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: 800,
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
              >
                Participate →
              </div>
            </div>
          </div>
        )}

        {/* Block 2: Creator Contest (Ended / Launch Contest) */}
        {(selectedFilter === 'all' || selectedFilter === 'ended') && (
          <div
            onClick={() => setActiveContest('creator')}
            style={{
              background: '#2A1A06',
              borderRadius: 20,
              padding: '12px 18px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 8px 32px rgba(245, 158, 11, 0.15)',
              minHeight: 96,
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              position: 'relative',
              overflow: 'hidden',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              width: '100%',
              gap: 16
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-1.5px)'
              e.currentTarget.style.boxShadow = '0 12px 36px rgba(245, 158, 11, 0.25)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none'
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(245, 158, 11, 0.15)'
            }}
          >
            {/* Graded background image */}
            <div style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'url(/banner.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'hue-rotate(25deg) brightness(0.4) contrast(1.15)',
              zIndex: 0,
              pointerEvents: 'none'
            }} />

            {/* Left side */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, position: 'relative', zIndex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#FFFFFF' }}>Launch Contest</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <div style={{
                  background: 'linear-gradient(135deg, #FCD34D 0%, #F59E0B 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.5)',
                  borderRadius: 6,
                  height: 20,
                  boxSizing: 'border-box',
                  padding: '0 8px',
                  fontSize: 10,
                  fontWeight: 900,
                  color: '#2A1A06',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                }}>
                  <span>$120 in</span>
                  <img src="/logo.jfif" alt="$HH" style={{ width: 11, height: 11, borderRadius: '50%', objectFit: 'cover' }} />
                  <span>$HH</span>
                </div>
                <div style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: '1px solid rgba(255, 255, 255, 0.22)',
                  borderRadius: 6,
                  height: 20,
                  boxSizing: 'border-box',
                  padding: '0 8px',
                  fontSize: 10,
                  fontWeight: 800,
                  color: 'rgba(255, 255, 255, 0.85)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span>3 winners</span>
                </div>
              </div>
            </div>

            {/* Right side */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, position: 'relative', zIndex: 1 }}>
              {/* Timer or Ended Badge */}
              {isEnded ? (
                <div style={{
                  background: '#EF4444',
                  borderRadius: 6,
                  height: 20,
                  padding: '0 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                }}>
                  <span style={{
                    fontFamily: "'Outfit', 'Inter', sans-serif",
                    fontSize: 10,
                    fontWeight: 800,
                    color: '#FFFFFF',
                    letterSpacing: '0.5px'
                  }}>Ended</span>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(0, 0, 0, 0.55)',
                  backdropFilter: 'blur(6px)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 6,
                  height: 20,
                  padding: '0 8px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{
                    fontFamily: "'Outfit', 'Inter', sans-serif",
                    fontSize: 10,
                    fontWeight: 700,
                    color: '#FFFFFF',
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '0.3px'
                  }}>{contestTimeLeft}</span>
                </div>
              )}

              {/* Action button */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.12)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: 8,
                padding: '6px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontSize: 12,
                fontWeight: 800,
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
              >
                {isEnded ? 'View Results →' : 'Participate →'}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function WinnersPedestal() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(245, 158, 11, 0.04) 100%)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(245, 158, 11, 0.3)',
      borderRadius: 20,
      padding: '16px 14px 12px',
      marginBottom: 20,
      boxShadow: '0 8px 32px rgba(245, 158, 11, 0.08)',
      boxSizing: 'border-box',
      fontFamily: "'Outfit', 'Inter', sans-serif"
    }}>
      <h3 style={{
        margin: '0 0 16px',
        fontSize: 15,
        fontWeight: 800,
        color: '#F59E0B',
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6
      }}>
        🏆 Contest Winners
      </h3>

      {/* The Pedestal container */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 10,
        marginTop: 10,
        height: 160,
        boxSizing: 'border-box'
      }}>
        {/* 2nd Place */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flex: 1,
          maxWidth: 90
        }}>
          {/* Avatar */}
          <div style={{
            position: 'relative',
            width: 40,
            height: 40,
            borderRadius: '50%',
            border: '2px solid #C0C0C0', // Silver
            boxShadow: '0 0 10px rgba(192, 192, 192, 0.3)',
            marginBottom: 4,
            overflow: 'hidden'
          }}>
            <img src="/winners/2 palce.jpg" alt="2nd Place" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: '#000000', marginBottom: 1, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>@Benny___5</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
            <a href="https://x.com/Benny___5" target="_blank" rel="noopener noreferrer" style={{ fontSize: 8.5, fontWeight: 700, color: '#F59E0B', textDecoration: 'none' }}>view profile</a>
            <span style={{ fontSize: 8.5, color: '#717886' }}>·</span>
            <a href="https://basescan.org/tx/0xda57e3fde642b797356fcd3bf7360c3329ba0fa923fa2ebf0e4474dd9e483ae6" target="_blank" rel="noopener noreferrer" style={{ fontSize: 8.5, fontWeight: 700, color: '#F59E0B', textDecoration: 'none' }}>payout</a>
          </div>
          
          {/* Pedestal block */}
          <div style={{
            width: '100%',
            height: 42,
            background: 'linear-gradient(180deg, #4A4A4A 0%, #2A2A2A 100%)',
            border: '1px solid #C0C0C0',
            borderBottom: 'none',
            borderRadius: '6px 6px 0 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
          }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: '#C0C0C0', lineHeight: 1 }}>2</span>
            <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>$30</span>
          </div>
        </div>

        {/* 1st Place */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flex: 1,
          maxWidth: 100,
          transform: 'translateY(-6px)'
        }}>
          {/* Crown */}
          <span style={{ fontSize: 12, marginBottom: 1, animation: 'floatingLogo 3s ease-in-out infinite' }}>👑</span>
          {/* Avatar */}
          <div style={{
            position: 'relative',
            width: 48,
            height: 48,
            borderRadius: '50%',
            border: '2px solid #FFD700', // Gold
            boxShadow: '0 0 16px rgba(255, 215, 0, 0.4)',
            marginBottom: 4,
            overflow: 'hidden'
          }}>
            <img src="/winners/1 place.jpg" alt="1st Place" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#000000', marginBottom: 1, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>@DrsonaliV20871</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
            <a href="https://x.com/DrsonaliV20871" target="_blank" rel="noopener noreferrer" style={{ fontSize: 8.5, fontWeight: 700, color: '#F59E0B', textDecoration: 'none' }}>view profile</a>
            <span style={{ fontSize: 8.5, color: '#717886' }}>·</span>
            <a href="https://basescan.org/tx/0xb1553466b66949b35045256c00f8d02d14cc7e0bb98045d5465fe69f128cd2eb" target="_blank" rel="noopener noreferrer" style={{ fontSize: 8.5, fontWeight: 700, color: '#F59E0B', textDecoration: 'none' }}>payout</a>
          </div>
          
          {/* Pedestal block */}
          <div style={{
            width: '100%',
            height: 60,
            background: 'linear-gradient(180deg, #F59E0B 0%, #B45309 100%)',
            border: '1px solid #FFD700',
            borderBottom: 'none',
            borderRadius: '8px 8px 0 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 16px rgba(245, 158, 11, 0.2)'
          }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: '#FFD700', lineHeight: 1 }}>1</span>
            <span style={{ fontSize: 10, fontWeight: 900, color: '#FFFFFF', marginTop: 1 }}>$60</span>
          </div>
        </div>

        {/* 3rd Place */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flex: 1,
          maxWidth: 90
        }}>
          {/* Avatar */}
          <div style={{
            position: 'relative',
            width: 36,
            height: 36,
            borderRadius: '50%',
            border: '2px solid #CD7F32', // Bronze
            boxShadow: '0 0 8px rgba(205, 127, 50, 0.3)',
            marginBottom: 4,
            overflow: 'hidden'
          }}>
            <img src="/winners/3 palce.jpg" alt="3rd Place" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: '#000000', marginBottom: 1, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>@Shillawakning</div>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4, alignItems: 'center' }}>
            <a href="https://x.com/Shillawakning" target="_blank" rel="noopener noreferrer" style={{ fontSize: 8.5, fontWeight: 700, color: '#F59E0B', textDecoration: 'none' }}>view profile</a>
            <span style={{ fontSize: 8.5, color: '#717886' }}>·</span>
            <a href="https://basescan.org/tx/0x6047a5aa9461a684d1a3a8d8a8415d21f72554f321a5b7fa4e2f2888a5c3221a" target="_blank" rel="noopener noreferrer" style={{ fontSize: 8.5, fontWeight: 700, color: '#F59E0B', textDecoration: 'none' }}>payout</a>
          </div>
          
          {/* Pedestal block */}
          <div style={{
            width: '100%',
            height: 32,
            background: 'linear-gradient(180deg, #3A2512 0%, #1E120A 100%)',
            border: '1px solid #CD7F32',
            borderBottom: 'none',
            borderRadius: '6px 6px 0 0',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
          }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#CD7F32', lineHeight: 1 }}>3</span>
            <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>$30</span>
          </div>
        </div>
      </div>
    </div>
  )
}
