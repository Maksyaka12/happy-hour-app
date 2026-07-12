import React, { useState, useEffect } from 'react';
import { SwapWidget } from '@uniswap/widgets';
import { useWallets } from '@privy-io/react-auth';

import { ethers } from 'ethers';

// $HH Token Address on Base
const HH_TOKEN_ADDRESS = '0x8235EdF32a1e10Bd1867ad622915AB613664cbA3';

const jsonRpcUrlMap = {
  8453: ['https://mainnet.base.org'],
};

const customTheme = {
  primary: '#FFFFFF',
  secondary: '#C1C4CD',
  interactive: '#2D323E',
  container: '#111318', 
  module: '#1A1D24',
  accent: '#6E45E2', 
  outline: '#2D323E',
  dialog: '#111318',
  fontFamily: 'Inter, sans-serif',
  borderRadius: 16,
};

export default function CustomSwapWidget({ width = 360, wallet = null }) {
  const { wallets } = useWallets();
  const activeWallet = wallet || (wallets.length > 0 ? wallets[0] : null);
  const [provider, setProvider] = useState(null);
  const [tokenList, setTokenList] = useState(null);
  const [tokenListError, setTokenListError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (activeWallet) {
      activeWallet.getEthereumProvider().then(p => {
        if (isMounted) {
          const web3Provider = new ethers.providers.Web3Provider(p);
          setProvider(web3Provider);
        }
      });
    } else {
      setProvider(null);
    }
    return () => { isMounted = false; };
  }, [activeWallet]);

  useEffect(() => {
    fetch('https://tokens.uniswap.org')
      .then(res => res.json())
      .then(data => {
        // Filter out non-EVM tokens (like Solana) which currently break Uniswap Widget schema validation
        const evmTokens = data.tokens.filter(t => /^0x[a-fA-F0-9]{40}$/.test(t.address));
        setTokenList({
          ...data,
          tokens: evmTokens
        });
      })
      .catch(err => {
        console.error('Failed to fetch Uniswap token list:', err);
        setTokenListError(true);
      });
  }, []);

  return (
    <div className="uniswap-widget-wrapper" style={{ display: 'flex', justifyContent: 'center', width: '100%', minHeight: 360, alignItems: 'center' }}>
      {!activeWallet ? (
        <div style={{ color: '#8A8F9E', fontFamily: 'Inter', textAlign: 'center' }}>
          Please connect a wallet to use the swap feature.
        </div>
      ) : !provider || (!tokenList && !tokenListError) ? (
        <div style={{ color: '#8A8F9E', fontFamily: 'Inter', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 24, height: 24, border: '2px solid rgba(59,130,246,0.3)', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div>Initializing Swap Interface...</div>
        </div>
      ) : (
        <SwapWidget
          width={width}
          theme={customTheme}
          provider={provider}
          jsonRpcUrlMap={jsonRpcUrlMap}
          tokenList={tokenList || "https://tokens.uniswap.org"}
          defaultInputTokenAddress="NATIVE" // ETH on Base
          defaultOutputTokenAddress={HH_TOKEN_ADDRESS}
          hideConnectionUI={true}
        />
      )}
    </div>
  );
}
