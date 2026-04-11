import { useEffect, useMemo, useState } from 'react'
import { useAccount } from 'wagmi'
import { db } from './config/supabase'
import { useBasename } from './hooks/useBasename'
import { ConnectScreen } from './components/ConnectScreen'
import { RaffleSection } from './components/RaffleSection'
import { TasksSection } from './components/TasksSection'
import { LeaderboardSection } from './components/LeaderboardSection'
import { ProfileSection } from './components/ProfileSection'
import { BottomNav } from './components/BottomNav'
import { HappyHourLogo } from './components/HappyHourLogo'
import { CSS } from './styles'
import { HAS_SUPABASE_CONFIG } from './config/constants'

const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '—')

function getReferralAddress() {
  const ref = new URLSearchParams(window.location.search).get('ref')?.trim()
  if (!ref) return null
  return /^0x[a-fA-F0-9]{40}$/.test(ref) ? ref.toLowerCase() : null
}

export default function App() {
  const [tab, setTab] = useState(() => {
    try { return localStorage.getItem('happy_tab') || 'raffle' } catch { return 'raffle' }
  })
  useEffect(() => {
    try { localStorage.setItem('happy_tab', tab) } catch {}
  }, [tab])
  const { address, isConnected, isConnecting, isReconnecting } = useAccount()
  const basename = useBasename(address)

  const referralAddress = useMemo(() => getReferralAddress(), [])

  const tabLabels = {
    raffle: 'Raffle',
    tasks: 'Tasks',
    leaderboard: 'Leaderboard',
    profile: 'Profile',
  }

  useEffect(() => {
    if (!isConnected || !address) return

    db.rpc('sync_user_profile', {
      p_address: address.toLowerCase(),
      p_basename: basename ?? null,
      p_referrer: referralAddress,
    }).then(({ error }) => {
      if (error) console.error('sync_user_profile:', error)
    })
  }, [isConnected, address, basename, referralAddress])

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
              <div style={{ fontSize: 28, fontWeight: 900, color: '#0A0B0D' }}>Happy Hour</div>
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

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="app-bg" style={{ minHeight: '100vh', color: 'var(--text)', position: 'relative' }}>
        <div
          style={{
            position: 'sticky',
            top: 0,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HappyHourLogo size={30} />
            <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5 }}>
              happy hour
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--blue-bg)',
              border: '1px solid rgba(0,0,255,0.15)',
              borderRadius: 50,
              padding: '5px 12px',
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', animation: 'blinkDot 2s infinite' }} />
            <span style={{ fontSize: 10, color: 'var(--blue)', fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>
              {displayName}
            </span>
          </div>
        </div>

        <div style={{ padding: '14px 16px 8px' }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5 }}>
            {tabLabels[tab]}
          </span>
        </div>

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 640, margin: '0 auto' }}>
          {tab === 'raffle' && <RaffleSection address={address} basename={basename} />}
          {tab === 'tasks' && <TasksSection address={address} />}
          {tab === 'leaderboard' && <LeaderboardSection address={address} />}
          {tab === 'profile' && <ProfileSection address={address} basename={basename} />}
        </div>

        <BottomNav tab={tab} setTab={setTab} />
      </div>
    </>
  )
}
