// src/config/privyWagmi.js
import { http } from 'wagmi'
import { base } from 'wagmi/chains'
import { createConfig } from '@privy-io/wagmi'

export const privyWagmiConfig = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
})
