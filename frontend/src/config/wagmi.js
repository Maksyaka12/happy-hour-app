// src/config/wagmi.js
// ─────────────────────────────────────────────────────────
// Official Base wagmi config per docs.base.org/get-started/build-app
//
// Builder Code docs:
// docs.base.org/base-chain/builder-codes/app-developers
//
// dataSuffix at config level = appended to ALL transactions automatically
// Works with useWriteContract, useSendTransaction, useSendCalls
// ─────────────────────────────────────────────────────────

import { http, createConfig } from 'wagmi'
import { base } from 'wagmi/chains'
import { baseAccount, injected } from 'wagmi/connectors'
import { Attribution } from 'ox/erc8021'
import { BUILDER_CODE } from './constants'

// Generate dataSuffix from Builder Code
// Per docs: Attribution.toDataSuffix({ codes: ["YOUR-BUILDER-CODE"] })
// "Legacy Per-Transaction Approach" — guaranteed to work for ALL wallet types
// (injected: MetaMask, Coinbase Wallet, etc.) AND Smart Wallet in Base App
export const DATA_SUFFIX = BUILDER_CODE
  ? Attribution.toDataSuffix({ codes: [BUILDER_CODE] })
  : undefined

export const config = createConfig({
  chains: [base],
  connectors: [
    // Primary: Base Smart Wallet — for Base App users
    baseAccount({
      appName: 'Happy Hour',
    }),
    // Fallback: MetaMask / browser extension wallets
    injected(),
  ],
  transports: {
    [base.id]: http(),
  },
  // Builder Code suffix — automatically appended to EVERY transaction
  // from this config: deposits, check-ins, any future transactions
  // No changes needed in individual components
  ...(DATA_SUFFIX ? { dataSuffix: DATA_SUFFIX } : {}),
})
