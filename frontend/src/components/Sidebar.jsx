import { useState, useEffect } from 'react'
import { useDisconnect } from 'wagmi'
import { UserAvatar } from './UserAvatar'
import { HappyHourLogo } from './HappyHourLogo'

const short = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '')

export function Sidebar({ tab, setTab, address, isConnected, displayName, isClubMember, onRequireWallet, onLogout, isMobileSidebarOpen, setIsMobileSidebarOpen, privyUser, isAdmin }) {

  // Returns { label, icon } based on how user is logged in
  const getLoginIdentity = () => {
    if (!privyUser || !privyUser.linkedAccounts || privyUser.linkedAccounts.length === 0) {
      return { label: displayName || (address ? `${address.slice(0,6)}…${address.slice(-4)}` : ''), icon: null }
    }

    // Sort linked accounts by latestVerifiedAt to find the most recently used login method
    const sortedAccounts = [...privyUser.linkedAccounts].sort((a, b) => {
      const timeA = a.latestVerifiedAt ? new Date(a.latestVerifiedAt).getTime() : (a.firstVerifiedAt ? new Date(a.firstVerifiedAt).getTime() : 0);
      const timeB = b.latestVerifiedAt ? new Date(b.latestVerifiedAt).getTime() : (b.firstVerifiedAt ? new Date(b.firstVerifiedAt).getTime() : 0);
      return timeB - timeA;
    });

    const activeAccount = sortedAccounts[0];

    if (activeAccount.type === 'twitter_oauth') {
      return { label: `@${activeAccount.username}`, icon: 'x' }
    }
    if (activeAccount.type === 'telegram') {
      const tgName = activeAccount.username || activeAccount.firstName || `TG ${activeAccount.telegramUserId}`;
      return { label: `@${tgName}`, icon: 'tg' }
    }
    if (activeAccount.type === 'email') {
      return { label: activeAccount.address, icon: 'email' }
    }
    
    // For wallet or any other fallback
    return { label: displayName || (address ? `${address.slice(0,6)}…${address.slice(-4)}` : ''), icon: null }
  }

  const loginIdentity = getLoginIdentity()

  const { disconnect } = useDisconnect()

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)

  const [isCollapsedRaw, setIsCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar_collapsed')
      if (saved !== null) return saved === 'true'
      return false
    } catch { return false }
  })

  const [isPlatformOpen, setIsPlatformOpen] = useState(true)
  const [isHhCoinOpen, setIsHhCoinOpen] = useState(true)
  const [isToolsOpen, setIsToolsOpen] = useState(true)
  const [isResourcesOpen, setIsResourcesOpen] = useState(true)
  const [isSocialsOpen, setIsSocialsOpen] = useState(true)
  const [isDexOpen, setIsDexOpen] = useState(true)

  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const isCollapsed = isCollapsedRaw && !isMobile

  useEffect(() => {
    try { localStorage.setItem('sidebar_collapsed', isCollapsedRaw) } catch {}
  }, [isCollapsedRaw])

  const tabs = [
    {
      id: 'raffle',
      name: 'Hourly Lottery',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"></path>
          <path d="M13 5v14"></path>
        </svg>
      )
    },
    {
      id: 'dailyRaffle',
      name: 'Big Daily Lottery',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      )
    },
    {
      id: 'earn',
      name: 'Staking',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
          <path d="M12 18V6"></path>
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
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
        </svg>
      )
    },
    {
      id: 'affiliate',
      name: 'Affiliate Program',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
        </svg>
      )
    },
    {
      id: 'terms',
      name: 'Terms of Service',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      )
    },
    {
      id: 'privacy',
      name: 'Privacy Policy',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      )
    }
  ]

  const tools = [
    {
      id: 'wallet',
      name: 'Wallet',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2"/>
          <path d="M16 11h2"/>
          <path d="M6 3l6-3 6 3"/>
        </svg>
      )
    },
    {
      id: 'agentChat',
      name: 'Agent Chat',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      )
    },
    {
      id: 'skills',
      name: 'Skills',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6"></polyline>
          <polyline points="8 6 2 12 8 18"></polyline>
        </svg>
      )
    },
    {
      id: 'x402',
      name: 'x402 Endpoints',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
        </svg>
      )
    },
    {
      id: 'happyHourBot',
      name: 'HappyHourBot',
      url: 'https://t.me/happyhourbased_bot',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      )
    }
  ]

  const socials = [
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
      name: 'Founder / Developer',
      url: 'https://x.com/mksvibe',
      icon: (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      )
    }
  ]
  const dexItems = [
    {
      name: 'Dexscreener',
      url: 'https://dexscreener.com/base/0xe186aa00d52844ed05d1b1373fc2ec8b0562d613f9f4b470ee7fafa0c1a388f9',
      logo: '/dexscreener.jpg'
    },
    {
      name: 'GeckoTerminal',
      url: 'https://www.geckoterminal.com/base/pools/0xe186aa00d52844ed05d1b1373fc2ec8b0562d613f9f4b470ee7fafa0c1a388f9',
      logo: '/geckoterminal.jpg'
    },
    {
      name: 'Coingecko',
      url: 'https://www.coingecko.com/en/coins/happy-hour',
      logo: '/CoinGecko-logo.png'
    },
    {
      name: 'BankrTerminal',
      url: 'https://bankr.bot/terminal/agents/0x8235edf32a1e10bd1867ad622915ab613664cba3',
      logo: '/bankr-logo.jpg'
    }
  ]
  const hhCoinItems = [
    {
      id: 'hhIntro',
      name: '$HH',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="16" x2="12" y2="12"></line>
          <line x1="12" y1="8" x2="12.01" y2="8"></line>
        </svg>
      )
    },
    {
      id: 'hhChart',
      name: '$HH Chart',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="20" x2="18" y2="10"></line>
          <line x1="12" y1="20" x2="12" y2="4"></line>
          <line x1="6" y1="20" x2="6" y2="14"></line>
        </svg>
      )
    },
    {
      id: 'hhSwap',
      name: '$HH Swap',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m16 3 4 4-4 4"></path>
          <path d="M20 7H9a4 4 0 0 0-4 4v3"></path>
          <path d="m8 21-4-4 4-4"></path>
          <path d="M4 17h11a4 4 0 0 0 4-4v-3"></path>
        </svg>
      )
    },
    {
      name: '$HH Economy',
      url: '/docs/economy',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20"></path>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
      )
    },
    {
      name: '$HH Utility',
      url: '/docs/utility',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
      )
    }
  ]

  return (
    <aside 
      className={`sidebar-container ${isMobileSidebarOpen ? 'open' : ''}`}
      style={{
        width: isCollapsed ? 68 : 260,
        background: 'var(--bg2)',
        borderRight: '1px solid var(--border)',
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
        height: 72,
        padding: isCollapsed ? '0' : '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        borderBottom: '1px solid var(--border)',
        boxSizing: 'border-box'
      }}>
        <div onClick={() => setTab('raffle')} style={{ 
          display: isCollapsed ? 'none' : 'flex', 
          alignItems: 'center', 
          gap: 10, 
          cursor: 'pointer' 
        }}>
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
        
        {isCollapsed && (
          <div onClick={() => setTab('raffle')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <HappyHourLogo size={28} />
          </div>
        )}

        <button 
          onClick={() => {
            if (isMobile) {
              setIsMobileSidebarOpen(false)
            } else {
              setIsCollapsed(!isCollapsedRaw)
            }
          }}
          className="collapse-btn"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text2)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 4,
            borderRadius: 6,
            marginLeft: isCollapsed ? 0 : 8,
            outline: 'none'
          }}
        >
          {isMobile ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : isCollapsedRaw ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
          )}
        </button>
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
          {!isCollapsed && (
            <div 
              onClick={() => setIsPlatformOpen(!isPlatformOpen)}
              style={{
                fontSize: 14.5,
                fontWeight: 600,
                color: '#8A8F9E',
                padding: '4px 12px',
                marginBottom: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                userSelect: 'none'
              }}
            >
              Platform
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isPlatformOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          )}
          {(isPlatformOpen || isCollapsed) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {tabs.map(t => {
              const active = tab === t.id
              // Platform tabs that are coming soon for non-admins
              const isSoon = !isAdmin && t.id !== 'earn'
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isCollapsed ? 'center' : 'flex-start',
                    gap: isCollapsed ? 0 : 12,
                    width: '100%',
                    padding: isCollapsed ? '10px 0' : '10px 12px',
                    borderRadius: 12,
                    border: 'none',
                    background: active ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                    color: active ? '#FFFFFF' : isSoon ? 'rgba(193,196,205,0.4)' : '#C1C4CD',
                    fontSize: 14.5,
                    fontWeight: 500,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    opacity: isSoon ? 0.65 : 1
                  }}
                  onMouseEnter={e => { if (!active && !isSoon) { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'; e.currentTarget.style.color = '#FFFFFF'; } }}
                  onMouseLeave={e => { if (!active && !isSoon) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#C1C4CD'; } }}
                >
                  <div style={{ color: active ? '#3B82F6' : isSoon ? 'rgba(138,143,158,0.4)' : '#8A8F9E', display: 'flex', alignItems: 'center' }}>
                    {t.icon}
                  </div>
                  {!isCollapsed && (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{t.name}</span>
                      {isSoon && <span style={{ fontSize: 9, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.05em' }}>SOON</span>}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        )}
        </div>

        {/* Tools Section */}
        <div>
          {!isCollapsed && (
            <div 
              onClick={() => setIsToolsOpen(!isToolsOpen)}
              style={{
                fontSize: 14.5,
                fontWeight: 600,
                color: '#717886',
                padding: '4px 12px',
                marginBottom: 4,
                marginTop: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                userSelect: 'none'
              }}
            >
              Tools
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isToolsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          )}
          {(isToolsOpen || isCollapsed) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {tools.map(t => {
                const active = tab === t.id
                const isSoon = !isAdmin && !!t.id // all tools are coming soon for non-admins
                return (
                  <button
                    key={t.id || t.name}
                    onClick={() => {
                      if (isSoon && t.url) return;
                      if (t.url) { window.open(t.url, '_blank') }
                      else { setTab(t.id) }
                    }}
                    style={{
                      display: 'flex', alignItems: 'center',
                      justifyContent: isCollapsed ? 'center' : 'flex-start',
                      gap: isCollapsed ? 0 : 12, width: '100%',
                      padding: isCollapsed ? '10px 0' : '10px 12px',
                      borderRadius: 12, border: 'none',
                      background: active ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                      color: active ? '#FFFFFF' : isSoon ? 'rgba(193,196,205,0.4)' : '#C1C4CD',
                      fontSize: 14.5, fontWeight: 500, fontFamily: 'inherit',
                      cursor: (isSoon && t.url) ? 'default' : 'pointer', transition: 'all 0.15s ease',
                      opacity: isSoon ? 0.65 : 1
                    }}
                    onMouseEnter={e => { if (!active && !isSoon) { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'; e.currentTarget.style.color = '#FFFFFF'; } }}
                    onMouseLeave={e => { if (!active && !isSoon) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#C1C4CD'; } }}
                  >
                    <div style={{ color: active ? '#3B82F6' : isSoon ? 'rgba(138,143,158,0.4)' : '#8A8F9E', display: 'flex', alignItems: 'center' }}>
                      {t.icon}
                    </div>
                    {!isCollapsed && (
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>{t.name}</span>
                        {isSoon
                          ? <span style={{ fontSize: 9, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.05em' }}>SOON</span>
                          : t.url && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
                        }
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* $HH Native Coin Section */}
        <div>
          {!isCollapsed && (
            <div 
              onClick={() => setIsHhCoinOpen(!isHhCoinOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 12px',
                marginBottom: 8,
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
              <span style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: '#64748B'
              }}>
                $HH Native Coin
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isHhCoinOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          )}
          {(isHhCoinOpen || isCollapsed) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {hhCoinItems.map((r, i) => {
              const isButton = !!r.id;
              const active = isButton && tab === r.id;
              const isSoon = !isAdmin // all $HH internal pages and external links are coming soon
              const Component = isButton ? 'button' : 'a';
              const baseStyle = {
                display: 'flex', alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                gap: isCollapsed ? 0 : 12, width: '100%',
                padding: isCollapsed ? '10px 0' : '10px 12px',
                borderRadius: 12,
                color: active ? '#FFFFFF' : isSoon ? 'rgba(193,196,205,0.4)' : '#C1C4CD',
                fontSize: 14.5, fontWeight: 500,
                textDecoration: 'none', boxSizing: 'border-box',
                transition: 'all 0.15s ease',
                opacity: isSoon ? 0.65 : 1
              };
              const props = isButton ? {
                key: r.id,
                onClick: () => setTab(r.id),
                style: { ...baseStyle, background: active ? 'rgba(59, 130, 246, 0.08)' : 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }
              } : {
                key: r.name, href: isSoon ? undefined : r.url, target: isSoon ? undefined : "_blank", rel: "noopener noreferrer",
                onClick: (e) => { if (isSoon) e.preventDefault() },
                style: { ...baseStyle, cursor: isSoon ? 'default' : 'pointer' }
              };
              return (
                <Component
                  {...props}
                  onMouseEnter={e => { if (!active && !isSoon) { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'; e.currentTarget.style.color = '#FFFFFF'; } }}
                  onMouseLeave={e => { if (!active && !isSoon) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#C1C4CD'; } }}
                >
                  <div style={{ color: active ? '#3B82F6' : isSoon ? 'rgba(138,143,158,0.4)' : '#8A8F9E', display: 'flex', alignItems: 'center' }}>
                    {r.icon}
                  </div>
                  {!isCollapsed && (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{r.name}</span>
                      {isSoon
                        ? <span style={{ fontSize: 9, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.05em' }}>SOON</span>
                        : !isButton && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
                      }
                    </div>
                  )}
                </Component>
              )
            })}
          </div>
        )}
        </div>

        {/* Resources Section */}
        <div>
          {!isCollapsed && (
            <div 
              onClick={() => setIsResourcesOpen(!isResourcesOpen)}
              style={{
                fontSize: 14.5,
                fontWeight: 600,
                color: '#717886',
                padding: '4px 12px',
                marginBottom: 4,
                marginTop: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                userSelect: 'none'
              }}
            >
              Resources
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isResourcesOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          )}
          {(isResourcesOpen || isCollapsed) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {resources.map((r, i) => {
              const isButton = !!r.id;
              const isSoon = !isAdmin && !['terms', 'privacy'].includes(r.id) // docs and affiliate are coming soon
              const Component = isButton ? 'button' : 'a';
              const baseStyle = {
                display: 'flex', alignItems: 'center',
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                gap: isCollapsed ? 0 : 12, width: '100%',
                padding: isCollapsed ? '9px 0' : '9px 12px',
                borderRadius: 12,
                color: isSoon ? 'rgba(193,196,205,0.4)' : '#C1C4CD',
                fontSize: 14.5, fontWeight: 500,
                textDecoration: 'none', boxSizing: 'border-box',
                transition: 'all 0.15s ease',
                opacity: isSoon ? 0.65 : 1
              };
              const props = isButton ? {
                onClick: () => setTab(r.id),
                style: { ...baseStyle, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }
              } : {
                href: isSoon ? undefined : r.url, target: isSoon ? undefined : "_blank", rel: "noopener noreferrer",
                onClick: (e) => { if (isSoon) e.preventDefault() },
                style: { ...baseStyle, cursor: isSoon ? 'default' : 'pointer' }
              };
              return (
                <Component
                  key={i}
                  {...props}
                  onMouseEnter={e => { if (!isSoon) { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'; e.currentTarget.style.color = '#FFFFFF'; } }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isSoon ? 'rgba(193,196,205,0.4)' : '#C1C4CD'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, color: isSoon ? 'rgba(138,143,158,0.4)' : '#8A8F9E' }}>
                    {r.icon ? r.icon : <img src={r.logo} alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover', opacity: isSoon ? 0.4 : 1 }} />}
                  </div>
                  {!isCollapsed && (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>{r.name}</span>
                      {isSoon
                        ? <span style={{ fontSize: 9, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.05em' }}>SOON</span>
                        : !isButton && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
                      }
                    </div>
                  )}
                </Component>
              )
            })}
            </div>
          )}
        </div>

        {/* DEX Section */}
        <div>
          {!isCollapsed && (
            <div 
              onClick={() => setIsDexOpen(!isDexOpen)}
              style={{
                fontSize: 14.5,
                fontWeight: 600,
                color: '#717886',
                padding: '4px 12px',
                marginBottom: 4,
                marginTop: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                userSelect: 'none'
              }}
            >
              DEX
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isDexOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          )}
          {(isDexOpen || isCollapsed) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {dexItems.map((r, i) => (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  gap: isCollapsed ? 0 : 12,
                  width: '100%',
                  padding: isCollapsed ? '9px 0' : '9px 12px',
                  borderRadius: 12,
                  color: '#C1C4CD',
                  fontSize: 14.5,
                  fontWeight: 500,
                  textDecoration: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#C1C4CD';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20 }}>
                  <img src={r.logo} alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }} />
                </div>
                {!isCollapsed && (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{r.name}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                      <line x1="7" y1="17" x2="17" y2="7"></line>
                      <polyline points="7 7 17 7 17 17"></polyline>
                    </svg>
                  </div>
                )}
              </a>
            ))}
            </div>
          )}
        </div>

        {/* Socials Section */}
        <div>
          {!isCollapsed && (
            <div 
              onClick={() => setIsSocialsOpen(!isSocialsOpen)}
              style={{
                fontSize: 14.5,
                fontWeight: 600,
                color: '#717886',
                padding: '4px 12px',
                marginBottom: 4,
                marginTop: 8,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                userSelect: 'none'
              }}
            >
              Socials
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isSocialsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          )}
          {(isSocialsOpen || isCollapsed) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {socials.map((r, i) => (
              <a
                key={i}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: isCollapsed ? 'center' : 'flex-start',
                  gap: isCollapsed ? 0 : 12,
                  width: '100%',
                  padding: isCollapsed ? '9px 0' : '9px 12px',
                  borderRadius: 12,
                  color: '#C1C4CD',
                  fontSize: 14.5,
                  fontWeight: 500,
                  textDecoration: 'none',
                  boxSizing: 'border-box',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.color = '#FFFFFF';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = '#C1C4CD';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 20, color: '#8A8F9E' }}>
                  {r.icon ? (
                    r.icon
                  ) : (
                    <img src={r.logo} alt="" style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }} />
                  )}
                </div>
                {!isCollapsed && (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{r.name}</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
                      <line x1="7" y1="17" x2="17" y2="7"></line>
                      <polyline points="7 7 17 7 17 17"></polyline>
                    </svg>
                  </div>
                )}
              </a>
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Footer Profile Block */}
      <div style={{
        padding: '16px 14px',
        borderTop: '1px solid rgba(255, 255, 255, 0.04)',
        background: '#090D16'
      }}>
        {isConnected && address ? (
          <div style={{ position: 'relative', width: '100%' }}>
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              style={{
                width: '100%',
                background: isProfileMenuOpen ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                border: 'none',
                borderRadius: 12,
                padding: isCollapsed ? '8px' : '8px 10px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                justifyContent: isCollapsed ? 'center' : 'flex-start',
                cursor: 'pointer',
                transition: 'background 0.2s',
                outline: 'none'
              }}
              onMouseEnter={e => { if(!isProfileMenuOpen) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)' }}
              onMouseLeave={e => { if(!isProfileMenuOpen) e.currentTarget.style.background = 'transparent' }}
            >
              <UserAvatar address={address} size={36} profilePictureUrl={privyUser?.twitter?.profilePictureUrl} shape="square" />
              {!isCollapsed && (
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left', fontFamily: '"Inter", sans-serif' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'flex', alignItems: 'center', gap: 4 }}>
                    {loginIdentity.icon === 'x' && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.8, flexShrink: 0 }}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    )}
                    {loginIdentity.icon === 'tg' && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="#2AABEE" style={{ flexShrink: 0 }}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.12.03-1.99 1.26-5.61 3.71-.53.37-1.01.55-1.44.54-.48-.01-1.39-.27-2.07-.49-.83-.27-1.49-.41-1.43-.87.03-.24.36-.49.98-.75 3.84-1.67 6.4-2.77 7.68-3.3 3.65-1.51 4.41-1.78 4.9-1.79.11 0 .36.03.52.16.14.11.18.26.19.37.01.07.02.24.01.35z"/></svg>
                    )}
                    {loginIdentity.icon === 'email' && (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    )}
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{loginIdentity.label}</span>
                  </div>
                  <div style={{
                    fontSize: 11.5,
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
              )}
              {!isCollapsed && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isProfileMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              )}
            </button>

            {isProfileMenuOpen && (
              <div style={{
                position: 'absolute',
                bottom: 'calc(100% + 8px)',
                left: 0,
                width: isCollapsed ? 200 : '100%',
                background: '#1A1F2E',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12,
                padding: 6,
                boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: 4
              }}>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false)
                    setTab('link')
                  }}
                  style={{
                    width: '100%', background: 'transparent', border: 'none', borderRadius: 8,
                    padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    color: isAdmin ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                    fontSize: 13.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => isAdmin && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                    Linked accounts
                  </div>
                  {!isAdmin && <span style={{ fontSize: 9, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.05em' }}>SOON</span>}
                </button>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false)
                    setTab('account')
                  }}
                  style={{
                    width: '100%', background: 'transparent', border: 'none', borderRadius: 8,
                    padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    color: isAdmin ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                    fontSize: 13.5, fontWeight: 600, cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => isAdmin && (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    Account
                  </div>
                  {!isAdmin && <span style={{ fontSize: 9, fontWeight: 700, color: '#3B82F6', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 4, padding: '1px 5px', letterSpacing: '0.05em' }}>SOON</span>}
                </button>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false)
                    if (onLogout) {
                      onLogout()
                    } else {
                      disconnect()
                    }
                  }}
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: '#EF4444',
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                  </svg>
                  Logout
                </button>
              </div>
            )}
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
              fontSize: 14.5,
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
            {!isCollapsed && <span>Connect Wallet</span>}
          </button>
        )}
      </div>
    </aside>
  )
}
