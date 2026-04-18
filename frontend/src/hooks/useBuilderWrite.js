import { useCallback } from 'react'
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi'
import { encodeFunctionData } from 'viem'
import { DATA_SUFFIX } from '../config/wagmi'
import { base } from 'wagmi/chains'

export function useBuilderWrite() {
  const {
    data: txHash,
    sendTransaction,
    isPending,
    error,
    reset
  } = useSendTransaction()

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const writeContract = useCallback(
    ({ address, abi, functionName, args, value, chainId }) => {
      // UNIVERSAL PATH (For both EOA and Smart Wallets)
      // We use sendTransaction with manually encoded calldata + DATA_SUFFIX
      // For EOA: It locks it directly in the top-level tx data.
      // For Smart Wallets: It locks it inside the UserOperation's internal callData.
      // This bypasses wagmi's simulation (which strips trailing data) and ensures Base Indexers
      // catch the Builder Code inside the handleOps execution.
      const calldata = encodeFunctionData({ abi, functionName, args })
      const dataWithSuffix = DATA_SUFFIX ? `${calldata}${DATA_SUFFIX.slice(2)}` : calldata
      
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
    txHash,
    writeContract,
    isPending,
    isConfirming,
    isSuccess,
    error,
    reset,
  }
}
