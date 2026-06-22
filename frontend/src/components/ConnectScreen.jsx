// src/components/ConnectScreen.jsx (updated header/socials design)
// ─────────────────────────────────────────────────────────
// Wallet connection per docs.base.org/get-started/build-app (Step 3)
// Uses useConnect with baseAccount + injected connectors
// ─────────────────────────────────────────────────────────

import { useConnect } from 'wagmi'
import { HappyHourLogo } from './HappyHourLogo'
import { BaseMark } from './BaseMark'

export function ConnectScreen() {
  const { connect, connectors, isPending, error } = useConnect()

  // Find the two connectors we configured in wagmi.js
  const baseConnector     = connectors.find(c => c.id === 'base-account' || c.name?.toLowerCase().includes('base'))
  const injectedConnector = connectors.find(c => c.id === 'injected')

  // Check if user is inside a mobile Web3 DApp browser (Coinbase Wallet, MetaMask app, etc.)
  const isMobileDappBrowser = typeof window !== 'undefined' && window.ethereum && /Mobi|Android|iPhone/i.test(navigator.userAgent)

  return (
    <div className="connect-bg" style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Dot grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, rgba(0,0,255,0.18) 2px, transparent 2px)',
        backgroundSize: '32px 32px', opacity: 0.35,
      }} />

      {/* Top Header Socials Bar */}
      <div style={{
        width: '100%',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '16px 24px',
        flexWrap: 'wrap',
        zIndex: 10,
        borderBottom: '1px solid rgba(0, 0, 0, 0.04)',
        background: 'rgba(255, 255, 255, 0.5)',
        backdropFilter: 'blur(8px)',
        boxSizing: 'border-box'
      }}>
        {/* Telegram */}
        <a 
          href="https://t.me/happyhourapp" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', transition: 'opacity 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(0, 136, 204, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#0088cc' }}>
              <path d="M21.9 2.19a1 1 0 0 0-.99-.08l-19 8a1 1 0 0 0-.1 1.82l4.9 2.2 3.1 7.1a1 1 0 0 0 1.77.16l2.9-3.8 4.7 3.3a1 1 0 0 0 1.51-.55l4-17a1 1 0 0 0-.39-.85zM8.62 13.12l8.28-5.28-6.4 6.72-.4 2.88z"/>
            </svg>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 750, color: '#0A0B0D', fontFamily: "'Inter', sans-serif" }}>Telegram</span>
        </a>

        {/* X */}
        <a 
          href="https://x.com/happyhour_base" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', transition: 'opacity 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(0, 0, 0, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#0A0B0D' }}>
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 750, color: '#0A0B0D', fontFamily: "'Inter', sans-serif" }}>X</span>
        </a>

        {/* Docs */}
        <a 
          href="/docs" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', transition: 'opacity 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'rgba(0, 82, 255, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0052ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 750, color: '#0A0B0D', fontFamily: "'Inter', sans-serif" }}>docs</span>
        </a>

        {/* DexScreener */}
        <a 
          href="https://dexscreener.com/base/0xe186aa00d52844ed05d1b1373fc2ec8b0562d613f9f4b470ee7fafa0c1a388f9" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', transition: 'opacity 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <div style={{ width: 18, height: 18, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/dexscreener.jpg" alt="DexScreener" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 750, color: '#0A0B0D', fontFamily: "'Inter', sans-serif" }}>DexScreener</span>
        </a>

        {/* GeckoTerminal */}
        <a 
          href="https://www.geckoterminal.com/uk/base/pools/0xe186aa00d52844ed05d1b1373fc2ec8b0562d613f9f4b470ee7fafa0c1a388f9" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', transition: 'opacity 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <div style={{ width: 18, height: 18, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/geckoterminal.jpg" alt="GeckoTerminal" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 750, color: '#0A0B0D', fontFamily: "'Inter', sans-serif" }}>GeckoTerminal</span>
        </a>

        {/* CoinGecko */}
        <a 
          href="https://www.coingecko.com/en/coins/happy-hour" 
          target="_blank" 
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'none', transition: 'opacity 0.2s' }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <div style={{ width: 18, height: 18, borderRadius: '50%', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/CoinGecko-logo.png" alt="CoinGecko" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <span style={{ fontSize: 11.5, fontWeight: 750, color: '#0A0B0D', fontFamily: "'Inter', sans-serif" }}>CoinGecko</span>
        </a>
      </div>

      {/* Centered Content Wrapper */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 28px', boxSizing: 'border-box' }}>
        <div style={{ width: '100%', maxWidth: 380, textAlign: 'center' }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 44 }}>
            <HappyHourLogo size={44} />
            <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5 }}>
              happy hour
            </span>
          </div>

          {/* Headline */}
          <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.3, letterSpacing: -0.8, marginBottom: 16, color: 'var(--text)' }}>
            Consumer App on Base<br />
            <span style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10.2,
              color: '#717886',
              display: 'block',
              marginTop: 8,
              lineHeight: 1.4,
              letterSpacing: '-0.1px'
            }}>
              Point System · Seasonal Rewards · Hourly Raffles
            </span>
          </div>

          {/* Dot accent */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 5, marginBottom: 32, height: 12 }}>
            {Array.from({ length: 11 }).map((_, i) => (
              <div key={i} style={{
                borderRadius: '50%', background: '#0000FF',
                width: 4 + i * 0.7, height: 4 + i * 0.7,
                opacity: 0.15 + i * 0.08,
              }} />
            ))}
          </div>

          {isPending ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <div style={{ width: 18, height: 18, border: '2px solid #0000FF', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: 1, color: '#0000FF' }}>
                CONNECTING…
              </span>
            </div>
          ) : isMobileDappBrowser ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {injectedConnector && (
                <button
                  onClick={() => connect({ connector: injectedConnector })}
                  style={{
                    background: '#0000FF', color: '#fff',
                    borderRadius: 50, padding: '15px 22px', fontSize: 15, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none',
                    boxShadow: '0 6px 24px rgba(0,0,255,0.35)', cursor: 'pointer',
                  }}
                >
                  Play on Base
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

              {/* Base Smart Wallet — primary */}
              {baseConnector && (
                <button
                  onClick={() => connect({ connector: baseConnector })}
                  style={{
                    background: '#0000FF', color: '#fff',
                    borderRadius: 50, padding: '15px 22px', fontSize: 15, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 12, border: 'none',
                    boxShadow: '0 6px 24px rgba(0,0,255,0.35)', cursor: 'pointer',
                  }}
                >
                  <BaseMark size={20} color="#fff" />
                  <span style={{ flex: 1, textAlign: 'left' }}>Connect Base Account</span>
                  <span style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 9,
                    background: 'rgba(255,255,255,0.2)', borderRadius: 50,
                    padding: '3px 8px', letterSpacing: 1,
                  }}>SMART</span>
                </button>
              )}

              {/* Injected — MetaMask / other */}
              {injectedConnector && (
                <button
                  onClick={() => connect({ connector: injectedConnector })}
                  style={{
                    background: '#fff', border: '1.5px solid #DEE1E7', color: '#32353D',
                    borderRadius: 50, padding: '14px 22px', fontSize: 15, fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                    boxShadow: '0 1px 4px rgba(10,11,13,0.07)',
                  }}
                >
                  <div style={{ width: 20, height: 20, border: '2px solid #DEE1E7', borderRadius: '50%' }} />
                  <span style={{ flex: 1, textAlign: 'left' }}>Connect Wallet</span>
                  <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#717886', letterSpacing: 1 }}>EOA</span>
                </button>
              )}
            </div>
          )}

          {/* Error display */}
          {error && (
            <div style={{
              marginTop: 16, background: '#FEE2E2', border: '1px solid #FC401F',
              borderRadius: 12, padding: '10px 14px',
              fontSize: 13, color: '#FC401F', textAlign: 'center',
            }}>
              {error.message?.includes('rejected') ? 'Connection cancelled' : error.message}
            </div>
          )}

          <div style={{ marginTop: 24, fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#717886', letterSpacing: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span>built by</span>
            <a href="https://x.com/mksvibe" target="_blank" rel="noopener noreferrer" style={{ color: '#0000FF', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              <img src="/mksvibe.jpg" alt="@mksvibe" style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }} />
              <span>@mksvibe</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
