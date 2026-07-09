// src/main.jsx
// ─────────────────────────────────────────────────────────
// Entry point — conditionally wraps app based on environment
// ─────────────────────────────────────────────────────────

import React from 'react'
import ReactDOM from 'react-dom/client'

// Legacy Wagmi Providers (for Base App / Coinbase Wallet in-app browser)
import { WagmiProvider } from 'wagmi'
import { config } from './config/wagmi'

// Privy Providers (for normal Web Browser)
import { PrivyProvider, usePrivy, useWallets, useCreateWallet } from '@privy-io/react-auth'
import { WagmiProvider as PrivyWagmiProvider } from '@privy-io/wagmi'
import { privyWagmiConfig } from './config/privyWagmi'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { DocsPage } from './components/DocsPage'

const queryClient = new QueryClient()

const isDocsRoute = window.location.pathname.startsWith('/docs')
const isMobileDappBrowser = typeof window !== 'undefined' && window.ethereum && /Mobi|Android|iPhone/i.test(navigator.userAgent)

const PrivyWebAppWrapper = () => {
  const { login, logout, user: privyUser, ready, authenticated } = usePrivy()
  const { wallets } = useWallets()
  const { createWallet } = useCreateWallet()

  // Wait for Privy to finish initialising before rendering the app.
  // This prevents the "stuck" state where the button becomes unresponsive
  // after a partial / failed login attempt.
  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0D0E14' }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(59,130,246,0.3)', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // Auto-create embedded wallet if the user is authenticated but has none yet
  // (happens when existing users log in after createOnLogin was changed to 'all-users')
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy')
  if (authenticated && !embeddedWallet) {
    createWallet().catch(() => {}) // fire-and-forget
  }

  // Simple login — no logout() before it, which was breaking the email OTP flow.
  // The ready check above already ensures Privy is in a clean state.
  const handleLogin = () => {
    login()
  }

  return (
    <App
      onLogin={handleLogin}
      onLogout={logout}
      privyUser={privyUser}
      privyWallets={wallets}
    />
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isDocsRoute ? (
      <DocsPage />
    ) : isMobileDappBrowser ? (
      // -------------------------------------------------------------
      // MINI APP MODE (Coinbase Wallet App, etc.)
      // -------------------------------------------------------------
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </WagmiProvider>
    ) : (
      // -------------------------------------------------------------
      // WEB MODE (Privy Auth)
      // -------------------------------------------------------------
      <PrivyProvider
        appId="cmr71ywhn007f0cl16cnybewf"
        config={{
          loginMethods: ['wallet', 'email', 'twitter', 'telegram'],
          appearance: {
            theme: 'dark',
            accentColor: '#3B82F6',
            landingHeader: 'Welcome to Happy Hour',
            loginMessage: 'Sign in to access your account',
            showWalletLoginFirst: true,
          },
          embeddedWallets: {
            createOnLogin: 'all-users'
          }
        }}
      >
        <QueryClientProvider client={queryClient}>
          <PrivyWagmiProvider config={privyWagmiConfig}>
            <PrivyWebAppWrapper />
          </PrivyWagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    )}
  </React.StrictMode>
)
