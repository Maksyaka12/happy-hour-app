import { useDisconnect } from 'wagmi'
import { UserAvatar } from './UserAvatar'
import { HappyHourLogo } from './HappyHourLogo'

const short = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '')

export function Sidebar({ tab, setTab, address, isConnected, displayName, isClubMember, onRequireWallet }) {
  const { disconnect } = useDisconnect()

  const tabs = [
    {
      id: 'raffle',
      name: 'Happy Raffle',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path>
          <path d="M13 5v14"></path>
        </svg>
      )
    },
    {
      id: 'earn',
      name: 'Staking',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23"></line>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
      )
    },
    {
      id: 'contests',
      name: 'Campaigns',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
          <path d="M4 22h16"></path>
          <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"></path>
          <path d="M12 2a4 4 0 0 1 4 4v6H8V6a4 4 0 0 1 4-4Z"></path>
        </svg>
      )
    },
    {
      id: 'home',
      name: 'Profile',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
          <circle cx="12" cy="7" r="4"></circle>
        </svg>
      )
    }
  ]

  const resources = [
    {
      name: 'Docs',
      url: '/docs',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
        </svg>
      )
    },
    {
      name: 'Telegram',
      url: 'https://t.me/happyhourapp',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      )
    },
    {
      name: 'Follow on X',
      url: 'https://x.com/happyhour_base',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      )
    },
    {
      name: 'DexScreener',
      url: 'https://dexscreener.com/base/0xe186aa00d52844ed05d1b1373fc2ec8b0562d613f9f4b470ee7fafa0c1a388f9',
      logo: '/dexscreener.jpg'
    },
    {
      name: 'GeckoTerminal',
      url: 'https://www.geckoterminal.com/uk/base/pools/0xe186aa00d52844ed05d1b1373fc2ec8b0562d613f9f4b470ee7fafa0c1a388f9',
      logo: '/geckoterminal.jpg'
    },
    {
      name: 'CoinGecko',
      url: 'https://www.coingecko.com/en/coins/happy-hour',
      logo: '/CoinGecko-logo.png'
    }
  ]

  return (
    <aside style={{
      width: 260,
      background: '#0B0F19',
      borderRight: '1px solid rgba(255, 255, 255, 0.08)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      fontFamily: "'Inter', sans-serif",
      color: '#94A3B8',
      userSelect: 'none',
      flexShrink: 0
    }}>
      {/* Brand Header */}
      <div style={{
        padding: '24px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
        cursor: 'pointer'
      }} onClick={() => setTab('raffle')}>
        <HappyHourLogo size={28} />
        <span style={{
          fontSize: 18,
          fontWeight: 800,
          color: '#FFFFFF',
          letterSpacing: '-0.5px'
        }}>
          happy <span style={{ color: '#3B82F6' }}>hour</span>
        </span>
      </div>

      {/* Main navigation scroll area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 24
      }}>
        {/* Platform Section */}
        <div>
          <div style={{
            fontSize: 10.5,
            fontWeight: 800,
            color: '#475569',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            paddingLeft: 12,
            marginBottom: 8
          }}>
            Platform
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {tabs.map(t => {
              const active = tab === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 12,
                    border: 'none',
                    background: active ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                    color: active ? '#FFFFFF' : '#94A3B8',
                    fontSize: 13.5,
                    fontWeight: active ? 700 : 550,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                      e.currentTarget.style.color = '#E2E8F0';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!active) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#94A3B8';
                    }
                  }}
                >
                  <div style={{
                    color: active ? '#3B82F6' : '#64748B',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    {t.icon}
                  </div>
                  <span>{t.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Resources Section */}
        <div>
          <div style={{
            fontSize: 10.5,
            fontWeight: 800,
            color: '#475569',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            paddingLeft: 12,
            marginBottom: 8
          }}>
            Resources
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {resources.map((r, i) => (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '9px 12px',
                  borderRadius: 12,
                  color: '#94A3B8',
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.color = '#E2E8F0';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#94A3B8';
                }}
              >
                <div style={{
                  color: '#64748B',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 18,
                  height: 18,
                  borderRadius: r.logo ? '50%' : 'none',
                  overflow: r.logo ? 'hidden' : 'visible'
                }}>
                  {r.logo ? (
                    <img src={r.logo} alt={r.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    r.icon
                  )}
                </div>
                <span>{r.name}</span>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Profile Block */}
      <div style={{
        padding: '16px 14px',
        borderTop: '1px solid rgba(255, 255, 255, 0.04)',
        background: '#090D16'
      }}>
        {isConnected && address ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* User Avatar */}
            <UserAvatar address={address} size={36} />

            {/* User Meta */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13,
                fontWeight: 700,
                color: '#FFFFFF',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {displayName || short(address)}
              </div>
              <div style={{
                fontSize: 10.5,
                fontWeight: 650,
                color: isClubMember ? '#0000FF' : '#64748B',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginTop: 2
              }}>
                {isClubMember ? (
                  <>
                    <img src="/logo_200.png" alt="HH" style={{ width: 14, height: 14, borderRadius: '50%' }} />
                    <span>Happy Club Member</span>
                  </>
                ) : (
                  <span>Standard User</span>
                )}
              </div>
            </div>

            {/* Logout Trigger */}
            <button
              onClick={() => disconnect()}
              title="Logout Wallet"
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                borderRadius: 8,
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#EF4444',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                flexShrink: 0
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </button>
          </div>
        ) : (
          <button
            onClick={onRequireWallet}
            style={{
              width: '100%',
              background: '#3B82F6',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 12,
              padding: '11px 16px',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
              transition: 'all 0.25s'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#2563EB';
              e.currentTarget.style.boxShadow = '0 6px 18px rgba(59, 130, 246, 0.35)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#3B82F6';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.25)';
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-3"></path>
              <circle cx="18" cy="12" r="1"></circle>
            </svg>
            <span>Connect Wallet</span>
          </button>
        )}
      </div>
    </aside>
  )
}
