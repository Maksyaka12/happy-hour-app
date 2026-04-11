// src/hooks/useBasename.js
// Resolves Base Name Service (basename) for an address
// Docs: https://docs.base.org/identity/basenames

import { useEnsName } from 'wagmi'
import { base } from 'wagmi/chains'

/**
 * Returns the Base Name (e.g. "mksgg.base.eth") for the given address,
 * or null if the address has no registered basename.
 */
export function useBasename(address) {
  const { data } = useEnsName({
    address,
    chainId: base.id
  })

  return data || null
}
