import { useCallback, useMemo } from 'react'
import { useAccount, useWriteContract, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi'
import { encodeFunctionData } from 'viem'
import { DATA_SUFFIX } from '../config/wagmi'
import { base } from 'wagmi/chains'

export function useBuilderWrite() {
  const { connector } = useAccount()

  const isSmartWallet = useMemo(() => 
    connector?.id === 'baseAccount' || connector?.id === 'coinbaseWalletSDK',
    [connector]
  )

  const {
    data: hashWrite,
    writeContract: wagmiWriteContract,
    isPending: isPendingWrite,
    error: errorWrite,
    reset: resetWrite
  } = useWriteContract()

  const {
    data: hashSend,
    sendTransaction,
    isPending: isPendingSend,
    error: errorSend,
    reset: resetSend
  } = useSendTransaction()

  const txHash = hashWrite || hashSend

  const { 
    isLoading: isConfirming, 
    isSuccess 
  } = useWaitForTransactionReceipt({ hash: txHash })

  const writeContract = useCallback(
    ({ address: contractAddress, abi, functionName, args, value, chainId }) => {
      if (!contractAddress) return

      if (isSmartWallet) {
        // Smart Wallet: Use writeContract + capabilities for proper attribution
        wagmiWriteContract({
          address: contractAddress,
          abi,
          functionName,
          args,
          value,
          chainId: chainId || base.id,
          capabilities: DATA_SUFFIX ? {
            dataSuffix: {
              value: DATA_SUFFIX,
              optional: true
            }
          } : undefined
        })
      } else {
        // EOA: Use sendTransaction + manual suffix for standard wallets
        const calldata = encodeFunctionData({ abi, functionName, args })
        const dataWithSuffix = DATA_SUFFIX 
          ? `${calldata}${DATA_SUFFIX.slice(2)}` 
          : calldata

        sendTransaction({
          to: contractAddress,
          data: dataWithSuffix,
          value,
          chainId: chainId || base.id,
        })
      }
    },
    [isSmartWallet, wagmiWriteContract, sendTransaction]
  )

  const reset = useCallback(() => {
    resetWrite()
    resetSend()
  }, [resetWrite, resetSend])

  return {
    data: txHash,
    writeContract,
    isPending: isPendingWrite || isPendingSend,
    isConfirming,
    isSuccess,
    error: errorWrite || errorSend,
    reset,
  }
}
