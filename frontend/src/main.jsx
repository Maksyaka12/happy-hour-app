// src/main.jsx
// ─────────────────────────────────────────────────────────
// Entry point — wraps app in WagmiProvider + QueryClientProvider
// Per official docs: docs.base.org/get-started/build-app
// ─────────────────────────────────────────────────────────

import React from 'react'
import ReactDOM from 'react-dom/client'
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
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </WagmiProvider>
    )}
  </React.StrictMode>
)
