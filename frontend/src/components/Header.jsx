import { BaseMark } from './BaseMark'

const short = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '')

export function Header({ tab, address, isConnected, displayName, isClubMember, hhBalance, hpBalance, streakCount, onRequireWallet, setIsMobileSidebarOpen }) {
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
    hhIntro: '$HH Introduction',
    hhChart: '$HH Chart',
    hhSwap: '$HH Swap'
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
          <div className="desktop-stat" style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(59, 130, 246, 0.06)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            borderRadius: 14,
            padding: '6px 12px',
            fontSize: 12.5,
            fontWeight: 700,
            color: '#FFFFFF'
          }}>
            <BaseMark size={14} color="#3B82F6" />
            <span>{displayName || short(address)}</span>
            {isClubMember && (
              <span style={{ 
                fontSize: 10, 
                marginLeft: 2, 
                animation: 'floatingLogo 3s ease-in-out infinite' 
              }}>👑</span>
            )}
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
