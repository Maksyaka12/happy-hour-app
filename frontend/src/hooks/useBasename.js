// src/hooks/useBasename.js
// Resolves Base Name Service (basename) for an address
// by reading directly from the L2 Resolver contract on Base mainnet.
// Docs: https://docs.base.org/identity/basenames

import { useReadContract } from 'wagmi'
import { base } from 'wagmi/chains'
import { namehash } from 'viem'

// Base Name Service — L2 Resolver on Base mainnet
const L2_RESOLVER_ADDRESS = '0xC6d566A56A1aFf6508b41f6c90ff131615583BCD'

const RESOLVER_ABI = [
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs:  [{ name: 'node', type: 'bytes32' }],
    outputs: [{ name: '',    type: 'string'  }],
  },
]

/**
 * Returns the Base Name (e.g. "mksgg.base.eth") for the given address,
 * or null if the address has no registered basename.
 */
export function useBasename(address) {
  // ENS reverse node: namehash("<address_lowercase_no_0x>.addr.reverse")
  const reverseNode = address
    ? namehash(`${address.slice(2).toLowerCase()}.addr.reverse`)
    : undefined

  const { data } = useReadContract({
    address:      L2_RESOLVER_ADDRESS,
    abi:          RESOLVER_ABI,
    functionName: 'name',
    args:         [reverseNode],
    chainId:      base.id,
    query:        { enabled: !!address && !!reverseNode },
  })

  // Return basename only if it's a non-empty string
  return (typeof data === 'string' && data.length > 0) ? data : null
}
