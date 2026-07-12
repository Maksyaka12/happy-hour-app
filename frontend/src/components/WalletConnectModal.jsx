import { useEffect } from 'react'
import { useConnect, useAccount } from 'wagmi'
import { BaseMark } from './BaseMark'

export function WalletConnectModal({ isOpen, onClose }) {
  if (!isOpen) return null

  const { connect, connectors, isPending, error } = useConnect()
  const { isConnected } = useAccount()

  useEffect(() => {
    if (isConnected) {
      onClose()
    }
  }, [isConnected, onClose])

  // Find the two connectors we configured in wagmi.js
  const baseConnector     = connectors.find(c => c.id === 'base-account' || c.name?.toLowerCase().includes('base'))
  const injectedConnector = connectors.find(c => c.id === 'injected')

  // Check if user is inside a mobile Web3 DApp browser
  const isMobileDappBrowser = typeof window !== 'undefined' && window.ethereum && /Mobi|Android|iPhone/i.test(navigator.userAgent)

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(5, 8, 22, 0.7)',
      backdropFilter: 'blur(10px)',
      animation: 'fadeIn 0.25s ease-out'
    }}>
      {/* Modal Container */}
      <div style={{
        background: '#0F172A',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.15)',
        borderRadius: 24,
        width: '100%',
        maxWidth: 380,
        padding: 32,
        boxSizing: 'border-box',
        position: 'relative',
        color: '#FFFFFF',
        fontFamily: "'Inter', sans-serif"
      }}>
        {/* Close Button */}
        <button 
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            background: 'rgba(255, 255, 255, 0.05)',
            border: 'none',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255, 255, 255, 0.6)',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            e.currentTarget.style.color = '#FFFFFF';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/logo.jfif" alt="Happy Hour Logo" style={{
            width: 72,
            height: 72,
            borderRadius: 18,
            margin: '0 auto 16px',
            display: 'block',
            boxShadow: '0 4px 16px rgba(59, 130, 246, 0.25)',
            border: '2px solid rgba(59, 130, 246, 0.3)'
          }} />
          <p style={{ margin: 0, fontSize: 14, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.5, fontWeight: 500 }}>
            Connect your wallet to Happy Hour mini-app
          </p>
        </div>

        {/* Buttons List */}
        {isPending ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0', gap: 12 }}>
            <div style={{ width: 24, height: 24, border: '2px solid #3B82F6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#3B82F6', letterSpacing: 1, fontFamily: "'DM Mono', monospace" }}>
              CONNECTING…
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {isMobileDappBrowser ? (
              injectedConnector && (
                <button
                  onClick={() => connect({ connector: injectedConnector })}
                  style={{
                    background: '#0052FF', 
                    color: '#fff',
                    borderRadius: 14, 
                    padding: '14px 20px', 
                    fontSize: 14.5, 
                    fontWeight: 700,
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0, 82, 255, 0.25)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'none'}
                >
                  Connect Base Account
                </button>
              )
            ) : (
              <>
                {/* Base Smart Wallet */}
                {baseConnector && (
                  <button
                    onClick={() => connect({ connector: baseConnector })}
                    style={{
                      background: '#0052FF', 
                      color: '#fff',
                      borderRadius: 14, 
                      padding: '14px 20px', 
                      fontSize: 14.5, 
                      fontWeight: 700,
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 10, 
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 16px rgba(0, 82, 255, 0.25)',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(0, 82, 255, 0.35)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 82, 255, 0.25)';
                    }}
                  >
                    <BaseMark size={18} color="#fff" />
                    <span style={{ flex: 1, textAlign: 'left' }}>Base Smart Account</span>
                    <span style={{
                      fontFamily: "'DM Mono', monospace", 
                      fontSize: 8.5,
                      background: 'rgba(255,255,255,0.2)', 
                      borderRadius: 50,
                      padding: '2px 6px', 
                      letterSpacing: 0.5,
                      fontWeight: 700
                    }}>SMART</span>
                  </button>
                )}

                {/* Injected (MetaMask/Coinbase Extension) */}
                {injectedConnector && (
                  <button
                    onClick={() => connect({ connector: injectedConnector })}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)', 
                      border: '1px solid rgba(255, 255, 255, 0.12)', 
                      color: '#FFFFFF',
                      borderRadius: 14, 
                      padding: '14px 20px', 
                      fontSize: 14.5, 
                      fontWeight: 600,
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 10, 
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                    }}
                  >
                    <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.4)', borderRadius: '50%' }} />
                    <span style={{ flex: 1, textAlign: 'left' }}>Connect Wallet</span>
                    <span style={{ 
                      fontFamily: "'DM Mono', monospace", 
                      fontSize: 8.5, 
                      color: 'rgba(255,255,255,0.5)', 
                      letterSpacing: 0.5 
                    }}>EOA</span>
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div style={{
            marginTop: 20, 
            background: 'rgba(239, 68, 68, 0.1)', 
            border: '1px solid #EF4444',
            borderRadius: 12, 
            padding: '10px 14px',
            fontSize: 12.5, 
            color: '#F87171', 
            textAlign: 'center',
            lineHeight: 1.4
          }}>
            {error.message?.includes('rejected') ? 'Connection cancelled' : error.message}
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}} />
    </div>
  )
}
