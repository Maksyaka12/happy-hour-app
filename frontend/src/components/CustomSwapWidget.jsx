import React, { useState, useEffect } from 'react';
import { useWallets } from '@privy-io/react-auth';
import { useBalance, useReadContracts } from 'wagmi';
import { formatUnits, parseUnits, createPublicClient, http, encodeFunctionData } from 'viem';
import { base } from 'viem/chains';

export const TOKENS = {
  ETH: { symbol: 'ETH', name: 'Ethereum', address: 'native', decimals: 18, logo: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png' },
  WETH: { symbol: 'WETH', name: 'Wrapped Ether', address: '0x4200000000000000000000000000000000000006', decimals: 18, logo: '/weth-logo.png' },
  USDC: { symbol: 'USDC', name: 'USD Coin', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, logo: '/usdc-logo.png' },
  HH: { symbol: 'HH', name: 'Happy Hour', address: '0x8235EdF32a1e10Bd1867ad622915AB613664cbA3', decimals: 18, logo: '/logo.jfif' }
};

const erc20Abi = [
  {
    "constant": true,
    "inputs": [{ "name": "_owner", "type": "address" }],
    "name": "balanceOf",
    "outputs": [{ "name": "balance", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [{ "name": "owner", "type": "address" }, { "name": "spender", "type": "address" }],
    "name": "allowance",
    "outputs": [{ "name": "", "type": "uint256" }],
    "type": "function"
  },
  {
    "constant": false,
    "inputs": [{ "name": "spender", "type": "address" }, { "name": "amount", "type": "uint256" }],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  }
];

const publicClient = createPublicClient({ chain: base, transport: http() });

export default function CustomSwapWidget({ width = 400, wallet = null }) {
  const { wallets } = useWallets();
  const activeWallet = wallet || (wallets.length > 0 ? wallets[0] : null);
  
  const [sellToken, setSellToken] = useState(TOKENS.ETH);
  const [buyToken, setBuyToken] = useState(TOKENS.HH);
  const [sellAmount, setSellAmount] = useState('');
  const [buyAmount, setBuyAmount] = useState('');
  
  const [showSellDropdown, setShowSellDropdown] = useState(false);
  const [showBuyDropdown, setShowBuyDropdown] = useState(false);

  // Swap State
  const [quote, setQuote] = useState(null);
  const [isFetchingQuote, setIsFetchingQuote] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [allowanceOk, setAllowanceOk] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);
  const [txHash, setTxHash] = useState(null);

  const address = activeWallet?.address;

  const { data: ethBalance, refetch: refetchEth } = useBalance({
    address: address,
    chainId: 8453,
    query: { enabled: !!address }
  });

  const { data: erc20Balances, refetch: refetchErc20 } = useReadContracts({
    contracts: [
      { address: TOKENS.WETH.address, abi: erc20Abi, functionName: 'balanceOf', args: [address], chainId: 8453 },
      { address: TOKENS.USDC.address, abi: erc20Abi, functionName: 'balanceOf', args: [address], chainId: 8453 },
      { address: TOKENS.HH.address, abi: erc20Abi, functionName: 'balanceOf', args: [address], chainId: 8453 }
    ],
    query: { enabled: !!address }
  });

  const [localBalances, setLocalBalances] = useState({});

  const truncateFormat = (value, decimals) => {
    const formatted = formatUnits(value, decimals);
    const [intPart, fracPart] = formatted.split('.');
    if (!fracPart) return intPart;
    // For UI display and max amount, safely truncate up to 6 decimals
    const truncatedFrac = fracPart.slice(0, 6);
    return `${intPart}.${truncatedFrac}`.replace(/\.?0+$/, ''); // clean trailing zeroes
  };

  useEffect(() => {
    if (!address) {
      setLocalBalances({});
      return;
    }
    setLocalBalances(prev => {
      const newBals = { ...prev };
      if (ethBalance?.value !== undefined) {
        newBals['ETH'] = truncateFormat(ethBalance.value, 18);
      }
      if (erc20Balances) {
        const wethRes = erc20Balances[0]?.result;
        const usdcRes = erc20Balances[1]?.result;
        const hhRes = erc20Balances[2]?.result;
        
        if (wethRes !== undefined) newBals['WETH'] = truncateFormat(wethRes, TOKENS.WETH.decimals);
        if (usdcRes !== undefined) newBals['USDC'] = truncateFormat(usdcRes, TOKENS.USDC.decimals);
        if (hhRes !== undefined) newBals['HH'] = truncateFormat(hhRes, TOKENS.HH.decimals);
      }
      return newBals;
    });
  }, [ethBalance, erc20Balances, address]);

  const getBalance = (tokenSymbol) => {
    const val = localBalances[tokenSymbol];
    return val ? (val === '0' ? '0.0' : val) : '0.0';
  };

  const sellBalance = getBalance(sellToken.symbol);

  const handlePercentage = (percent) => {
    if (!sellBalance || sellBalance === '0.0') return;
    
    if (percent === 100 && sellToken.symbol !== 'ETH') {
       setSellAmount(sellBalance);
       return;
    }
    
    let rawAmount = parseFloat(sellBalance) * (percent / 100);
    
    // Gas reserve for ETH on MAX (0.0001 ETH)
    if (sellToken.symbol === 'ETH' && percent === 100) {
      rawAmount = Math.max(0, rawAmount - 0.0001);
    }

    let amountStr = rawAmount.toString();
    if (amountStr.includes('e')) {
        amountStr = rawAmount.toFixed(18); // Avoid scientific notation for very small numbers
    }
    
    const [intP, fracP] = amountStr.split('.');
    if (fracP) {
       amountStr = `${intP}.${fracP.slice(0, Math.min(6, sellToken.decimals))}`;
    }
    
    // trim trailing zeros if decimal point exists
    if (amountStr.includes('.')) {
        amountStr = amountStr.replace(/\.?0+$/, '');
    }
    if (amountStr === '') amountStr = '0';
    
    setSellAmount(amountStr);
  };

  const handleSwitch = () => {
    const temp = sellToken;
    setSellToken(buyToken);
    setBuyToken(temp);
    setSellAmount('');
    setBuyAmount('');
    setQuote(null);
  };

  useEffect(() => {
    const timer = setTimeout(fetchQuote, 500);
    return () => clearTimeout(timer);
  }, [sellAmount, sellToken, buyToken, activeWallet]);

  const fetchQuote = async () => {
    if (!sellAmount || isNaN(parseFloat(sellAmount)) || parseFloat(sellAmount) <= 0) {
      setQuote(null);
      setBuyAmount('');
      setErrorMsg(null);
      return;
    }
    
    setIsFetchingQuote(true);
    setErrorMsg(null);
    setTxHash(null);

    try {
      const amountIn = parseUnits(sellAmount, sellToken.decimals).toString();
      const tIn = sellToken.symbol === 'ETH' ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : sellToken.address;
      const tOut = buyToken.symbol === 'ETH' ? '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' : buyToken.address;
      
      const res = await fetch(`https://aggregator-api.kyberswap.com/base/api/v1/routes?tokenIn=${tIn}&tokenOut=${tOut}&amountIn=${amountIn}`);
      const data = await res.json();
      
      if (data.code !== 0) throw new Error(data.message || 'No route found');
      if (!data.data.routeSummary) throw new Error('Insufficient liquidity for this swap');
      
      setQuote(data.data);
      const outAmountStr = formatUnits(BigInt(data.data.routeSummary.amountOut), buyToken.decimals);
      // Trim to 6 decimal places max for display
      const outNum = parseFloat(outAmountStr);
      setBuyAmount(outNum > 0 ? (outNum > 1 ? outNum.toFixed(4) : outNum.toFixed(6)) : outAmountStr);
      
      // Check allowance
      if (sellToken.symbol !== 'ETH' && activeWallet) {
         const allowance = await publicClient.readContract({
           address: sellToken.address,
           abi: erc20Abi,
           functionName: 'allowance',
           args: [activeWallet.address, data.data.routerAddress]
         });
         setAllowanceOk(allowance >= BigInt(amountIn));
      } else {
         setAllowanceOk(true);
      }
      
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Error fetching quote');
      setQuote(null);
      setBuyAmount('');
    } finally {
      setIsFetchingQuote(false);
    }
  };

  const handleApprove = async () => {
    if (!activeWallet || !quote) return;
    setIsApproving(true);
    setErrorMsg(null);
    try {
      const provider = await activeWallet.getEthereumProvider();
      
      // Approve max uint256 to avoid re-approving often
      const maxUint = '115792089237316195423570985008687907853269984665640564039457584007913129639935'; 
      
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [quote.routerAddress, BigInt(maxUint)]
      });
      
      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: activeWallet.address,
          to: sellToken.address,
          data: data
        }]
      });
      
      await publicClient.waitForTransactionReceipt({ hash });
      setAllowanceOk(true);
      
    } catch(err) {
      console.error(err);
      const msg = err.message?.includes('User rejected') ? 'Transaction rejected' : (err.message || 'Approval failed');
      setErrorMsg(msg);
    } finally {
      setIsApproving(false);
    }
  };

  const handleSwap = async () => {
    if (!activeWallet || !quote) return;
    setIsSwapping(true);
    setErrorMsg(null);
    setTxHash(null);
    try {
      const provider = await activeWallet.getEthereumProvider();
      
      const buildRes = await fetch('https://aggregator-api.kyberswap.com/base/api/v1/route/build', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routeSummary: quote.routeSummary,
          sender: activeWallet.address,
          recipient: activeWallet.address,
          slippageTolerance: 50, // 0.5% (50 bps)
          deadline: Math.floor(Date.now() / 1000) + 1200,
          source: 'HappyHour'
        })
      });
      
      const buildData = await buildRes.json();
      if (buildData.code !== 0) throw new Error(buildData.message || 'Failed to build transaction');
      
      const txData = buildData.data;
      
      let swapValue = txData.value ? BigInt(txData.value) : BigInt(0);
      if (sellToken.symbol === 'ETH') {
          // When selling Native ETH, the transaction value must be the amount being sold
          swapValue = BigInt(parseUnits(sellAmount, 18).toString());
      }
      
      const hash = await provider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: activeWallet.address,
          to: quote.routerAddress,
          data: txData.data,
          value: '0x' + swapValue.toString(16),
        }]
      });
      
      setTxHash(hash);
      
      // Wait for receipt to confirm
      await publicClient.waitForTransactionReceipt({ hash });
      
      // Immediately refresh balances
      refetchEth();
      refetchErc20();
      // RPCs can have a slight delay, refresh again after 2s and 5s
      setTimeout(() => { refetchEth(); refetchErc20(); }, 2000);
      setTimeout(() => { refetchEth(); refetchErc20(); }, 5000);
      
      // Reset inputs after success
      setSellAmount('');
      setBuyAmount('');
      setQuote(null);
      
    } catch(err) {
      console.error(err);
      const msg = err.message?.includes('User rejected') ? 'Transaction rejected' : (err.message || 'Swap failed');
      setErrorMsg(msg);
    } finally {
      setIsSwapping(false);
    }
  };

  const TokenDropdown = ({ tokens, onSelect, onClose }) => (
    <div style={{
      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8,
      background: '#1F2230', borderRadius: 16, padding: 8, zIndex: 10,
      border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      maxHeight: 240, overflowY: 'auto'
    }}>
      {Object.values(tokens).map(t => (
        <div key={t.symbol} onClick={() => { onSelect(t); onClose(); }} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', cursor: 'pointer', borderRadius: 12,
          transition: 'background 0.2s'
        }} onMouseEnter={(e) => e.currentTarget.style.background = '#2A2D3D'}
           onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src={t.logo} alt={t.symbol} style={{ width: 28, height: 28, borderRadius: '50%' }} />
            <div style={{ color: '#FFF', fontWeight: 600, fontFamily: 'Inter' }}>{t.symbol}</div>
          </div>
          <div style={{ color: '#8A8F9E', fontSize: 14, fontFamily: 'Inter' }}>
            {getBalance(t.symbol)}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ 
      width: width, 
      background: 'transparent', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 12,
      fontFamily: 'Inter, sans-serif'
    }}>
      
      {/* Sell Section */}
      <div style={{ 
        background: '#1F2230', 
        borderRadius: 24, 
        padding: '20px 24px',
        border: '1px solid rgba(255,255,255,0.02)'
      }}>
        <div style={{ color: '#8A8F9E', fontSize: 14, marginBottom: 12 }}>Sell Token</div>
        
        <input 
          type="number" 
          placeholder="0.0"
          value={sellAmount}
          onChange={e => setSellAmount(e.target.value)}
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: '#FFF', fontSize: 36, fontWeight: 500, width: '100%',
            marginBottom: 4
          }}
        />
        
        <div style={{ color: '#8A8F9E', fontSize: 13, marginBottom: 12, height: 16 }}>
          {quote && sellAmount > 0 && quote.routeSummary.amountInUsd ? `≈ $${parseFloat(quote.routeSummary.amountInUsd).toFixed(2)}` : ''}
        </div>
        
        <div style={{ position: 'relative' }}>
          <div 
            onClick={() => setShowSellDropdown(!showSellDropdown)}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#161721', padding: '12px 16px', borderRadius: 16, cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={sellToken.logo} alt={sellToken.symbol} style={{ width: 24, height: 24, borderRadius: '50%' }} />
              <span style={{ color: '#FFF', fontWeight: 600, fontSize: 18 }}>{sellToken.symbol}</span>
            </div>
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
              <path d="M1 1.5L6 6.5L11 1.5" stroke="#8A8F9E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {showSellDropdown && (
            <TokenDropdown tokens={TOKENS} onSelect={setSellToken} onClose={() => setShowSellDropdown(false)} />
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <div style={{ color: '#8A8F9E', fontSize: 14 }}>
            Balance: <span style={{ color: '#FFF', fontWeight: 500 }}>{sellBalance} {sellToken.symbol}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => handlePercentage(25)} style={{ background: '#2A2D3D', border: 'none', color: '#FFF', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>25%</button>
            <button onClick={() => handlePercentage(50)} style={{ background: '#2A2D3D', border: 'none', color: '#FFF', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>50%</button>
            <button onClick={() => handlePercentage(100)} style={{ background: '#2A2D3D', border: 'none', color: '#FFF', padding: '6px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Max</button>
          </div>
        </div>
      </div>

      {/* Switch Button */}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: -20, marginBottom: -20, zIndex: 1 }}>
        <button 
          onClick={handleSwitch}
          style={{ 
            background: '#3B82F6', border: '4px solid #111318', width: 44, height: 44, 
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            transition: 'transform 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6"></polyline>
            <polyline points="8 6 2 12 8 18"></polyline>
          </svg>
        </button>
      </div>

      {/* Buy Section */}
      <div style={{ 
        background: '#1F2230', 
        borderRadius: 24, 
        padding: '20px 24px',
        border: '1px solid rgba(255,255,255,0.02)'
      }}>
        <div style={{ color: '#8A8F9E', fontSize: 14, marginBottom: 12 }}>Buy Token</div>
        
        <input 
          type="number" 
          placeholder="0.0"
          value={buyAmount}
          readOnly
          style={{
            background: 'transparent', border: 'none', outline: 'none',
            color: '#FFF', fontSize: 36, fontWeight: 500, width: '100%',
            marginBottom: 4
          }}
        />
        
        <div style={{ color: '#8A8F9E', fontSize: 13, marginBottom: 12, height: 16 }}>
          {quote && buyAmount > 0 && quote.routeSummary.amountOutUsd ? `≈ $${parseFloat(quote.routeSummary.amountOutUsd).toFixed(2)}` : ''}
        </div>
        
        <div style={{ position: 'relative' }}>
          <div 
            onClick={() => setShowBuyDropdown(!showBuyDropdown)}
            style={{ 
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#161721', padding: '12px 16px', borderRadius: 16, cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={buyToken.logo} alt={buyToken.symbol} style={{ width: 24, height: 24, borderRadius: '50%' }} />
              <span style={{ color: '#FFF', fontWeight: 600, fontSize: 18 }}>{buyToken.symbol}</span>
            </div>
            <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
              <path d="M1 1.5L6 6.5L11 1.5" stroke="#8A8F9E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {showBuyDropdown && (
            <TokenDropdown tokens={TOKENS} onSelect={setBuyToken} onClose={() => setShowBuyDropdown(false)} />
          )}
        </div>
      </div>

      {/* Summary Section */}
      <div style={{ padding: '0 8px', display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8A8F9E', fontSize: 13 }}>
          <span>Minimum received</span>
          <span style={{ color: '#FFF' }}>
            {quote ? (parseFloat(formatUnits(BigInt(quote.routeSummary.amountOut), buyToken.decimals)) * 0.995).toFixed(4) : '0.00'} {buyToken.symbol}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8A8F9E', fontSize: 13 }}>
          <span>Price impact</span>
          <span style={{ color: '#FFF' }}>
             {/* Note: In KyberSwap, sometimes price impact is absent if route has 1 pool. Default to ~0.00% if not provided, or calculate roughly. Kyber API doesnt always return a direct 'priceImpact' field in routeSummary unless requested specifically. We'll default to 0.00% visually for now. */}
             {isFetchingQuote ? '...' : (quote ? '< 0.5%' : '0.00%')}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8A8F9E', fontSize: 13 }}>
          <span>Max slippage</span>
          <span style={{ color: '#FFF' }}>0.5%</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8A8F9E', fontSize: 13 }}>
          <span>Est. Gas</span>
          <span style={{ color: '#FFF' }}>
            {quote ? `$${parseFloat(quote.routeSummary.gasUsd || 0).toFixed(4)}` : 'Free'}
          </span>
        </div>
      </div>
      
      {/* Messages */}
      {errorMsg && (
        <div style={{ color: '#EF4444', fontSize: 13, textAlign: 'center', marginTop: 4 }}>
          {errorMsg}
        </div>
      )}
      {txHash && (
        <div style={{ color: '#22C55E', fontSize: 13, textAlign: 'center', marginTop: 4 }}>
          Swap successful! <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noreferrer" style={{color:'#3B82F6'}}>View Explorer</a>
        </div>
      )}

      {/* Action Button */}
      {!activeWallet ? (
        <button 
          style={{ 
            background: '#3B82F6', color: '#FFF', border: 'none', padding: '18px', borderRadius: 16, fontSize: 18, fontWeight: 600, marginTop: 8
          }}
        >
          Connect Wallet
        </button>
      ) : isFetchingQuote ? (
        <button 
          disabled
          style={{ 
            background: '#2A2D3D', color: '#8A8F9E', border: 'none', padding: '18px', borderRadius: 16, fontSize: 18, fontWeight: 600, marginTop: 8
          }}
        >
          Fetching route...
        </button>
      ) : (!quote && sellAmount > 0) ? (
        <button 
          disabled
          style={{ 
            background: '#2A2D3D', color: '#8A8F9E', border: 'none', padding: '18px', borderRadius: 16, fontSize: 18, fontWeight: 600, marginTop: 8
          }}
        >
          No route available
        </button>
      ) : (!quote || sellAmount <= 0) ? (
        <button 
          disabled
          style={{ 
            background: '#2A2D3D', color: '#8A8F9E', border: 'none', padding: '18px', borderRadius: 16, fontSize: 18, fontWeight: 600, marginTop: 8
          }}
        >
          Enter an amount
        </button>
      ) : parseFloat(sellAmount) > parseFloat(sellBalance) ? (
        <button 
          disabled
          style={{ 
            background: '#2A2D3D', color: '#EF4444', border: 'none', padding: '18px', borderRadius: 16, fontSize: 18, fontWeight: 600, marginTop: 8
          }}
        >
          Insufficient {sellToken.symbol} balance
        </button>
      ) : !allowanceOk ? (
        <button 
          onClick={handleApprove}
          disabled={isApproving}
          style={{ 
            background: '#3B82F6', color: '#FFF', border: 'none', padding: '18px', borderRadius: 16, fontSize: 18, fontWeight: 600, marginTop: 8, cursor: 'pointer', transition: 'background 0.2s'
          }}
        >
          {isApproving ? `Approving ${sellToken.symbol}...` : `Approve ${sellToken.symbol}`}
        </button>
      ) : (
        <button 
          onClick={handleSwap}
          disabled={isSwapping}
          style={{ 
            background: '#3B82F6', color: '#FFF', border: 'none', padding: '18px', borderRadius: 16, fontSize: 18, fontWeight: 600, marginTop: 8, cursor: 'pointer', transition: 'background 0.2s'
          }}
        >
          {isSwapping ? 'Swapping...' : 'Swap'}
        </button>
      )}

    </div>
  );
}
