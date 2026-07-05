import { useState } from 'react'

export function AccountSection({ address, onRequireWallet }) {
  // Mock state for linked accounts
  const [isXLinked, setIsXLinked] = useState(false)
  const [isTelegramLinked, setIsTelegramLinked] = useState(false)

  // Loading states for simulating the connection process
  const [isConnectingX, setIsConnectingX] = useState(false)
  const [isConnectingTg, setIsConnectingTg] = useState(false)

  const handleToggleX = () => {
    if (!address) {
      onRequireWallet?.()
      return
    }

    if (isXLinked) {
      // Disconnect logic
      setIsXLinked(false)
    } else {
      // Connect logic simulation
      setIsConnectingX(true)
      setTimeout(() => {
        setIsConnectingX(false)
        setIsXLinked(true)
      }, 1500)
    }
  }

  const handleToggleTelegram = () => {
    if (!address) {
      onRequireWallet?.()
      return
    }

    if (isTelegramLinked) {
      // Disconnect logic
      setIsTelegramLinked(false)
    } else {
      // Connect logic simulation
      setIsConnectingTg(true)
      setTimeout(() => {
        setIsConnectingTg(false)
        setIsTelegramLinked(true)
      }, 1500)
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      animation: 'fadeIn 0.3s ease',
      color: '#FFFFFF'
    }}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .account-toggle {
          position: relative;
          width: 44px;
          height: 24px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.3s ease;
        }
        .account-toggle.active {
          background: #8B5CF6; /* Purple color matching Bankr */
        }
        .account-toggle-knob {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 20px;
          height: 20px;
          background: #FFFFFF;
          border-radius: 50%;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .account-toggle.active .account-toggle-knob {
          transform: translateX(20px);
        }
        .account-toggle.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>

      {/* Header */}
      <div>
        <h1 style={{
          fontSize: 24,
          fontWeight: 800,
          margin: '0 0 8px 0',
          fontFamily: "'Outfit', 'Inter', sans-serif"
        }}>
          Account Settings
        </h1>
        <p style={{
          fontSize: 14,
          color: '#94A3B8',
          margin: 0,
          lineHeight: 1.5
        }}>
          Manage your personal information and connected social accounts.
        </p>
      </div>

      {/* Linked Accounts Section */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.03)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 20,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 24
      }}>
        {/* Section Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'rgba(139, 92, 246, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#8B5CF6'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
            </svg>
          </div>
          <div>
            <h2 style={{
              fontSize: 16,
              fontWeight: 700,
              margin: 0,
              color: '#F8FAFC'
            }}>
              Linked accounts
            </h2>
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
              Manage your linked social accounts
            </div>
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.05)' }} />

        {/* Account List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          
          {/* X (Twitter) Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#FFFFFF' }}>
                  X (Twitter)
                </div>
                <div style={{ fontSize: 13, color: isXLinked ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                  {isXLinked ? '@happyhour_user' : 'Not linked'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {isConnectingX && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                  <line x1="12" y1="2" x2="12" y2="6"></line>
                  <line x1="12" y1="18" x2="12" y2="22"></line>
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                  <line x1="2" y1="12" x2="6" y2="12"></line>
                  <line x1="18" y1="12" x2="22" y2="12"></line>
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                  <line x1="16.24" y1="4.93" x2="19.07" y2="7.76"></line>
                </svg>
              )}
              <div 
                className={`account-toggle ${isXLinked ? 'active' : ''} ${isConnectingX ? 'disabled' : ''}`}
                onClick={!isConnectingX ? handleToggleX : undefined}
              >
                <div className="account-toggle-knob" />
              </div>
            </div>
          </div>

          {/* Telegram Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: '#2AABEE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF'
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.19-.08-.05-.19-.02-.27 0-.12.03-1.99 1.26-5.61 3.71-.53.37-1.01.55-1.44.54-.48-.01-1.39-.27-2.07-.49-.83-.27-1.49-.41-1.43-.87.03-.24.36-.49.98-.75 3.84-1.67 6.4-2.77 7.68-3.3 3.65-1.51 4.41-1.78 4.9-1.79.11 0 .36.03.52.16.14.11.18.26.19.37.01.07.02.24.01.35z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#FFFFFF' }}>
                  Telegram
                </div>
                <div style={{ fontSize: 13, color: isTelegramLinked ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                  {isTelegramLinked ? '@happyhour_user' : 'Not linked'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {isConnectingTg && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                  <line x1="12" y1="2" x2="12" y2="6"></line>
                  <line x1="12" y1="18" x2="12" y2="22"></line>
                  <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                  <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                  <line x1="2" y1="12" x2="6" y2="12"></line>
                  <line x1="18" y1="12" x2="22" y2="12"></line>
                  <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                  <line x1="16.24" y1="4.93" x2="19.07" y2="7.76"></line>
                </svg>
              )}
              <div 
                className={`account-toggle ${isTelegramLinked ? 'active' : ''} ${isConnectingTg ? 'disabled' : ''}`}
                onClick={!isConnectingTg ? handleToggleTelegram : undefined}
              >
                <div className="account-toggle-knob" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
