import React, { useState, useEffect } from 'react';
import { SwapWidget } from '@uniswap/widgets';
import { useWallets } from '@privy-io/react-auth';

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

export default function CustomSwapWidget({ width = 360 }) {
  const { wallets } = useWallets();
  const activeWallet = wallets.length > 0 ? wallets[0] : null;
  const [provider, setProvider] = useState(null);

  useEffect(() => {
    let isMounted = true;
    if (activeWallet) {
      activeWallet.getEthereumProvider().then(p => {
        if (isMounted) setProvider(p);
      });
    } else {
      setProvider(null);
    }
    return () => { isMounted = false; };
  }, [activeWallet]);

  return (
    <div className="uniswap-widget-wrapper" style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
      <SwapWidget
        width={width}
        theme={customTheme}
        provider={provider}
        jsonRpcUrlMap={jsonRpcUrlMap}
        defaultInputTokenAddress="NATIVE" // ETH on Base
        defaultOutputTokenAddress={HH_TOKEN_ADDRESS}
        defaultChainId={8453}
        hideConnectionUI={true}
      />
    </div>
  );
}
