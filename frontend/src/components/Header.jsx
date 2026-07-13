import { BaseMark } from './BaseMark'

const short = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '')

// Returns { label, icon } for the user's primary login method
function getLoginIdentity(privyUser, address, displayName) {
  if (!privyUser || !privyUser.linkedAccounts || privyUser.linkedAccounts.length === 0) {
    return { label: displayName || short(address), icon: null }
  }

  // Sort linked accounts by latestVerifiedAt to find the most recently used login method
  const sortedAccounts = [...privyUser.linkedAccounts].sort((a, b) => {
    const timeA = a.latestVerifiedAt ? new Date(a.latestVerifiedAt).getTime() : (a.firstVerifiedAt ? new Date(a.firstVerifiedAt).getTime() : 0);
    const timeB = b.latestVerifiedAt ? new Date(b.latestVerifiedAt).getTime() : (b.firstVerifiedAt ? new Date(b.firstVerifiedAt).getTime() : 0);
    return timeB - timeA;
  });

  const activeAccount = sortedAccounts[0];

  if (activeAccount.type === 'twitter_oauth') {
    return {
      label: `@${activeAccount.username}`,
      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
    }
  }
  if (activeAccount.type === 'telegram') {
    const tgName = activeAccount.username || activeAccount.firstName || `TG ${activeAccount.telegramUserId}`
    return {
      label: `@${tgName}`,
      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.12.03-1.99 1.26-5.61 3.71-.53.37-1.01.55-1.44.54-.48-.01-1.39-.27-2.07-.49-.83-.27-1.49-.41-1.43-.87.03-.24.36-.49.98-.75 3.84-1.67 6.4-2.77 7.68-3.3 3.65-1.51 4.41-1.78 4.9-1.79.11 0 .36.03.52.16.14.11.18.26.19.37.01.07.02.24.01.35z"/></svg>
    }
  }
  if (activeAccount.type === 'email') {
    return {
      label: activeAccount.address,
      icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
    }
  }
  
  // Default to wallet or display name
  return { label: displayName || short(address), icon: null }
}

export function Header({ tab, address, isConnected, displayName, isClubMember, hhBalance, hpBalance, streakCount, onRequireWallet, setIsMobileSidebarOpen, privyUser }) {
  const tabNames = {
    home: 'Profile',
    raffle: 'Hourly Lottery',
    dailyRaffle: 'Big Daily Lottery',
    earn: 'Staking',
    contests: 'Campaigns',
    terms: 'Terms of Service',
    affiliate: 'Happy Hour Affiliate',
    privacy: 'Privacy Policy',
    skills: 'Skills',
    agentChat: 'Agent Chat',
    x402: 'x402 Endpoints',
    link: 'Linked accounts',
    account: 'Account',
    hhIntro: '$HH',
    hhChart: '$HH Chart',
    hhSwap: '$HH Swap',
    wallet: 'Wallet'
  }

  return (
    <header style={{
      height: 72,
      background: 'var(--bg2)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      position: 'sticky',
      top: 0,
      zIndex: 40,
      color: '#FFFFFF',
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Left side: Hamburger + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button 
          onClick={() => setIsMobileSidebarOpen(true)}
          className="mobile-hamburger"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#FFFFFF',
            cursor: 'pointer',
            padding: 8,
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none'
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        <h1 style={{
          margin: 0,
          fontSize: 18,
          fontWeight: 800,
          color: '#FFFFFF',
          letterSpacing: '-0.3px'
        }}>
          {tabNames[tab] || 'Platform'}
        </h1>
      </div>

      {/* Top right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* ================= DESKTOP STATS (Always visible on desktop, hidden on mobile) ================= */}
        <div className="desktop-stat" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Daily Streak */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 14,
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
            </svg>
            <span style={{ fontSize: 13, fontWeight: 750, color: '#FFFFFF', fontFamily: "'DM Mono', monospace" }}>
              {isConnected ? (streakCount || 0) : 0}
            </span>
          </div>

          {/* HP Balance */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 14,
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span style={{ fontSize: 13, fontWeight: 750, color: '#FFFFFF', fontFamily: "'DM Mono', monospace" }}>
              {isConnected ? (hpBalance || 0) : 0} HP
            </span>
            <img src="/logo.jfif" alt="HP" style={{ width: 16, height: 16, borderRadius: '50%' }} />
          </div>

          {/* $HH Balance */}
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 14,
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <span style={{ fontSize: 13, fontWeight: 750, color: '#FFFFFF', fontFamily: "'DM Mono', monospace" }}>
              {isConnected ? (hhBalance || 0) : 0} $HH
            </span>
            <img src="/logo.jfif" alt="$HH" style={{ width: 16, height: 16, borderRadius: '50%' }} />
          </div>
        </div>

        {/* ================= MOBILE STATS (Only visible on mobile when connected, hidden on desktop) ================= */}
        {isConnected && address && (
          <div className="mobile-only-flex" style={{ display: 'none', alignItems: 'center', gap: 8 }}>
            {/* Daily Streak */}
            {streakCount > 0 && (
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 14,
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
                </svg>
                <span style={{ fontSize: 13, fontWeight: 750, color: '#FFFFFF', fontFamily: "'DM Mono', monospace" }}>
                  {streakCount}
                </span>
              </div>
            )}

            {/* $HH Balance */}
            <div style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 14,
              padding: '6px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}>
              <span style={{ fontSize: 13, fontWeight: 750, color: '#FFFFFF', fontFamily: "'DM Mono', monospace" }}>
                {hhBalance || 0}
              </span>
              <img src="/logo.jfif" alt="$HH" style={{ width: 16, height: 16, borderRadius: '50%' }} />
            </div>
          </div>
        )}

        {/* Connect Button or User Info */}
        {isConnected && address ? (
          <div className="desktop-stat" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(59, 130, 246, 0.06)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: 14, padding: '6px 12px', fontSize: 12.5, fontWeight: 700, color: '#FFFFFF' }}>
            <BaseMark size={14} color="#3B82F6" />
            {(() => {
              const { label, icon } = getLoginIdentity(privyUser, address, displayName)
              return (
                <>
                  {icon && <span style={{ display: 'flex', alignItems: 'center', opacity: 0.8 }}>{icon}</span>}
                  <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
                </>
              )
            })()}
            {isClubMember && <span style={{ fontSize: 10, marginLeft: 2, animation: 'floatingLogo 3s ease-in-out infinite' }}>👑</span>}
          </div>
        ) : (
          <button
            onClick={onRequireWallet}
            style={{
              background: '#3B82F6',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 14,
              padding: '8px 16px',
              fontSize: 12.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
              transition: 'all 0.2s',
              outline: 'none'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = '#2563EB';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(59, 130, 246, 0.3)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = '#3B82F6';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.2)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-3"></path>
              <circle cx="18" cy="12" r="1"></circle>
            </svg>
            <span>Connect Wallet</span>
          </button>
        )}
      </div>
    </header>
  )
}
