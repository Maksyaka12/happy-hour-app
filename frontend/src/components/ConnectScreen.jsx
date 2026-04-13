// src/components/ConnectScreen.jsx
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
      alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Dot grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle, rgba(0,0,255,0.18) 2px, transparent 2px)',
        backgroundSize: '32px 32px', opacity: 0.35,
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 380, padding: '0 28px', textAlign: 'center' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 44 }}>
          <HappyHourLogo size={44} />
          <span style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5 }}>
            happy hour
          </span>
        </div>

        {/* Headline */}
        <div style={{ fontSize: 48, fontWeight: 900, lineHeight: 1, letterSpacing: -2, marginBottom: 14, color: 'var(--text)' }}>
          Chance To Win<br />USDC Every Hour
        </div>

        {/* Dot accent */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 5, marginBottom: 18, height: 12 }}>
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} style={{
              borderRadius: '50%', background: '#0000FF',
              width: 4 + i * 0.7, height: 4 + i * 0.7,
              opacity: 0.15 + i * 0.08,
            }} />
          ))}
        </div>

        <p style={{ fontFamily: "'DM Mono', monospace", color: '#717886', fontSize: 12, marginBottom: 40, lineHeight: 1.9, letterSpacing: 0.5 }}>
          lucky-based fair draw on Base
        </p>

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

        <div style={{ marginTop: 24, fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#717886', letterSpacing: 2 }}>
          built by <a href="https://x.com/mksvibe" target="_blank" rel="noopener noreferrer" style={{ color: '#0000FF', textDecoration: 'none' }}>@mksvibe</a>
        </div>
      </div>
    </div>
  )
}
