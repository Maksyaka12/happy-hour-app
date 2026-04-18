import { useCallback } from 'react'
import { useAccount, useSendTransaction, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { encodeFunctionData } from 'viem'
import { DATA_SUFFIX } from '../config/wagmi'
import { base } from 'wagmi/chains'

export function useBuilderWrite() {
  const { connector } = useAccount()

  // --- EOA Path (MetaMask, etc) ---
  const {
    data: txHashSend,
    sendTransaction,
    isPending: isPendingSend,
    error: errorSend,
    reset: resetSend
  } = useSendTransaction()

  // --- Smart Wallet Path (Base App) ---
  const {
    data: txHashWrite,
    writeContract: wagmiWriteContract,
    isPending: isPendingWrite,
    error: errorWrite,
    reset: resetWrite
  } = useWriteContract()

  // Unified State
  const txHash = txHashSend || txHashWrite
  const isPending = isPendingSend || isPendingWrite
  const error = errorSend || errorWrite

  const reset = useCallback(() => {
    resetSend()
    resetWrite()
  }, [resetSend, resetWrite])

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash })

  const writeContract = useCallback(
    ({ address, abi, functionName, args, value, chainId }) => {
      // Is this a Base Smart Wallet or Coinbase Wallet?
      const isSmartWallet = connector?.id === 'baseAccount' || connector?.id === 'coinbaseWalletSDK'

      if (isSmartWallet) {
        // SMART WALLET PATH
        // Rely on standard writeContract. Simulation works natively here.
        // Base auto-attributes via domain. Trying manual hex injection 
        // with Smart Wallets sometimes breaks their internal transaction build.
        wagmiWriteContract({
          address,
          abi,
          functionName,
          args,
          value,
          chainId: chainId || base.id,
        })
      } else {
        // EOA / METAMASK PATH
        // We use sendTransaction with manually encoded calldata + DATA_SUFFIX
        // This unconditionally locks the builder code into the transaction,
        // bypassing any wagmi simulation that might strip it.
        const calldata = encodeFunctionData({ abi, functionName, args })
        const dataWithSuffix = DATA_SUFFIX ? `${calldata}${DATA_SUFFIX.slice(2)}` : calldata
        
        sendTransaction({
          to: address,
          data: dataWithSuffix,
          value,
          chainId: chainId || base.id,
        })
      }
    },
    [connector, wagmiWriteContract, sendTransaction]
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
