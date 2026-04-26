import { useCallback } from 'react'
import { useAccount, useSendTransaction, useWriteContract } from 'wagmi'
import { encodeFunctionData } from 'viem'
import { DATA_SUFFIX } from '../config/wagmi'
import { base } from 'wagmi/chains'

export function useBuilderWrite() {
  const { connector } = useAccount()

  // --- EOA Path (MetaMask) ---
  const {
    data: txHash,
    sendTransaction,
    isPending,
    error,
    reset
  } = useSendTransaction()

  const writeContract = useCallback(
    ({ address, abi, functionName, args, value, chainId }) => {
      if (!address) return

      // Encode the function call to raw data
      const calldata = encodeFunctionData({ abi, functionName, args })
      
      // Append the Builder Code suffix manually to the end of the calldata
      // This works for BOTH EOA and Smart Wallets on Base
      const dataWithSuffix = DATA_SUFFIX 
        ? `${calldata}${DATA_SUFFIX.slice(2)}` 
        : calldata

      sendTransaction({
        to: address,
        data: dataWithSuffix,
        value,
        chainId: chainId || base.id,
      })
    },
    [sendTransaction]
  )

  return {
    data: txHash,
    writeContract,
    isPending,
    error,
    reset,
  }
}
