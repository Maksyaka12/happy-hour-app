import { useCallback } from 'react'
import { useAccount, useSendTransaction, useWriteContract } from 'wagmi'
import { encodeFunctionData } from 'viem'
import { DATA_SUFFIX } from '../config/wagmi'
import { base } from 'wagmi/chains'

export function useBuilderWrite() {
  const { connector } = useAccount()

  // --- EOA Path (MetaMask) ---
  const {
    data: txHashSend,
    sendTransaction,
    isPending: isPendingSend,
    error: errorSend,
    reset: resetSend
  } = useSendTransaction()

  // --- Smart Wallet Path ---
  const {
    data: txHashWrite,
    writeContract: wagmiWriteContract,
    isPending: isPendingWrite,
    error: errorWrite,
    reset: resetWrite
  } = useWriteContract()

  const writeContract = useCallback(
    ({ address, abi, functionName, args, value, chainId }) => {
      const isSmartWallet = connector?.id === 'baseAccount' || connector?.id === 'coinbaseWalletSDK'

      if (isSmartWallet) {
        // Smart Wallet uses capabilities (ERC-5792) for builder code attribution.
        wagmiWriteContract({
          address,
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
        // MetaMask / EOA requires hardcoding the Builder Code in the payload.
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
    data: txHashSend || txHashWrite,
    writeContract,
    isPending: isPendingSend || isPendingWrite,
    error: errorSend || errorWrite,
    reset: useCallback(() => { resetSend(); resetWrite() }, [resetSend, resetWrite]),
  }
}
