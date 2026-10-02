import React, { useState } from 'react';
import '../styles/upgradeSplash.css';

const X_URL = 'https://x.com/happyhour_base';
const DEXSCREENER_URL = 'https://dexscreener.com/base/0xe186aa00d52844ed05d1b1373fc2ec8b0562d613f9f4b470ee7fafa0c1a388f9';

export function UpgradeSplashPage({
  privyUser,
  onLogin,
  onLogout,
  onBypassAdmin
}) {
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);

  const handlePasscodeSubmit = (e) => {
    e.preventDefault();
    if (
      passcode.trim() === 'hh2026' ||
      passcode.trim() === 'happyhour' ||
      passcode.trim() === 'admin'
    ) {
      onBypassAdmin();
    } else {
      setPasscodeError(true);
      setTimeout(() => setPasscodeError(false), 2500);
    }
  };

  return (
    <div className="splash-container">
      {/* Background Orbit Rings & Ambient Stardust */}
      <div className="splash-orbit-decorations">
        <div className="splash-orbit splash-orbit-1" />
        <div className="splash-orbit splash-orbit-2" />
        <div className="splash-orbit splash-orbit-3" />
        
        <div className="splash-particle" style={{ top: '22%', left: '18%', width: '3px', height: '3px' }} />
        <div className="splash-particle" style={{ top: '28%', right: '20%', width: '2px', height: '2px', opacity: 0.3 }} />
        <div className="splash-particle" style={{ bottom: '22%', left: '26%', width: '3px', height: '3px' }} />
        <div className="splash-particle" style={{ bottom: '26%', right: '24%', width: '4px', height: '4px', opacity: 0.2 }} />
      </div>

      {/* Main Centered Card Window */}
      <div className="splash-card-window">
        {/* Ambient Top Glow Line */}
        <div className="splash-top-glow" />

        {/* App Logo Squircle */}
        <div className="splash-logo-wrap">
          <img
            src="/logo.png"
            alt="Happy Hour Logo"
            className="splash-logo-img"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = '/logo_200.png';
            }}
          />
        </div>

        {/* Slogan in Serif-Italic */}
        <div className="splash-slogan-serif">
          Trade to Win
        </div>

        {/* Accent Loading Progress Plaque */}
        <div className="splash-progress-card">
          <div className="splash-progress-info">
            <div className="splash-progress-label">
              <span className="splash-status-dot" />
              <span>UPGRADE IN PROGRESS</span>
            </div>
            <span className="splash-progress-tag">LIVE DEPLOYMENT</span>
          </div>
          <div className="splash-progress-track">
            <div className="splash-progress-fill" />
            <div className="splash-progress-glow" />
          </div>
        </div>

        {/* Display Headline */}
        <h1 className="splash-title">
          WE ARE COOKING<br />AN UPGRADE
        </h1>

        {/* Signature Serif-Italic Tagline */}
        <div className="splash-tagline">
          Stay <span className="highlight-accent">Happy</span> while you wait...
        </div>

        {/* Action Links Grid (Primary & Secondary Hierarchy) */}
        <div className="splash-actions-row">
          {/* Primary Action Button (Follow on X) */}
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="splash-action-primary-pill"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span>Follow on X</span>
            <span className="splash-action-arrow">↗</span>
          </a>

          {/* Secondary Action Button (DexScreener) */}
          <a
            href={DEXSCREENER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="splash-action-secondary-pill"
          >
            <img
              src="/dexscreener.jpg"
              alt="DexScreener"
              className="splash-icon-dex"
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <span>DexScreener</span>
            <span className="splash-action-arrow">↗</span>
          </a>
        </div>
      </div>

      {/* Secret Admin Corner Access */}
      <div className="splash-admin-access-corner">
        <button
          onClick={() => setIsPasscodeModalOpen(true)}
          title="Admin Access"
          className="splash-lock-btn"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </button>
      </div>

      {/* Secret Admin Passcode Modal */}
      {isPasscodeModalOpen && (
        <div className="splash-modal-overlay" onClick={() => setIsPasscodeModalOpen(false)}>
          <div className="splash-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="splash-modal-header">
              <div className="splash-modal-title-row">
                <span className="splash-modal-dot" />
                <h3 className="splash-modal-title">ADMIN ACCESS</h3>
              </div>
              <button
                onClick={() => setIsPasscodeModalOpen(false)}
                className="splash-modal-close-btn"
              >
                ✕
              </button>
            </div>
            
            <p className="splash-modal-desc">
              Enter developer passcode to bypass maintenance mode and access the workspace.
            </p>

            <form onSubmit={handlePasscodeSubmit}>
              <input
                type="password"
                placeholder="Enter passcode (hh2026)"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="splash-modal-input"
                autoFocus
              />
              
              {passcodeError && (
                <div className="splash-modal-error">
                  Incorrect passcode. Please try again.
                </div>
              )}

              <div className="splash-modal-actions">
                <button
                  type="button"
                  onClick={() => setIsPasscodeModalOpen(false)}
                  className="splash-btn-secondary"
                >
                  Cancel
                </button>
                <button type="submit" className="splash-btn-primary">
                  Unlock Platform ↗
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
