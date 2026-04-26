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
    error: statusError
  } = useCallsStatus({ 
    id: swCallsId || callsId,
    query: {
      enabled: !!(swCallsId || callsId),
      refetchInterval: 1000
    }
  })

  // A Smart Wallet call is only truly "successful" for us when we have the on-chain TX hash
  const txHashFromSw = callsStatus?.receipts?.[0]?.transactionHash
  const isSuccessSw = callsStatus?.status === 'confirmed' && !!txHashFromSw
  
  // It is confirming if it's pending OR if it's confirmed but we are still waiting for the indexer to give us the hash
  const isConfirmingSw = (swCallsId || callsId) && !isSuccessSw && !errorSw && !statusError

  const writeContract = useCallback(
    ({ address: contractAddress, abi, functionName, args, value, chainId }) => {
      if (!contractAddress) return

      if (isSmartWallet) {
        setCallsId(null) // Reset old IDs
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
        setTxHash(null) // Reset old hashes
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
    data: eoaHash || txHashFromSw,
    writeContract,
    isPending: isPendingEoa || isPendingSw,
    isConfirming: isConfirmingEoa || isConfirmingSw,
    isSuccess: isSuccessEoa || isSuccessSw,
    error: errorEoa || errorSw || statusError,
    reset,
  }
}
