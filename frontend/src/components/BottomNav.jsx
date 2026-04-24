// src/components/BottomNav.jsx

// Detect if running inside Base App (Coinbase Wallet WebView)
const isBaseApp = () =>
  typeof navigator !== 'undefined' &&
  /CoinbaseWallet/i.test(navigator.userAgent)

export function BottomNav({ tab, setTab }) {
  const tabs = [
    { id: 'raffle',      label: 'Raffle',  icon: '🎰' },
    { id: 'tasks',       label: 'Tasks',   icon: '📋' },
    { id: 'leaderboard', label: 'Leaders', icon: '🏆' },
    { id: 'profile',     label: 'Profile', icon: '👤' },
  ]

  // In Base App, lift the nav up by ~44px to avoid overlapping the native bottom bar
  const bottomOffset = isBaseApp() ? 44 : 0

  return (
    <div style={{
      position: 'fixed', bottom: bottomOffset, left: 0, right: 0, zIndex: 50,
      padding: '8px 12px max(16px, env(safe-area-inset-bottom))',
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(20px)',
        borderRadius: 20, border: '1px solid #DEE1E7',
        boxShadow: '0 4px 24px rgba(10,11,13,0.10)',
        display: 'flex', padding: '6px 8px',
        pointerEvents: 'all', maxWidth: 480, margin: '0 auto',
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            padding: '8px 4px 7px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: tab === t.id ? '#EEF0F3' : 'transparent',
            outline: tab === t.id ? '1px solid rgba(0,0,255,0.15)' : 'none',
            transition: 'all 0.2s',
          }}>
            <span style={{ fontSize: 20, lineHeight: 1 }}>{t.icon}</span>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 0.3,
              color: tab === t.id ? '#0000FF' : '#717886',
            }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
