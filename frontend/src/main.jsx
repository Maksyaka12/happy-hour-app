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
import { PrivyProvider, usePrivy } from '@privy-io/react-auth'
import { WagmiProvider as PrivyWagmiProvider } from '@privy-io/wagmi'
import { privyWagmiConfig } from './config/privyWagmi'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { DocsPage } from './components/DocsPage'

const queryClient = new QueryClient()

const isDocsRoute = window.location.pathname.startsWith('/docs')
const isMobileDappBrowser = typeof window !== 'undefined' && window.ethereum && /Mobi|Android|iPhone/i.test(navigator.userAgent)

const PrivyWebAppWrapper = () => {
  const { login } = usePrivy()
  return <App onLogin={login} />
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
          loginMethods: ['wallet'],
          appearance: {
            theme: 'dark',
            accentColor: '#3B82F6',
            showWalletLoginFirst: true,
          },
          embeddedWallets: {
            createOnLogin: 'off'
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
