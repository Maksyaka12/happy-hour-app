import { BaseMark } from './BaseMark'

const short = (a) => (a ? `${a.slice(0, 6)}...${a.slice(-4)}` : '')

export function Header({ tab, address, isConnected, displayName, isClubMember, usdcBalance, onRequireWallet }) {
  const tabNames = {
    home: 'Profile',
    raffle: 'Happy Raffle',
    earn: 'Staking',
    contests: 'Campaigns'
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
      {/* Tab Title */}
      <h1 style={{
        margin: 0,
        fontSize: 18,
        fontWeight: 800,
        color: '#FFFFFF',
        letterSpacing: '-0.3px'
      }}>
        {tabNames[tab] || 'Platform'}
      </h1>

      {/* Top right actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* USDC Balance block */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 14,
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <span style={{ fontSize: 12.5, fontWeight: 750, color: '#FFFFFF', fontFamily: "'DM Mono', monospace" }}>
            {usdcBalance}
          </span>
          <img src="/usdc-logo.png" alt="USDC" style={{ width: 13, height: 13, display: 'block' }} />
        </div>

        {/* Connect Button or User Info */}
        {isConnected && address ? (
          <div style={{
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
              transition: 'all 0.2s'
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
