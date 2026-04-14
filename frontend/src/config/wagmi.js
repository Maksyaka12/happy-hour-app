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
import { BUILDER_CODE } from './constants'

/**
 * ERC-8021 Builder Code Suffix Generator (Native)
 * Format: [HexCode][LenByte][FlagsByte][8x 0x8021 Magic]
 */
function toErc8021Suffix(code) {
  if (!code || !code.startsWith('bc_')) return undefined
  
  // Convert string to hex
  const hex = Array.from(code).map(c => 
    c.charCodeAt(0).toString(16).padStart(2, '0')
  ).join('')
  
  // Length in hex (1 byte)
  const len = code.length.toString(16).padStart(2, '0')
  
  // Flags (1 byte, usually 00)
  const flags = '00'
  
  // MAGIC 8021 (8 times)
  const magic = '80218021802180218021802180218021'
  
  return `0x${hex}${len}${flags}${magic}`
}

export const DATA_SUFFIX = toErc8021Suffix(BUILDER_CODE)

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
  // Global dataSuffix is NOT supported in wagmi, so we keep it here only for export
})
