import { useEffect, useMemo, useState } from 'react'
import { useAccount, useReadContract, useSwitchChain } from 'wagmi'
import { base } from 'wagmi/chains'
import { formatUnits } from 'viem'
import { db } from './config/supabase'
import { useBasename } from './hooks/useBasename'
import { ConnectScreen } from './components/ConnectScreen'
import { RaffleSection } from './components/RaffleSection'
import { TasksSection } from './components/TasksSection'
import { HappyBoxesSection } from './components/HappyBoxesSection'
import { LeaderboardSection } from './components/LeaderboardSection'
import { EarnSection } from './components/EarnSection'
import { RaidMode } from './components/RaidMode'
import { AirdropChecklist } from './components/AirdropChecklist'
import { ProfileSection } from './components/ProfileSection'
import { BottomNav } from './components/BottomNav'
import { HappyHourLogo } from './components/HappyHourLogo'
import { EventBanner } from './components/EventBanner'
import { CSS } from './styles'
import { HAS_SUPABASE_CONFIG, USDC_ADDRESS, USDC_ABI } from './config/constants'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

function getReferralCode() {
  const ref = new URLSearchParams(window.location.search).get('ref')?.trim()
  return ref || null
}

export default function App() {
  const [tab, setTab] = useState(() => {
    try {
      let saved = localStorage.getItem('happy_tab') || 'raffle'
      if (saved === 'profile') saved = 'home'
      if (saved === 'staking' || saved === 'raid') saved = 'earn'
      return saved
    } catch { return 'raffle' }
  })
  const [leaderboardSubTab, setLeaderboardSubTab] = useState(() => {
    try {
      let saved = localStorage.getItem('happy_leaderboard_subtab') || 'usdc'
      if (saved === 'hp') saved = 'hh'
      return saved
    } catch { return 'usdc' }
  })

  useEffect(() => {
    try { localStorage.setItem('happy_leaderboard_subtab', leaderboardSubTab) } catch { }
  }, [leaderboardSubTab])

  useEffect(() => {
    try { localStorage.setItem('happy_tab', tab) } catch { }
  }, [tab])
  // useAccount().chainId returns the REAL wallet chain (even if unsupported)
  // useChainId() returns base.id by default when chain is not in wagmi config — can't use it here
  const { address, isConnected, isConnecting, isReconnecting, chainId: accountChainId } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const basename = useBasename(address)
  const onWrongChain = isConnected && !!accountChainId && accountChainId !== base.id

  const { data: usdcBalanceRaw } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 10000 },
  })

  const [simulatedUsdcHeader, setSimulatedUsdcHeader] = useState(() => {
    try {
      return parseFloat(localStorage.getItem('usdc_simulated_wallet') || '500')
    } catch {
      return 500
    }
  })

  useEffect(() => {
    if (usdcBalanceRaw !== undefined) return
    const interval = setInterval(() => {
      try {
        const val = parseFloat(localStorage.getItem('usdc_simulated_wallet') || '500')
        setSimulatedUsdcHeader(val)
      } catch {}
    }, 2000)
    return () => clearInterval(interval)
  }, [usdcBalanceRaw])

  const usdcBalance = usdcBalanceRaw !== undefined
    ? Number(formatUnits(usdcBalanceRaw, 6)).toFixed(2)
    : simulatedUsdcHeader.toFixed(2)

  const referralCode = useMemo(() => getReferralCode(), [])

  const tabLabels = {
    home: 'Home',
    raffle: 'Happy Raffle',
    earn: 'Earn',
    boxes: 'Happy Boxes',
    tasks: 'Tasks',
    leaderboard: 'Leaderboard',
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
    const sub = db.channel('admin-stats').on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchTotal).subscribe()
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

  if (!isConnected) {
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
  const IS_MAINTENANCE_MODE = true;

  if (IS_MAINTENANCE_MODE && !isAdmin) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F8F9FC', padding: 24 }}>
          <HappyHourLogo size={64} />
          <h1 style={{ marginTop: 24, fontSize: 28, fontWeight: 900, color: '#0A0B0D', textAlign: 'center', letterSpacing: '-0.5px' }}>
            Scheduled Maintenance
          </h1>
          <p style={{ marginTop: 16, fontSize: 16, color: '#717886', textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
            We are currently upgrading the Happy Hour App!<br /><br />
            The app will be back shortly with exciting new features. Thank you for your patience! 🛠️✨
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="app-bg" style={{ minHeight: '100vh', color: 'var(--text)', position: 'relative' }}>

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

            <div style={{
              background: 'var(--blue-bg)',
              border: '1px solid rgba(0,0,255,0.15)',
              borderRadius: 20,
              padding: '4px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#0A0B0D' }}>{usdcBalance}</span>
              <img src="/usdc-logo.png" alt="USDC" style={{ width: 11, height: 11, display: 'block' }} />
            </div>
          </div>
        </div>

        <div style={{ height: 12 }} />

        {/* <EventBanner onClick={() => setTab('boxes')} /> */}
        {/* <ContestBanner onClick={() => setTab('boxes')} /> */}

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 640, margin: '0 auto' }}>
          {tab === 'home' && <ProfileSection address={address} basename={basename} totalUsers={totalUsers} setTab={setTab} />}
          {tab === 'raffle' && <RaffleSection address={address} basename={basename} />}
          {tab === 'earn' && <EarnSection setTab={setTab} address={address} />}
          {tab === 'boxes' && <HappyBoxesSection address={address} setTab={setTab} />}
          {tab === 'tasks' && <TasksSection address={address} />}
          {tab === 'raid' && (
            <div style={{ padding: '0 0 100px' }}>
              <div style={{ padding: '0 12px', marginBottom: 12 }}>
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
              </div>
              <RaidMode address={address} />
            </div>
          )}
          {tab === 'leaderboard' && (
            <>
              {/* Premium sub-navigation switcher above the banners */}
              <div style={{ padding: '0 16px' }}>
                <div style={{
                  display: 'flex',
                  background: '#EEF0F3',
                  border: '1px solid #DEE1E7',
                  borderRadius: 16,
                  padding: 4,
                  marginBottom: 20,
                  maxWidth: 380,
                  margin: '0 auto 20px',
                  boxShadow: 'inset 0 2px 4px rgba(10,11,13,0.05)',
                  gap: 6
                }}>
                  <button
                    onClick={() => setLeaderboardSubTab('usdc')}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 12,
                      border: leaderboardSubTab === 'usdc' ? 'none' : '1px solid rgba(255,255,255,0.8)',
                      background: leaderboardSubTab === 'usdc' 
                        ? 'linear-gradient(135deg, #0052FF 0%, #3B82F6 100%)' 
                        : 'rgba(255, 255, 255, 0.6)',
                      color: leaderboardSubTab === 'usdc' ? '#fff' : '#717886',
                      fontWeight: 850,
                      fontSize: 11.5,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: leaderboardSubTab === 'usdc' 
                        ? '0 4px 12px rgba(0,82,255,0.2)' 
                        : '0 2px 4px rgba(10,11,13,0.02)'
                    }}
                  >
                    🏆 USDC Rewards
                  </button>
                  <button
                    onClick={() => setLeaderboardSubTab('hh')}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: 12,
                      border: leaderboardSubTab === 'hh' ? 'none' : '1px solid rgba(255,255,255,0.8)',
                      background: leaderboardSubTab === 'hh' 
                        ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' 
                        : 'rgba(255, 255, 255, 0.6)',
                      color: leaderboardSubTab === 'hh' ? '#fff' : '#717886',
                      fontWeight: 850,
                      fontSize: 11.5,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: leaderboardSubTab === 'hh' 
                        ? '0 4px 12px rgba(16,185,129,0.2)' 
                        : '0 2px 4px rgba(10,11,13,0.02)'
                    }}
                  >
                    🪂 $HH Rewards
                  </button>
                </div>
              </div>

              {leaderboardSubTab === 'usdc' ? (
                <LeaderboardSection address={address} />
              ) : (
                <AirdropChecklist address={address} />
              )}
            </>
          )}
        </div>

        <BottomNav tab={tab} setTab={setTab} />
      </div>

    </>
  )
}
