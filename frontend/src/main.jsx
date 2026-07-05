// src/main.jsx
// ─────────────────────────────────────────────────────────
// Entry point — wraps app in PrivyProvider + WagmiProvider + QueryClientProvider
// Per official docs: docs.base.org/get-started/build-app
// ─────────────────────────────────────────────────────────

import React from 'react'
import ReactDOM from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from './config/wagmi'
import App from './App'
import { DocsPage } from './components/DocsPage'

const queryClient = new QueryClient()

// Lightweight path router — /docs renders standalone (no wallet needed)
const isDocsRoute = window.location.pathname.startsWith('/docs')

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isDocsRoute ? (
      <DocsPage />
    ) : (
      <PrivyProvider
        appId={import.meta.env.VITE_PRIVY_APP_ID}
        config={{
          loginMethods: ['twitter', 'google', 'email', 'wallet'],
          appearance: {
            theme: 'light',
            accentColor: '#0000FF',
            logo: '/logo.png',
            showWalletLoginFirst: false,
          },
          embeddedWallets: {
            createOnLogin: 'users-without-wallets',
          },
        }}
      >
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </WagmiProvider>
      </PrivyProvider>
    )}
  </React.StrictMode>
)
