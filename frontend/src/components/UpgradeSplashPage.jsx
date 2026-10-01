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
      setTimeout(() => setPasscodeError(false), 2000);
    }
  };

  return (
    <div className="splash-container">
      {/* Background Orbit Rings & Ambient Stardust */}
      <div className="splash-orbit-decorations">
        <div className="splash-orbit splash-orbit-1" />
        <div className="splash-orbit splash-orbit-2" />
        <div className="splash-orbit splash-orbit-3" />
        
        <div className="splash-particle" style={{ top: '25%', left: '20%', width: '3px', height: '3px' }} />
        <div className="splash-particle" style={{ top: '30%', right: '22%', width: '2px', height: '2px', opacity: 0.3 }} />
        <div className="splash-particle" style={{ bottom: '20%', left: '30%', width: '3px', height: '3px' }} />
        <div className="splash-particle" style={{ bottom: '30%', right: '28%', width: '4px', height: '4px', opacity: 0.18 }} />
      </div>

      {/* Main Centered Card Window */}
      <div className="splash-card-window">
        {/* App Logo */}
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

        {/* Slogan Pill */}
        <div className="splash-pill-slogan">
          🔥 TRADE TO WIN
        </div>

        {/* Headline */}
        <h1 className="splash-title">
          WE ARE COOKING<br />AN UPGRADE
        </h1>

        {/* Tagline */}
        <div className="splash-tagline">
          Stay <span className="highlight">Happy</span> while you wait...
        </div>

        {/* Concise Description */}
        <p className="splash-description">
          Ми готуємо масштабне оновлення платформи, яке з'явиться вже зовсім згодом. 
          Слідкуйте за анонсами та залишайтесь з нами!
        </p>

        {/* Live Status Badge */}
        <div className="splash-status-badge">
          <span className="splash-status-dot" />
          <span>Status: Upgrade in Progress</span>
        </div>

        {/* Action Links Grid (X & DexScreener) */}
        <div className="splash-actions-row">
          {/* X (Twitter) Link */}
          <a
            href={X_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="splash-action-pill"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            <span>Follow on X</span>
            <span style={{ fontSize: '0.80rem', opacity: 0.7 }}>↗</span>
          </a>

          {/* DexScreener Link */}
          <a
            href={DEXSCREENER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="splash-action-pill"
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
            <span style={{ fontSize: '0.80rem', opacity: 0.7 }}>↗</span>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h3 style={{ fontFamily: 'var(--splash-font-display)', fontSize: '1.15rem', color: '#FFF' }}>
                ADMIN ACCESS
              </h3>
              <button
                onClick={() => setIsPasscodeModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '1.2rem' }}
              >
                ✕
              </button>
            </div>
            
            <p style={{ fontSize: '0.86rem', color: 'var(--splash-text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Введіть пароль розробника для входу в адмін-робочу область.
            </p>

            <form onSubmit={handlePasscodeSubmit}>
              <input
                type="password"
                placeholder="Введіть пароль (hh2026)"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="splash-modal-input"
                autoFocus
              />
              
              {passcodeError && (
                <div style={{ color: '#F87171', fontSize: '0.82rem', marginBottom: '14px', fontWeight: 600 }}>
                  Невірний пароль. Спробуйте ще раз.
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setIsPasscodeModalOpen(false)}
                  className="splash-btn-secondary"
                >
                  Скасувати
                </button>
                <button type="submit" className="splash-btn-primary">
                  Розблокувати ↗
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
