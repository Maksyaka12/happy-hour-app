import React, { useState } from 'react';
import CustomSwapWidget from './CustomSwapWidget';
import { useWallets, usePrivy } from '@privy-io/react-auth';

export default function SwapSection() {
  const { wallets } = useWallets()
  const { user: privyUser } = usePrivy()

  const [activeWalletType, setActiveWalletType] = useState('external') // 'embedded' | 'external'

  // Find the active wallet based on Privy linked accounts
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
  
  const activeWallet = activeWalletType === 'embedded' ? embeddedWallet : externalWallet;

  const handleToggleWallet = () => {
    setActiveWalletType(prev => prev === 'embedded' ? 'external' : 'embedded');
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '100vh',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <div style={{
        width: '100%',
        maxWidth: 640,
        margin: '0 auto',
        padding: '24px',
        background: 'rgba(26, 29, 36, 0.4)',
        borderRadius: 24,
        border: '1px solid rgba(193, 196, 205, 0.1)',
        boxSizing: 'border-box',
        fontFamily: 'Inter, sans-serif'
      }}>
        {/* Wallet mode toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, padding: '16px 20px', background: 'rgba(255,255,255,0.03)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <div style={{ fontSize: 15, color: '#F8FAFC', fontWeight: 600 }}>Wallet mode</div>
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>{activeWalletType === 'embedded' ? 'Using HH Embedded Wallet' : 'Using External Wallet'}</div>
          </div>
          <button
            onClick={handleToggleWallet}
            style={{
              position: 'relative',
              width: 44,
              height: 24,
              background: activeWalletType === 'external' ? '#3B82F6' : 'rgba(255,255,255,0.15)',
              borderRadius: 12,
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.2s',
              padding: 0,
            }}
            title={activeWalletType === 'embedded' ? 'Switch to External Wallet' : 'Switch to Embedded Wallet'}
          >
            <div style={{
              position: 'absolute',
              top: 3,
              left: activeWalletType === 'external' ? 23 : 3,
              width: 18,
              height: 18,
              background: '#FFFFFF',
              borderRadius: '50%',
              transition: 'left 0.2s',
            }} />
          </button>
        </div>

        {activeWallet ? (
          <CustomSwapWidget width="100%" wallet={activeWallet} />
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 0', background: 'rgba(255,255,255,0.02)', borderRadius: 16, border: '1px dashed rgba(255,255,255,0.1)' }}>
            <p style={{ color: '#94A3B8', fontSize: 15 }}>
              {activeWalletType === 'external' 
                ? 'Connect an external wallet in Account settings to swap.'
                : 'No embedded wallet found.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
