import React from 'react';
import CustomSwapWidget from './CustomSwapWidget';
import { useWallets, usePrivy } from '@privy-io/react-auth';

export default function SwapSection() {
  const { wallets } = useWallets()
  const { user: privyUser } = usePrivy()

  // Find the active wallet based on Privy linked accounts, prioritizing embedded
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy')
  const linkedExternalAddresses = new Set(
    (privyUser?.linkedAccounts || [])
      .filter(a => a.type === 'wallet' && a.walletClientType !== 'privy' && a.connectorType !== 'embedded')
      .map(a => a.address?.toLowerCase())
  )
  const externalWallet = wallets.find(w =>
    w.walletClientType !== 'privy' &&
    linkedExternalAddresses.has(w.address?.toLowerCase())
  )
  
  const activeWallet = externalWallet || embeddedWallet || null;

  return (
    <div style={{
      padding: '80px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '100vh',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <h2 style={{ 
        color: '#FFFFFF', 
        fontSize: 28, 
        marginBottom: 32,
        fontWeight: 600,
        fontFamily: 'Inter, sans-serif'
      }}>
        Trade $HH directly on the Happy Hour Platform
      </h2>

      <div style={{
        width: '100%',
        maxWidth: 640,
        margin: '0 auto',
        padding: '24px',
        background: 'rgba(26, 29, 36, 0.4)',
        borderRadius: 24,
        border: '1px solid rgba(193, 196, 205, 0.1)',
        boxSizing: 'border-box'
      }}>
        <CustomSwapWidget width="100%" wallet={activeWallet} />
      </div>
    </div>
  );
}
