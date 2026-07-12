// src/main.jsx
// ─────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────

import React from 'react'
import ReactDOM from 'react-dom/client'

// Privy Providers (for normal Web Browser)
import { PrivyProvider, usePrivy, useWallets, useCreateWallet } from '@privy-io/react-auth'
import { WagmiProvider as PrivyWagmiProvider } from '@privy-io/wagmi'
import { privyWagmiConfig } from './config/privyWagmi'
import { base } from 'wagmi/chains'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { DocsPage } from './components/DocsPage'

const queryClient = new QueryClient()

const isDocsRoute = window.location.pathname.startsWith('/docs')

const PrivyWebAppWrapper = () => {
  const { login, logout, user: privyUser, ready, authenticated } = usePrivy()
  const { wallets } = useWallets()
  const { createWallet } = useCreateWallet()

  // Guard: ensure createWallet() fires at most ONCE per session
  // Calling it on every render was creating multiple embedded wallets
  const walletCreationAttempted = React.useRef(false)

  React.useEffect(() => {
    if (!authenticated) {
      // Reset when user logs out so next login can create wallet if needed
      walletCreationAttempted.current = false
      return
    }
    const embeddedWallet = wallets.find(w => w.walletClientType === 'privy')
    if (embeddedWallet) return // already has one, nothing to do
    if (walletCreationAttempted.current) return // already tried this session

    walletCreationAttempted.current = true
    createWallet().catch(e => console.error('createWallet failed:', e))
  }, [authenticated, wallets]) // re-run when wallets list updates

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0D0E14' }}>
        <div style={{ width: 36, height: 36, border: '3px solid rgba(59,130,246,0.3)', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <App
      onLogin={login}
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
    ) : (
      <PrivyProvider
        appId="cmr71ywhn007f0cl16cnybewf"
        config={{
          loginMethods: ['wallet', 'email', 'twitter', 'telegram'],
          defaultChain: base,
          supportedChains: [base],
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
