// src/components/BottomNav.jsx

// Detect if running inside Base App / Coinbase Wallet
// Multiple checks for reliability
const isBaseApp = () => {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent || ''
  // Check user agent variants
  if (/CoinbaseWallet/i.test(ua)) return true
  if (/CB_WALLET/i.test(ua)) return true
  // Check injected wallet provider
  if (window.ethereum?.isCoinbaseWallet) return true
  if (window.coinbaseWalletExtension) return true
  return false
}

export function BottomNav({ tab, setTab }) {
  const tabs = [
    { id: 'raffle',      label: 'Raffle',  icon: '🎰' },
    { id: 'raid',        label: 'Raid',    icon: '🕵️' },
    { id: 'boxes',       label: 'Boxes',   icon: '🎁' },
    { id: 'tasks',       label: 'Tasks',   icon: '📋' },
    { id: 'leaderboard', label: 'Leaders', icon: '🏆' },
    { id: 'profile',     label: 'Profile', icon: '👤' },
  ]

  // Base App bug fixed, no offset needed
  const bottomOffset = 0

  // In Base App: lower z-index so the wallet confirmation modal appears above nav
  const navZIndex = isBaseApp() ? 10 : 50

  return (
    <div style={{
      position: 'fixed', bottom: bottomOffset, left: 0, right: 0, zIndex: navZIndex,
      padding: '8px 12px 10px',
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'rgba(235, 242, 255, 0.97)', backdropFilter: 'blur(20px)',
        borderRadius: 20, border: '1px solid rgba(0, 82, 255, 0.35)',
        boxShadow: '0 4px 24px rgba(0, 82, 255, 0.10)',
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
