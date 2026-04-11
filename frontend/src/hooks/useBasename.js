// src/hooks/useBasename.js
// Resolves Base Name Service (basename) for an address
// Docs: https://docs.base.org/identity/basenames

import { getName } from '@coinbase/onchainkit/identity'
import { useQuery } from '@tanstack/react-query'

/**
 * Returns the Base Name (e.g. "mksgg.base.eth") for the given address,
 * or null if the address has no registered basename.
 */
export function useBasename(address) {
  const { data } = useQuery({
    queryKey: ['basename', address],
    queryFn: async () => {
      try {
        const name = await getName({ address })
        return name || null
      } catch (err) {
        console.error('Error fetching basename from onchainkit:', err)
        return null
      }
    },
    enabled: !!address,
  })

  return data || null
}
