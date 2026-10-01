import React, { useState } from 'react';
import '../styles/upgradeSplash.css';

const ADMIN_WALLETS = [
  '0x4c91d3bed372c11795b9ce9a9017dfe447bf050a'
];

export function UpgradeSplashPage({
  privyUser,
  onLogin,
  onLogout,
  onBypassAdmin
}) {
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);

  const currentAddress = privyUser?.wallet?.address?.toLowerCase();
  const isAdminConnected = currentAddress && ADMIN_WALLETS.some(w => w.toLowerCase() === currentAddress);

  const handlePasscodeSubmit = (e) => {
    e.preventDefault();
    if (passcode.trim() === 'hh2026' || passcode.trim() === 'happyhour' || passcode.trim() === 'admin') {
      onBypassAdmin();
    } else {
      setPasscodeError(true);
      setTimeout(() => setPasscodeError(false), 2000);
    }
  };

  return (
    <div className="splash-wrapper">
      {/* Background Stardust & Orbit Rings */}
      <div className="splash-bg-decorations">
        <div className="splash-orbit-ring splash-orbit-1" />
        <div className="splash-orbit-ring splash-orbit-2" />
        <div className="splash-orbit-ring splash-orbit-3" />
        
        {/* Subtle decorative particles */}
        <div className="splash-dust-particle" style={{ top: '20%', left: '15%', width: '3px', height: '3px' }} />
        <div className="splash-dust-particle" style={{ top: '35%', left: '80%', width: '2px', height: '2px', opacity: 0.35 }} />
        <div className="splash-dust-particle" style={{ top: '65%', left: '25%', width: '4px', height: '4px', opacity: 0.2 }} />
        <div className="splash-dust-particle" style={{ top: '80%', left: '70%', width: '3px', height: '3px' }} />
      </div>

      {/* Top Multi-layer Marquee Ticker */}
      <div className="splash-marquee-container">
        <div className="splash-marquee-track">
          {[1, 2, 3].map((loop) => (
            <React.Fragment key={loop}>
              <div className="splash-marquee-item">
                <span className="dot" />
                <span className="highlight">TRADE TO WIN</span>
              </div>
              <div className="splash-marquee-item">
                <span className="dot" />
                <span>DAILY ON-CHAIN STOCK RAFFLES</span>
              </div>
              <div className="splash-marquee-item">
                <span className="dot" />
                <span className="highlight">POWERED BY MEGAPOT</span>
              </div>
              <div className="splash-marquee-item">
                <span className="dot" />
                <span>FEEL.CASH TOKENOMICS</span>
              </div>
              <div className="splash-marquee-item">
                <span className="dot" />
                <span className="highlight">BUILT ON BASE L2</span>
              </div>
              <div className="splash-marquee-item">
                <span className="dot" />
                <span>V3 UPGRADE IN PROGRESS</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Header */}
      <header className="splash-header">
        <div className="splash-logo-box">
          <div className="splash-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <div className="splash-logo-title">
            HAPPY HOUR
            <span className="splash-logo-badge">V3 UPGRADE</span>
          </div>
        </div>

        <div>
          {privyUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.86rem', color: 'var(--splash-text-secondary)', fontFamily: 'var(--splash-font-mono)' }}>
                {privyUser.wallet?.address ? `${privyUser.wallet.address.slice(0, 6)}...${privyUser.wallet.address.slice(-4)}` : 'Connected'}
              </span>
              <button onClick={onLogout} className="splash-btn-secondary" style={{ padding: '8px 16px', fontSize: '0.80rem' }}>
                Sign Out
              </button>
            </div>
          ) : (
            <button onClick={onLogin} className="splash-btn-secondary">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Admin Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Hero Container */}
      <main className="splash-main">
        {/* Status Pill Badge with Live Pulse */}
        <div className="splash-status-pill">
          <div className="splash-live-dot" />
          <span>COOKING NEW UPGRADE · MAINTENANCE ACTIVE</span>
        </div>

        {/* Hero Card Container (XL Radius 36px) */}
        <div className="splash-hero-card">
          <div className="splash-slogan-pill">
            🔥 TRADE TO WIN
          </div>

          <h1 className="splash-hero-title">
            WE ARE COOKING<br />AN UPGRADE
          </h1>

          <div className="splash-hero-tagline">
            where trading meets <span className="accent-word">real-world stock jackpots</span>
          </div>

          <p className="splash-hero-desc">
            We are completely overhauling Happy Hour into a streamlined, high-stakes on-chain stock lottery platform. 
            Trade our token on Feel.cash to automatically earn daily Megapot jackpot tickets for Apple, Nvidia, and Tesla shares.
          </p>

          {/* Feature Sneak Peek Grid */}
          <div className="splash-feature-grid">
            <div className="splash-feature-card">
              <div className="splash-feature-icon-box">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div className="splash-feature-title">Daily Stock Prizes</div>
              <div className="splash-feature-desc">
                Daily prize pools backed by tokenized stocks (AAPL, NVDA, TSLA) on Base L2.
              </div>
            </div>

            <div className="splash-feature-card">
              <div className="splash-feature-icon-box">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div className="splash-feature-title">Megapot Engine</div>
              <div className="splash-feature-desc">
                Fully on-chain randomness (Pyth VRF) with $200M+ volume security standard.
              </div>
            </div>

            <div className="splash-feature-card">
              <div className="splash-feature-icon-box">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              </div>
              <div className="splash-feature-title">Feel.cash Volume Rewards</div>
              <div className="splash-feature-desc">
                Automatic ticket distribution calculated directly from token trading & holding.
              </div>
            </div>
          </div>

          {/* Admin Bypass Controls if Admin is Connected */}
          {isAdminConnected && (
            <div className="splash-admin-badge-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10B981', fontWeight: 700 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span>Admin Wallet Verified (Owner Mode)</span>
              </div>
              <button onClick={onBypassAdmin} className="splash-btn-primary">
                Enter Admin Workspace ↗
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="splash-footer">
        <div>
          © 2026 Happy Hour · Built on Base
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ opacity: 0.7 }}>Powering the next era of On-Chain Raffles</span>
          <button
            onClick={() => setIsPasscodeModalOpen(true)}
            title="Admin Passcode Access"
            style={{ background: 'transparent', border: 'none', color: 'var(--splash-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </button>
        </div>
      </footer>

      {/* Secret Admin Passcode Modal */}
      {isPasscodeModalOpen && (
        <div className="splash-modal-overlay" onClick={() => setIsPasscodeModalOpen(false)}>
          <div className="splash-modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h3 style={{ fontFamily: 'var(--splash-font-display)', fontSize: '1.25rem', color: '#FFF' }}>
                ADMIN ACCESS
              </h3>
              <button
                onClick={() => setIsPasscodeModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '0.88rem', color: 'var(--splash-text-secondary)', lineHeight: 1.5 }}>
              Enter developer passcode to bypass the maintenance splash screen and test updates.
            </p>

            <form onSubmit={handlePasscodeSubmit}>
              <input
                type="password"
                placeholder="Enter passcode (e.g. hh2026)"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="splash-modal-input"
                autoFocus
              />
              {passcodeError && (
                <div style={{ color: '#F87171', fontSize: '0.82rem', marginBottom: '14px', fontWeight: 600 }}>
                  Incorrect passcode. Try again.
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsPasscodeModalOpen(false)}
                  className="splash-btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="splash-btn-primary" style={{ padding: '10px 24px' }}>
                  Unlock ↗
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
