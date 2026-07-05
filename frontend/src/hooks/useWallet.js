import { usePrivy, useWallets } from '@privy-io/react-auth'

export function useWallet() {
  const { user, authenticated } = usePrivy()
  const { wallets } = useWallets()

  const wallet = wallets[0]
  const address = user?.wallet?.address

  const getProvider = async () => {
    if (!wallet) return null
    return await wallet.getEthereumProvider()
  }

  return {
    address,
    authenticated,
    wallet,
    getProvider,
  }
}
