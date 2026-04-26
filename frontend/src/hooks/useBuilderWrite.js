import { useCallback, useMemo, useState } from 'react'
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi'
import { useSendCalls, useCallsStatus } from 'wagmi/experimental'
import { encodeFunctionData } from 'viem'
import { DATA_SUFFIX } from '../config/wagmi'
import { base } from 'wagmi/chains'

export function useBuilderWrite() {
  const { connector, address } = useAccount()
  const [callsId, setCallsId] = useState(null)
  const [txHash, setTxHash] = useState(null)

  const isSmartWallet = useMemo(() => 
    connector?.id === 'baseAccount' || connector?.id === 'coinbaseWalletSDK',
    [connector]
  )

  // --- EOA Path ---
  const {
    sendTransaction,
    data: eoaHash,
    isPending: isPendingEoa,
    error: errorEoa,
    reset: resetEoa
  } = useSendTransaction()

  // --- Smart Wallet Path (ERC-5792) ---
  const {
    sendCalls,
    data: swCallsId,
    isPending: isPendingSw,
    error: errorSw,
    reset: resetSw
  } = useSendCalls()

  // --- Tracking Status ---
  const { 
    isLoading: isConfirmingEoa, 
    isSuccess: isSuccessEoa 
  } = useWaitForTransactionReceipt({ hash: eoaHash || txHash })

  const { 
    data: callsStatus,
    isLoading: isConfirmingSw 
  } = useCallsStatus({ 
    id: swCallsId || callsId,
    query: {
      enabled: !!(swCallsId || callsId),
      refetchInterval: 1000
    }
  })

  const isSuccessSw = callsStatus?.status === 'confirmed'

  const writeContract = useCallback(
    ({ address: contractAddress, abi, functionName, args, value, chainId }) => {
      if (!contractAddress) return

      if (isSmartWallet) {
        // Use sendCalls for Smart Wallets with capabilities
        sendCalls({
          calls: [{
            to: contractAddress,
            data: encodeFunctionData({ abi, functionName, args }),
            value
          }],
          capabilities: DATA_SUFFIX ? {
            dataSuffix: {
              value: DATA_SUFFIX,
              optional: true
            }
          } : undefined,
          chainId: chainId || base.id
        })
      } else {
        // Use sendTransaction for EOA with manual suffix
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
    [isSmartWallet, sendCalls, sendTransaction]
  )

  const reset = useCallback(() => {
    setCallsId(null)
    setTxHash(null)
    resetEoa()
    resetSw()
  }, [resetEoa, resetSw])

  return {
    data: eoaHash || (callsStatus?.receipts?.[0]?.transactionHash),
    writeContract,
    isPending: isPendingEoa || isPendingSw,
    isConfirming: isConfirmingEoa || isConfirmingSw,
    isSuccess: isSuccessEoa || isSuccessSw,
    error: errorEoa || errorSw,
    reset,
  }
}
