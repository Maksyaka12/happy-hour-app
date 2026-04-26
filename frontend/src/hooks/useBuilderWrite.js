import { useCallback, useMemo, useState, useEffect } from 'react'
import { useAccount, useSendTransaction, useWaitForTransactionReceipt } from 'wagmi'
import { useSendCalls, useCallsStatus } from 'wagmi/experimental'
import { encodeFunctionData } from 'viem'
import { DATA_SUFFIX } from '../config/wagmi'
import { base } from 'wagmi/chains'

export function useBuilderWrite() {
  const { connector } = useAccount()
  const [callsId, setCallsId] = useState(null)

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

  // --- Smart Wallet Path ---
  const {
    sendCalls,
    data: swCallsId,
    isPending: isPendingSw,
    error: errorSw,
    reset: resetSw
  } = useSendCalls()

  // Track the current active callsId
  useEffect(() => {
    if (swCallsId) setCallsId(swCallsId)
  }, [swCallsId])

  // --- Tracking Status ---
  const { 
    isLoading: isConfirmingEoa, 
    isSuccess: isSuccessEoa 
  } = useWaitForTransactionReceipt({ hash: eoaHash })

  const { 
    data: callsStatus,
    error: statusError
  } = useCallsStatus({ 
    id: callsId,
    query: {
      enabled: !!callsId,
      refetchInterval: 1000
    }
  })

  const txHashFromSw = callsStatus?.receipts?.[0]?.transactionHash
  
  // Case-insensitive check for 'confirmed' status
  const isSuccessSw = callsStatus?.status?.toLowerCase() === 'confirmed'
  
  // It is confirming if we have an ID but not yet confirmed and no error
  const isConfirmingSw = !!callsId && !isSuccessSw && !errorSw && !statusError

  const writeContract = useCallback(
    ({ address: contractAddress, abi, functionName, args, value, chainId }) => {
      if (!contractAddress) return

      if (isSmartWallet) {
        setCallsId(null)
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
    resetEoa()
    resetSw()
  }, [resetEoa, resetSw])

  return {
    data: eoaHash || txHashFromSw,
    writeContract,
    isPending: isPendingEoa || isPendingSw,
    isConfirming: isConfirmingEoa || isConfirmingSw,
    isSuccess: isSuccessEoa || isSuccessSw,
    error: errorEoa || errorSw || statusError,
    reset,
  }
}
