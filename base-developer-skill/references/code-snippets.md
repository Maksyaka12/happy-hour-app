# Base Developer Code Snippets Reference

Quick reference for common Base development patterns. Use these production-ready snippets as starting points.

## Table of Contents
1. [Project Setup](#project-setup)
2. [Wagmi Configuration Variants](#wagmi-configuration-variants)
3. [Contract ABIs](#contract-abis)
4. [Advanced Hooks](#advanced-hooks)
5. [OnchainKit Components](#onchainkit-components)

## Project Setup

### Create New Base App

```bash
# Create Next.js app with TypeScript and Tailwind
npx create-next-app@latest my-base-app --typescript --tailwind --app
cd my-base-app

# Install Base dependencies
npm install wagmi viem @tanstack/react-query @base-org/account

# Optional: OnchainKit for pre-built components
npm install @coinbase/onchainkit

# Optional: RainbowKit for enhanced wallet UI
npm install @rainbow-me/rainbowkit

# Setup Foundry for smart contracts
mkdir contracts && cd contracts
curl -L https://foundry.paradigm.xyz | bash
foundryup
forge init --no-git
```

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_CDP_API_KEY=your_coinbase_api_key
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASE_MAINNET_RPC_URL=https://mainnet.base.org
BASESCAN_API_KEY=your_basescan_api_key

# contracts/.env (never commit!)
DEPLOYER_PRIVATE_KEY=your_private_key
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

## Wagmi Configuration Variants

### Minimal Configuration (Base Only)

```typescript
// config/wagmi.ts
import { http, createConfig, createStorage, cookieStorage } from 'wagmi'
import { base } from 'wagmi/chains'
import { baseAccount, injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [base],
  connectors: [
    injected(),
    baseAccount({ appName: 'My Base App' }),
  ],
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  transports: {
    [base.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
```

### Multi-Chain Configuration

```typescript
// config/wagmi.ts
import { http, createConfig, createStorage, cookieStorage } from 'wagmi'
import { base, baseSepolia, mainnet, sepolia } from 'wagmi/chains'
import { baseAccount, injected, walletConnect } from 'wagmi/connectors'

export const config = createConfig({
  chains: [base, baseSepolia, mainnet, sepolia],
  connectors: [
    injected(),
    baseAccount({ appName: 'My Base App' }),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID!,
    }),
  ],
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
```

### Configuration with Custom RPC

```typescript
// config/wagmi.ts
import { http, createConfig, createStorage, cookieStorage } from 'wagmi'
import { base, baseSepolia } from 'wagmi/chains'
import { baseAccount, injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [base, baseSepolia],
  connectors: [
    injected(),
    baseAccount({ appName: 'My Base App' }),
  ],
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org'),
    [baseSepolia.id]: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
```

## Contract ABIs

### ERC-20 Token ABI

```typescript
export const erc20Abi = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'allowance',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'spender', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
] as const
```

### Simple Counter Contract ABI

```typescript
export const counterAbi = [
  {
    type: 'function',
    name: 'number',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'increment',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'decrement',
    inputs: [],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setNumber',
    inputs: [{ name: 'newNumber', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const
```

### NFT (ERC-721) ABI

```typescript
export const nftAbi = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ownerOf',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'mint',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'tokenId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'tokenId', type: 'uint256', indexed: true },
    ],
  },
] as const
```

## Advanced Hooks

### useContractBalance (ERC-20 Balance)

```typescript
import { useReadContract } from 'wagmi'
import { base } from 'wagmi/chains'

export function useContractBalance(
  tokenAddress: `0x${string}`,
  accountAddress?: `0x${string}`
) {
  return useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: accountAddress ? [accountAddress] : undefined,
    chainId: base.id,
    query: {
      enabled: !!accountAddress,
    },
  })
}

// Usage
const { data: balance } = useContractBalance(TOKEN_ADDRESS, address)
```

### useContractEvent (Listen to Events)

```typescript
import { useWatchContractEvent } from 'wagmi'
import { useEffect } from 'react'

export function useTransferListener(
  tokenAddress: `0x${string}`,
  onTransfer: (from: string, to: string, value: bigint) => void
) {
  useWatchContractEvent({
    address: tokenAddress,
    abi: erc20Abi,
    eventName: 'Transfer',
    onLogs(logs) {
      logs.forEach((log) => {
        const { from, to, value } = log.args
        onTransfer(from, to, value)
      })
    },
  })
}
```

### useTransactionStatus (Enhanced Transaction Tracking)

```typescript
import { useWaitForTransactionReceipt } from 'wagmi'
import { useEffect, useState } from 'react'

export function useTransactionStatus(hash?: `0x${string}`) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle')
  
  const { isLoading, isSuccess, isError } = useWaitForTransactionReceipt({
    hash,
  })

  useEffect(() => {
    if (!hash) {
      setStatus('idle')
    } else if (isLoading) {
      setStatus('pending')
    } else if (isSuccess) {
      setStatus('success')
    } else if (isError) {
      setStatus('error')
    }
  }, [hash, isLoading, isSuccess, isError])

  return { status, hash }
}
```

### useChainValidation (Force Correct Chain)

```typescript
import { useChainId, useSwitchChain } from 'wagmi'
import { base } from 'wagmi/chains'

export function useChainValidation(requiredChainId: number = base.id) {
  const chainId = useChainId()
  const { switchChain, isPending } = useSwitchChain()

  const isCorrectChain = chainId === requiredChainId
  
  const ensureCorrectChain = () => {
    if (!isCorrectChain) {
      switchChain({ chainId: requiredChainId })
    }
  }

  return {
    isCorrectChain,
    ensureCorrectChain,
    isSwitching: isPending,
    currentChainId: chainId,
  }
}

// Usage
const { isCorrectChain, ensureCorrectChain, isSwitching } = useChainValidation()

if (!isCorrectChain) {
  return (
    <button onClick={ensureCorrectChain} disabled={isSwitching}>
      {isSwitching ? 'Switching...' : 'Switch to Base'}
    </button>
  )
}
```

## OnchainKit Components

**Note**: Verify OnchainKit deprecation status before using. Some components may be deprecated.

### Identity Component

```typescript
import {
  Identity,
  Avatar,
  Name,
  Address,
  EthBalance,
} from '@coinbase/onchainkit/identity'

export function UserIdentity({ address }: { address: `0x${string}` }) {
  return (
    <Identity address={address}>
      <Avatar />
      <Name />
      <Address />
      <EthBalance />
    </Identity>
  )
}
```

### Transaction Component

```typescript
import {
  Transaction,
  TransactionButton,
  TransactionStatus,
} from '@coinbase/onchainkit/transaction'

export function TransactionComponent() {
  return (
    <Transaction
      chainId={base.id}
      calls={[
        {
          to: CONTRACT_ADDRESS,
          data: encodeFunctionData({
            abi: contractAbi,
            functionName: 'increment',
          }),
        },
      ]}
    >
      <TransactionButton />
      <TransactionStatus />
    </Transaction>
  )
}
```

### Swap Component

```typescript
import { Swap, SwapButton } from '@coinbase/onchainkit/swap'

export function TokenSwap() {
  return (
    <Swap>
      <SwapButton />
    </Swap>
  )
}
```

## Utility Functions

### Format Address

```typescript
export function formatAddress(address: string, chars = 4): string {
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}
```

### Format Token Amount

```typescript
import { formatUnits } from 'viem'

export function formatTokenAmount(
  amount: bigint,
  decimals: number,
  displayDecimals = 2
): string {
  const formatted = formatUnits(amount, decimals)
  return Number(formatted).toFixed(displayDecimals)
}
```

### Parse Token Amount

```typescript
import { parseUnits } from 'viem'

export function parseTokenAmount(
  amount: string,
  decimals: number
): bigint {
  return parseUnits(amount, decimals)
}
```

### Truncate Transaction Hash

```typescript
export function truncateTxHash(hash: string): string {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`
}
```

## Error Handling Patterns

### Graceful Error Handling

```typescript
import { useWriteContract } from 'wagmi'
import { useState } from 'react'

export function SafeContractWrite() {
  const [error, setError] = useState<string | null>(null)
  const { writeContract, isPending } = useWriteContract({
    mutation: {
      onError: (error) => {
        setError(error.message)
      },
      onSuccess: () => {
        setError(null)
      },
    },
  })

  return (
    <div>
      <button
        onClick={() => {
          setError(null)
          writeContract({
            address: CONTRACT_ADDRESS,
            abi: contractAbi,
            functionName: 'increment',
          })
        }}
        disabled={isPending}
      >
        {isPending ? 'Processing...' : 'Increment'}
      </button>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  )
}
```

## Testing Patterns

### Mock Wagmi Config for Testing

```typescript
import { createConfig } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'
import { mock } from 'wagmi/connectors'

export const testConfig = createConfig({
  chains: [baseSepolia],
  connectors: [mock({ accounts: ['0x...'] })],
  transports: {
    [baseSepolia.id]: http(),
  },
})
```

---

**Remember**: Always verify current documentation at https://docs.base.org before using these snippets in production.
