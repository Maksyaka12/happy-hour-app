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

const NAV_ICONS = {
  raffle: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      <line x1="12" y1="12" x2="12" y2="16"/>
      <line x1="10" y1="14" x2="14" y2="14"/>
    </svg>
  ),
  contests: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"/>
      <path d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
      <path d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"/>
      <path d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"/>
      <path d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"/>
      <path d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"/>
      <path d="M10 9.5c0 .83-.67 1.5-1.5 1.5h-5C2.67 11 2 10.33 2 9.5S2.67 8 3.5 8h5c.83 0 1.5.67 1.5 1.5z"/>
      <path d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"/>
    </svg>
  ),
  earn: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  ),
  home: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
}

export function BottomNav({ tab, setTab }) {
  const tabs = [
    { id: 'raffle',   label: 'Raffle',    icon: NAV_ICONS.raffle },
    { id: 'contests', label: 'Campaigns', icon: NAV_ICONS.contests },
    { id: 'earn',     label: 'Staking',   icon: NAV_ICONS.earn },
    { id: 'home',     label: 'Profile',   icon: NAV_ICONS.home },
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
      <style>{`
        @keyframes navBadgePulse {
          0%, 100% { transform: scale(1); filter: brightness(1); }
          50% { transform: scale(1.05); filter: brightness(1.1); box-shadow: 0 2px 6px rgba(239, 68, 68, 0.5); }
        }
      `}</style>
      <div style={{
        background: 'rgba(235, 242, 255, 0.97)', backdropFilter: 'blur(20px)',
        borderRadius: 20, border: '1px solid rgba(0, 82, 255, 0.35)',
        boxShadow: '0 4px 24px rgba(0, 82, 255, 0.10)',
        display: 'flex', padding: '5px 6px',
        pointerEvents: 'all', maxWidth: 480, margin: '0 auto',
      }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            padding: '6px 2px 5px', borderRadius: 14, border: 'none', cursor: 'pointer',
            background: tab === t.id ? '#EEF0F3' : 'transparent',
            outline: tab === t.id ? '1px solid rgba(0,0,255,0.15)' : 'none',
            transition: 'all 0.2s',
            position: 'relative',
            color: tab === t.id ? '#0000FF' : '#717886',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>{t.icon}</span>
            <span style={{
              fontSize: 8.5, fontWeight: 700, letterSpacing: 0.1,
              color: tab === t.id ? '#0000FF' : '#717886',
            }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
