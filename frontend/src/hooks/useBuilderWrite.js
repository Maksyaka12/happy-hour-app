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

  // Track the current active callsId - Ensure it's a string
  useEffect(() => {
    if (swCallsId && typeof swCallsId === 'string') {
      setCallsId(swCallsId)
    } else if (swCallsId && typeof swCallsId === 'object') {
      // Some providers return an object with id
      setCallsId(swCallsId.id || null)
    }
  }, [swCallsId])

  // --- Tracking Status ---
  // Only pass hash if it's a valid string to avoid u.endsWith errors
  const validEoaHash = typeof eoaHash === 'string' ? eoaHash : undefined
  const { 
    isLoading: isConfirmingEoa, 
    isSuccess: isSuccessEoa 
  } = useWaitForTransactionReceipt({ hash: validEoaHash })

  const { 
    data: callsStatus,
    error: statusError
  } = useCallsStatus({ 
    id: callsId || undefined,
    query: {
      enabled: !!callsId,
      refetchInterval: 1000
    }
  })

  const txHashFromSw = callsStatus?.receipts?.[0]?.transactionHash
  
  // Broad success check for different wallet providers
  const swStatus = callsStatus?.status?.toLowerCase()
  const isSuccessSw = 
    swStatus === 'confirmed' || 
    swStatus === 'success' || 
    swStatus === 'completed' || 
    swStatus === 'processed' ||
    (!!txHashFromSw && 
     swStatus !== 'pending' && 
     swStatus !== 'failed' && 
     swStatus !== 'error' && 
     swStatus !== 'reverted')

  // It is confirming if we have an active ID and no success/error yet
  const isConfirmingSw = !!callsId && !isSuccessSw && !errorSw && !statusError

  const writeContract = useCallback(
    ({ address: contractAddress, abi, functionName, args, value, chainId }) => {
      if (!contractAddress || typeof contractAddress !== 'string') return

      if (isSmartWallet) {
        setCallsId(null) // Reset state before new call
        sendCalls({
          calls: [{
            to: contractAddress,
            data: encodeFunctionData({ abi, functionName, args }),
            value: value ? BigInt(value) : undefined
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
          value: value ? BigInt(value) : undefined,
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
    error: errorEoa || errorSw || (statusError?.message?.includes('method not found') ? null : statusError),
    reset,
  }
}
