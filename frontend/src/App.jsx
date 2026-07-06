import { useEffect, useMemo, useState } from 'react'
import { useAccount, useReadContract, useSwitchChain } from 'wagmi'
import { base } from 'wagmi/chains'
import { formatUnits } from 'viem'
import { db } from './config/supabase'
import { useBasename } from './hooks/useBasename'
import { ConnectScreen } from './components/ConnectScreen'
import { RaffleSection } from './components/RaffleSection'
import { EarnSection } from './components/EarnSection'
import { ContestsSection } from './components/ContestsSection'
import { ProfileSection } from './components/ProfileSection'
import { AccountSection } from './components/AccountSection'
import { BottomNav } from './components/BottomNav'
import { HappyHourLogo } from './components/HappyHourLogo'
import { HappyBotChat } from './components/HappyBotChat'
import { CSS } from './styles'
import { HAS_SUPABASE_CONFIG, USDC_ADDRESS, USDC_ABI, MEMBERSHIP_ADDRESS, MEMBERSHIP_ABI, HH_ADDRESS, HH_ABI, COORDINATOR_ADDRESS, COORDINATOR_ABI } from './config/constants'
import { WalletConnectModal } from './components/WalletConnectModal'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { DailyRaffleSection } from './components/DailyRaffleSection'

const short = (a) => (a ? `${a.slice(0, 6)}\u2026${a.slice(-4)}` : '\u2014')

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

function getReferralCode() {
  const ref = new URLSearchParams(window.location.search).get('ref')?.trim()
  return ref || null
}

export default function App({ onLogin }) {
  const isMiniapp = useMemo(() => {
    if (typeof window === 'undefined') return false
    const params = new URLSearchParams(window.location.search)
    if (params.get('platform') === 'base' || params.get('miniapp') === 'true') {
      return true
    }
    try {
      if (window.self !== window.top) return true
    } catch (e) {
      return true
    }
    return false
  }, [])

  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)
  const handleRequireWallet = () => {
    if (onLogin) {
      onLogin()
    } else {
      setIsConnectModalOpen(true)
    }
  }

  const [tab, setTab] = useState(() => {
    try {
      let saved = localStorage.getItem('happy_tab') || 'raffle'
      if (saved === 'profile') saved = 'home'
      if (saved === 'staking' || saved === 'raid') saved = 'earn'
      if (['tasks', 'leaderboard', 'boxes'].includes(saved)) saved = 'raffle'
      return saved
    } catch { return 'raffle' }
  })
  const [caCopied, setCaCopied] = useState(false)
  const [initialContest, setInitialContest] = useState(null)

  useEffect(() => {
    try { localStorage.setItem('happy_tab', tab) } catch { }
  }, [tab])
  // useAccount().chainId returns the REAL wallet chain (even if unsupported)
  // useChainId() returns base.id by default when chain is not in wagmi config — can't use it here
  const { address, isConnected, isConnecting, isReconnecting, chainId: accountChainId } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const basename = useBasename(address)
  const onWrongChain = isConnected && !!accountChainId && accountChainId !== base.id

  const { data: hhBalanceRaw } = useReadContract({
    address: HH_ADDRESS,
    abi: HH_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 }
  })
  const hhBalanceRawParsed = hhBalanceRaw !== undefined ? parseFloat(formatUnits(hhBalanceRaw, 18)) : 0
  const hhBalanceStr = formatConcise(hhBalanceRawParsed)

  const { data: summary } = useReadContract({
    address: COORDINATOR_ADDRESS,
    abi: COORDINATOR_ABI,
    functionName: 'getUserSummary',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 }
  })
  
  const [simulatedSummary] = useState({ hp: 1250, streak: 5 })

  const hpBalance = summary ? Number(summary[0]) : simulatedSummary.hp
  const streakCount = summary ? Number(summary[1]) : simulatedSummary.streak

  const referralCode = useMemo(() => getReferralCode(), [])

  const { data: isClubMemberRaw } = useReadContract({
    address: MEMBERSHIP_ADDRESS,
    abi: MEMBERSHIP_ABI,
    functionName: 'isMember',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 }
  })

  const [simulatedMember, setSimulatedMember] = useState(() => {
    try {
      return localStorage.getItem('hh_simulated_member') === 'true'
    } catch { return false }
  })

  // Keep simulatedMember synced with localStorage changes
  useEffect(() => {
    const checkSim = () => {
      try {
        const val = localStorage.getItem('hh_simulated_member') === 'true'
        setSimulatedMember(val)
      } catch {}
    }
    const interval = setInterval(checkSim, 2000)
    return () => clearInterval(interval)
  }, [])

  const isClubMember = isClubMemberRaw !== undefined ? isClubMemberRaw : simulatedMember

  const tabLabels = {
    home: 'Profile',
    raffle: 'Happy Raffle',
    earn: 'Staking',
    contests: 'Campaigns',
  }

  useEffect(() => {
    if (!isConnected || !address) return

    db.rpc('sync_user_profile', {
      p_address: address.toLowerCase(),
      p_basename: basename ?? null,
      p_ref_code: referralCode,
    }).then(({ error }) => {
      if (error) console.error('sync_user_profile:', error)
    })
  }, [isConnected, address, basename, referralCode])

  const [totalUsers, setTotalUsers] = useState(0)
  const isAdmin = address && atob('MHg0YzkxZDNiZWQzNzJjMTE3OTViOWNlOWE5MDE3ZGZlNDQ3YmYwNTBh') === address.toLowerCase()

  useEffect(() => {
    if (!isAdmin) return
    const fetchTotal = async () => {
      const { count } = await db.from('users').select('*', { count: 'exact', head: true })
      setTotalUsers(count || 0)
    }
    fetchTotal()
    const sub = db.channel(`admin-stats-${Date.now()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchTotal).subscribe()
    return () => { db.removeChannel(sub) }
  }, [address, isAdmin])

  if (isConnecting || isReconnecting) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F9FC' }}>
          <div style={{ textAlign: 'center' }}>
            <HappyHourLogo size={48} />
            <div style={{ marginTop: 16, fontSize: 14, color: '#717886' }}>
              {isReconnecting ? 'Reconnecting…' : 'Connecting…'}
            </div>
          </div>
        </div>
      </>
    )
  }

  if (!isConnected && isMiniapp) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <ConnectScreen />
      </>
    )
  }

  if (!HAS_SUPABASE_CONFIG) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ minHeight: '100vh', background: '#F8F9FC', padding: '24px 16px' }}>
          <div style={{ maxWidth: 560, margin: '0 auto', paddingTop: 72 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <HappyHourLogo size={40} />
              <div style={{ fontSize: 28, fontWeight: 900, color: '#0A0B0D' }}>happy hour <span style={{ color: '#0052FF' }}>based</span></div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #DEE1E7', borderLeft: '4px solid #FC401F', borderRadius: 18, padding: 20, boxShadow: '0 6px 24px rgba(10,11,13,0.06)' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0A0B0D', marginBottom: 8 }}>
                App setup is incomplete
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: '#717886', marginBottom: 14 }}>
                This deployment is missing Supabase frontend environment variables, so the app cannot load live data yet.
              </div>
              <div style={{ background: '#EEF0F3', borderRadius: 12, padding: 14, fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#32353D', lineHeight: 1.8 }}>
                VITE_SUPABASE_URL
                <br />
                VITE_SUPABASE_ANON
                <br />
                VITE_FOUNDATION_ADDRESS
                <br />
                VITE_BUILDER_CODE
                <br />
                VITE_APP_URL
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  const displayName = basename || short(address)

  // Maintenance Mode Toggle
  const IS_MAINTENANCE_MODE = false;

  if (IS_MAINTENANCE_MODE && !isAdmin) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F8F9FC', padding: 24 }}>
          <HappyHourLogo size={64} />
          <h1 style={{ marginTop: 24, fontSize: 28, fontWeight: 900, color: '#0A0B0D', textAlign: 'center', letterSpacing: '-0.5px' }}>
            System Debugging & Maintenance
          </h1>
          <p style={{ marginTop: 16, fontSize: 16, color: '#717886', textAlign: 'center', maxWidth: 455, lineHeight: 1.6 }}>
            We are currently conducting a debugging process and system maintenance.<br /><br />
            The app will be back online shortly. Thank you for your patience! 🛠️✨
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div 
        className={isMiniapp ? "miniapp-mode" : "web-mode sidebar-layout"} 
        style={{ minHeight: '100vh', color: 'var(--text)', position: 'relative' }}
      >

        {/* Wrong Network Banner */}
        {onWrongChain && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
            background: '#FC401F', color: '#fff',
            padding: '10px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 12,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              ⚠️ Wrong network. Switch to Base to use the app.
            </span>
            <button
              onClick={() => switchChain({ chainId: base.id })}
              disabled={isSwitching}
              style={{
                background: '#fff', color: '#FC401F',
                border: 'none', borderRadius: 20,
                padding: '6px 16px', fontSize: 13, fontWeight: 700,
                cursor: isSwitching ? 'wait' : 'pointer',
                flexShrink: 0,
              }}
            >
              {isSwitching ? 'Switching…' : 'Switch to Base'}
            </button>
          </div>
        )}

        {/* WEB DESKTOP SIDEBAR + HEADER LAYOUT */}
        {!isMiniapp && (
          <div className="desktop-only" style={{ display: 'flex', minHeight: '100vh', width: '100%', background: 'var(--bg2)' }}>
            <Sidebar 
              tab={tab} 
              setTab={setTab} 
              address={address} 
              isConnected={isConnected} 
              displayName={displayName} 
              isClubMember={isClubMember} 
              onRequireWallet={handleRequireWallet} 
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg2)' }}>
              <Header 
                tab={tab} 
                address={address} 
                isConnected={isConnected} 
                displayName={displayName} 
                isClubMember={isClubMember} 
                hhBalance={hhBalanceStr}
                hpBalance={hpBalance}
                streakCount={streakCount}
                onRequireWallet={handleRequireWallet} 
              />
              <div className="dark-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '32px 16px 64px', boxSizing: 'border-box' }}>
                <div style={{ maxWidth: ['contests', 'earn'].includes(tab) ? 1200 : 640, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                  {tab === 'home' && <ProfileSection address={address} basename={basename} totalUsers={totalUsers} setTab={setTab} onRequireWallet={handleRequireWallet} />}
                  {tab === 'raffle' && <RaffleSection address={address} basename={basename} onRequireWallet={handleRequireWallet} />}
                  {tab === 'dailyRaffle' && <DailyRaffleSection address={address} basename={basename} onRequireWallet={handleRequireWallet} />}
                  {tab === 'earn' && <EarnSection setTab={setTab} address={address} onRequireWallet={handleRequireWallet} />}
                  {tab === 'contests' && (
                    <ContestsSection 
                      setTab={setTab} 
                      address={address} 
                      initialContest={initialContest} 
                      onClearInitialContest={() => setInitialContest(null)} 
                      onRequireWallet={handleRequireWallet}
                    />
                  )}
                  {tab === 'account' && <AccountSection address={address} onRequireWallet={handleRequireWallet} />}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MOBILE OR MINIAPP LAYOUT */}
        <div className={isMiniapp ? "" : "mobile-only"}>
          <div
            style={{
              position: 'sticky',
              top: onWrongChain ? 44 : 0,
              zIndex: 40,
              background: 'var(--bg)',
              borderBottom: '1px solid var(--border2)',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 1px 8px rgba(10,11,13,0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <HappyHourLogo size={26} />
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5 }}>
                happy <span style={{ color: '#0052FF' }}>hour</span>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {/* Telegram Link */}
              <a 
                href="https://t.me/happyhourapp" 
                target="_blank" 
                rel="noopener noreferrer"
                title="Telegram Channel"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'rgba(0, 136, 204, 0.08)',
                  border: '1px solid rgba(0, 136, 204, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textDecoration: 'none'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 136, 204, 0.16)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0, 136, 204, 0.08)'}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#0088cc' }}>
                  <path d="M21.9 2.19a1 1 0 0 0-.99-.08l-19 8a1 1 0 0 0-.1 1.82l4.9 2.2 3.1 7.1a1 1 0 0 0 1.77.16l2.9-3.8 4.7 3.3a1 1 0 0 0 1.51-.55l4-17a1 1 0 0 0-.39-.85zM8.62 13.12l8.28-5.28-6.4 6.72-.4 2.88z"/>
                </svg>
              </a>

              {/* X (Twitter) Link */}
              <a 
                href="https://x.com/happyhour_base" 
                target="_blank" 
                rel="noopener noreferrer"
                title="Follow us on X"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'rgba(0, 0, 0, 0.05)',
                  border: '1px solid var(--border2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textDecoration: 'none'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text)' }}>
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>

              {/* Docs Link */}
              <a 
                href="/docs" 
                target="_blank" 
                rel="noopener noreferrer"
                title="Documentation"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'rgba(0, 82, 255, 0.08)',
                  border: '1px solid rgba(0, 82, 255, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textDecoration: 'none',
                  gap: 1
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 82, 255, 0.16)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0, 82, 255, 0.08)'}
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#0052ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                <span style={{ fontSize: 6, fontWeight: 800, color: '#0052ff', lineHeight: 1, letterSpacing: '-0.1px' }}>
                  docs
                </span>
              </a>

              {/* DexScreener Link */}
              <a 
                href="https://dexscreener.com/base/0xe186aa00d52844ed05d1b1373fc2ec8b0562d613f9f4b470ee7fafa0c1a388f9" 
                target="_blank" 
                rel="noopener noreferrer"
                title="DexScreener Chart"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textDecoration: 'none',
                  overflow: 'hidden'
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <img src="/dexscreener.jpg" alt="DexScreener" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </a>

              {/* GeckoTerminal Link */}
              <a 
                href="https://www.geckoterminal.com/uk/base/pools/0xe186aa00d52844ed05d1b1373fc2ec8b0562d613f9f4b470ee7fafa0c1a388f9" 
                target="_blank" 
                rel="noopener noreferrer"
                title="GeckoTerminal Chart"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textDecoration: 'none',
                  overflow: 'hidden'
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <img src="/geckoterminal.jpg" alt="GeckoTerminal" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </a>

              {/* CoinGecko Link */}
              <a 
                href="https://www.coingecko.com/en/coins/happy-hour" 
                target="_blank" 
                rel="noopener noreferrer"
                title="CoinGecko"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textDecoration: 'none',
                  overflow: 'hidden'
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <img src="/CoinGecko-logo.png" alt="CoinGecko" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </a>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* Daily Streak */}
                {streakCount > 0 && (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 12,
                    padding: '4px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
                    </svg>
                    <span style={{ fontSize: 11, fontWeight: 750, color: '#FFFFFF', fontFamily: "'DM Mono', monospace" }}>
                      {streakCount}
                    </span>
                  </div>
                )}

                {/* HP Balance */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <span style={{ fontSize: 11, fontWeight: 750, color: '#FFFFFF', fontFamily: "'DM Mono', monospace" }}>
                    {hpBalance}
                  </span>
                  <img src="/logo.jfif" alt="HP" style={{ width: 12, height: 12, borderRadius: '50%' }} />
                </div>

                {/* $HH Balance */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <span style={{ fontSize: 11, fontWeight: 750, color: '#FFFFFF', fontFamily: "'DM Mono', monospace" }}>
                    {hhBalanceStr}
                  </span>
                  <img src="/logo.jfif" alt="$HH" style={{ width: 12, height: 12, borderRadius: '50%' }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div style={{ position: 'relative', zIndex: 1, maxWidth: ['contests', 'earn'].includes(tab) ? 1200 : 640, margin: '0 auto' }}>
            {tab === 'home' && <ProfileSection address={address} basename={basename} totalUsers={totalUsers} setTab={setTab} onRequireWallet={handleRequireWallet} />}
            {tab === 'raffle' && <RaffleSection address={address} basename={basename} onRequireWallet={handleRequireWallet} />}
            {tab === 'dailyRaffle' && <DailyRaffleSection address={address} basename={basename} onRequireWallet={handleRequireWallet} />}
            {tab === 'earn' && <EarnSection setTab={setTab} address={address} onRequireWallet={handleRequireWallet} />}
            {tab === 'contests' && (
              <ContestsSection 
                setTab={setTab} 
                address={address} 
                initialContest={initialContest} 
                onClearInitialContest={() => setInitialContest(null)} 
                onRequireWallet={handleRequireWallet}
              />
            )}
            {tab === 'account' && <AccountSection address={address} onRequireWallet={handleRequireWallet} />}
            {['affiliate', 'terms', 'privacy', 'skills', 'x402'].includes(tab) && (
              <div style={{ padding: '80px 20px', textAlign: 'center' }}>
                <h2 style={{ color: '#FFFFFF', fontSize: 28, marginBottom: 12 }}>
                  {tab === 'affiliate' ? 'Happy Hour Affiliate' : 
                   tab === 'terms' ? 'Terms of Service' : 
                   tab === 'privacy' ? 'Privacy Policy' :
                   tab === 'skills' ? 'Skills' : 'x402 Endpoints'}
                </h2>
                <p style={{ color: '#8A8F9E', fontSize: 16 }}>Coming Soon</p>
              </div>
            )}
          </div>

          <footer style={{
            width: '100%',
            background: '#1D1F23',
            borderTop: '1px solid rgba(255, 255, 255, 0.12)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            padding: '32px 16px 140px',
            boxSizing: 'border-box',
            color: '#FFFFFF'
          }}>
            {/* Logo / Branding Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <img src="/logo.jfif" alt="$HH Logo" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 6 }}>
                $HH <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 650 }}>powered by</span>
                <a 
                  href="https://x.com/bankrbot" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 6, 
                    textDecoration: 'none', 
                    color: '#FFFFFF',
                    transition: 'opacity 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  <img src="/bankr-logo.jpg" alt="Bankr Logo" style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover' }} />
                  <span>Bankr</span>
                </a>
              </span>
            </div>

            {/* CA / Token Contract block */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 10,
              padding: '6px 10px',
              width: '100%',
              maxWidth: 350,
              justifyContent: 'space-between',
              boxSizing: 'border-box'
            }}>
              <span style={{ fontSize: 9.5, fontWeight: 900, color: '#3B82F6', letterSpacing: '0.5px', flexShrink: 0 }}>$HH CA:</span>
              <span style={{ 
                fontSize: 8.5, 
                fontWeight: 800, 
                fontFamily: "sf mono, consolas, 'Fira Code', monospace", 
                color: '#FFFFFF', 
                letterSpacing: '-0.1px',
                wordBreak: 'break-all',
                textAlign: 'center',
                flex: 1,
                padding: '0 4px'
              }}>
                {caCopied ? 'Copied! ✅' : '0x8235EdF32a1e10Bd1867ad622915AB613664cbA3'}
              </span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText('0x8235EdF32a1e10Bd1867ad622915AB613664cbA3');
                  setCaCopied(true);
                  setTimeout(() => setCaCopied(false), 2000);
                }}
                title="Copy Contract Address"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#3B82F6',
                  transition: 'all 0.2s',
                  flexShrink: 0
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>

            {/* Links Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%', margin: '8px 0' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px 20px' }}>
                <a 
                  href="https://t.me/happyhourapp" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 550, color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#3B82F6'; e.currentTarget.style.transform = 'translateY(-0.5px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', background: 'rgba(0, 136, 204, 0.15)',
                    border: '1px solid rgba(0, 136, 204, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#3B82F6' }}>
                      <path d="M21.9 2.19a1 1 0 0 0-.99-.08l-19 8a1 1 0 0 0-.1 1.82l4.9 2.2 3.1 7.1a1 1 0 0 0 1.77.16l2.9-3.8 4.7 3.3a1 1 0 0 0 1.51-.55l4-17a1 1 0 0 0-.39-.85zM8.62 13.12l8.28-5.28-6.4 6.72-.4 2.88z"/>
                    </svg>
                  </div>
                  <span>Official TG</span>
                </a>

                <a 
                  href="https://x.com/happyhour_base" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 550, color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.transform = 'translateY(-0.5px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#FFFFFF' }}>
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <span>Official X</span>
                </a>

                <a 
                  href="https://x.com/mksvibe" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 550, color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#3B82F6'; e.currentTarget.style.transform = 'translateY(-0.5px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', overflow: 'hidden',
                    border: '1.5px solid #3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <img src="/mksvibe.jpg" alt="mksvibe" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <span>Devs X</span>
                </a>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px 20px' }}>
                <a 
                  href="https://dexscreener.com/base/0xe186aa00d52844ed05d1b1373fc2ec8b0562d613f9f4b470ee7fafa0c1a388f9" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 550, color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-0.5px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <img src="/dexscreener.jpg" alt="DexScreener" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <span>Dexscreener</span>
                </a>

                <a 
                  href="https://www.geckoterminal.com/uk/base/pools/0xe186aa00d52844ed05d1b1373fc2ec8b0562d613f9f4b470ee7fafa0c1a388f9" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 550, color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-0.5px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <img src="/geckoterminal.jpg" alt="GeckoTerminal" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <span>GeckoTerminal</span>
                </a>

                <a 
                  href="https://www.coingecko.com/en/coins/happy-hour" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 550, color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-0.5px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <img src="/CoinGecko-logo.png" alt="CoinGecko" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <span>CoinGecko</span>
                </a>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px 20px' }}>
                <a 
                  href="/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 550, color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#3B82F6'; e.currentTarget.style.transform = 'translateY(-0.5px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                  </div>
                  <span>Docs</span>
                </a>

                <a 
                  href="/docs/utility"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 550, color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#3B82F6'; e.currentTarget.style.transform = 'translateY(-0.5px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                    </svg>
                  </div>
                  <span>$HH Utility</span>
                </a>

                <a 
                  href="/docs/economy"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 550, color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#3B82F6'; e.currentTarget.style.transform = 'translateY(-0.5px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10"/>
                      <line x1="12" y1="20" x2="12" y2="4"/>
                      <line x1="6" y1="20" x2="6" y2="14"/>
                    </svg>
                  </div>
                  <span>$HH Economy</span>
                </a>
              </div>
            </div>

            {/* Copyright */}
            <div style={{ fontSize: 9.5, color: 'rgba(255, 255, 255, 0.5)', fontWeight: 650 }}>
              &copy; {new Date().getFullYear()} Happy Hour. All rights reserved.
            </div>
        </footer>

        <BottomNav tab={tab} setTab={setTab} />
      </div>

      {/* Floating AI Chat assistant */}
      {isConnected && <HappyBotChat address={address} isClubMember={isClubMember} />}

      {/* Wallet Connect Modal */}
      <WalletConnectModal isOpen={isConnectModalOpen} onClose={() => setIsConnectModalOpen(false)} />
    </div>
  </>
  )
}
