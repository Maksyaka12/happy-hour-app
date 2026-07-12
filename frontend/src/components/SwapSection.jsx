import React from 'react';
import CustomSwapWidget from './CustomSwapWidget';

export default function SwapSection() {
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
        marginBottom: 8,
        fontWeight: 600,
        fontFamily: 'Inter, sans-serif'
      }}>
        Swap $HH
      </h2>
      <p style={{ 
        color: '#8A8F9E', 
        fontSize: 16, 
        marginBottom: 32,
        maxWidth: 400,
        textAlign: 'center',
        fontFamily: 'Inter, sans-serif'
      }}>
        Trade your ETH or USDC for $HH tokens directly via Uniswap on the Base network.
      </p>

      <div style={{
        padding: '24px',
        background: 'rgba(26, 29, 36, 0.4)',
        borderRadius: 24,
        border: '1px solid rgba(193, 196, 205, 0.1)'
      }}>
        <CustomSwapWidget width={400} />
      </div>
    </div>
  );
}
