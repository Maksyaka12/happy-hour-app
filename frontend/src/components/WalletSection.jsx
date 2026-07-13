import { useState, useCallback, useEffect } from 'react'
import { useWallets, usePrivy, useCreateWallet } from '@privy-io/react-auth'
import { useBalance, useReadContract, useReadContracts } from 'wagmi'
import { parseEther, isAddress, encodeFunctionData, parseUnits, formatUnits } from 'viem'
import { HH_ADDRESS, HH_ABI } from '../config/constants'
import CustomSwapWidget, { TOKENS } from './CustomSwapWidget'

const short = (a) => (a ? `${a.slice(0, 6)}\u2026${a.slice(-4)}` : '\u2014')

const formatBalance = (val, decimals = 18) => {
  if (val === undefined || val === null) return '0.00'
  const n = parseFloat(val) / 10 ** decimals
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'K'
  return n.toFixed(4)
}

// ─────────────────────────────────────────
// Sub-component: Deposit Modal
// ─────────────────────────────────────────
function DepositModal({ embeddedWallet, externalWallet, onRequireWallet, onClose }) {
  const [copied, setCopied] = useState(false)
  const embeddedAddress = embeddedWallet?.address

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embeddedAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  // State for depositing from External Wallet
  const [token, setToken] = useState(TOKENS.ETH)
  const [amount, setAmount] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [txHash, setTxHash] = useState(null)
  const [error, setError] = useState(null)
  const [showTokenSelect, setShowTokenSelect] = useState(false)

  const numAmt = parseFloat(amount)
  const isValidAmount = amount && !isNaN(numAmt) && numAmt > 0

  // Fetch balances for external wallet
  const { data: extEth } = useBalance({
    address: externalWallet?.address,
    chainId: 8453,
    query: { enabled: !!externalWallet?.address }
  })
  const erc20Abi = [
    {
      "constant": true,
      "inputs": [{ "name": "_owner", "type": "address" }],
      "name": "balanceOf",
      "outputs": [{ "name": "balance", "type": "uint256" }],
      "type": "function"
    }
  ]
  const { data: extErc20 } = useReadContracts({
    contracts: [
      { address: TOKENS.WETH.address, abi: erc20Abi, functionName: 'balanceOf', args: [externalWallet?.address], chainId: 8453 },
      { address: TOKENS.USDC.address, abi: erc20Abi, functionName: 'balanceOf', args: [externalWallet?.address], chainId: 8453 },
      { address: TOKENS.HH.address, abi: erc20Abi, functionName: 'balanceOf', args: [externalWallet?.address], chainId: 8453 }
    ],
    query: { enabled: !!externalWallet?.address }
  })

  const [extBalances, setExtBalances] = useState({ ETH: '0', WETH: '0', USDC: '0', HH: '0' })

  useEffect(() => {
    if (!externalWallet?.address) return setExtBalances({ ETH: '0', WETH: '0', USDC: '0', HH: '0' })
    const formatBalanceStr = (val, decimals) => {
      if (!val) return '0'
      const formatted = formatUnits(val, decimals)
      const [intPart, fracPart] = formatted.split('.')
      if (!fracPart) return intPart
      return `${intPart}.${fracPart.slice(0, 6)}`.replace(/\.?0+$/, '')
    }
    
    setExtBalances({
      ETH: formatBalanceStr(extEth?.value, 18),
      WETH: formatBalanceStr(extErc20?.[0]?.result, 18),
      USDC: formatBalanceStr(extErc20?.[1]?.result, 6),
      HH: formatBalanceStr(extErc20?.[2]?.result, 18)
    })
  }, [extEth, extErc20, externalWallet?.address])

  const handleMax = () => {
    let balStr = extBalances[token.symbol] || '0'
    let balNum = parseFloat(balStr)
    if (balNum <= 0) return setAmount('0')
    if (token.symbol === 'ETH') {
      const safeBal = Math.max(0, balNum - 0.0001)
      setAmount(safeBal.toFixed(6).replace(/\.?0+$/, ''))
    } else {
      setAmount(balStr)
    }
  }

  const handlePercent = (pct) => {
    if (pct === 100) return handleMax()
    let balStr = extBalances[token.symbol] || '0'
    let balNum = parseFloat(balStr)
    if (balNum <= 0) return setAmount('0')
    let target = balNum * (pct / 100)
    if (token.symbol === 'ETH' && target > Math.max(0, balNum - 0.0001)) {
        target = Math.max(0, balNum - 0.0001)
    }
    setAmount(target.toFixed(6).replace(/\.?0+$/, ''))
  }

  const handleDeposit = async () => {
    if (!isValidAmount || !externalWallet || !embeddedAddress) return
    setIsSending(true)
    setError(null)
    try {
      const provider = await externalWallet.getEthereumProvider()
      let tx;
      
      if (token.symbol === 'ETH') {
        tx = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: externalWallet.address,
            to: embeddedAddress,
            value: '0x' + parseEther(amount).toString(16),
          }]
        })
      } else {
        const data = encodeFunctionData({
          abi: [
            {
              "constant": false,
              "inputs": [
                { "name": "dst", "type": "address" },
                { "name": "wad", "type": "uint256" }
              ],
              "name": "transfer",
              "outputs": [{ "name": "", "type": "bool" }],
              "payable": false,
              "stateMutability": "nonpayable",
              "type": "function"
            }
          ],
          functionName: 'transfer',
          args: [embeddedAddress, parseUnits(amount, token.decimals)]
        })
        
        tx = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: externalWallet.address,
            to: token.address,
            data: data
          }]
        })
      }
      setTxHash(tx)
    } catch (err) {
      setError(err?.message || 'Transaction failed')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={{...modalBoxStyle, maxHeight: 'calc(100dvh - 40px)', overflowY: 'auto'}} onClick={e => { e.stopPropagation(); setShowTokenSelect(false); }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 700, margin: 0 }}>Deposit</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        {txHash ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ color: '#22C55E', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Transaction Sent!</div>
            <div style={{ color: '#94A3B8', fontSize: 13, wordBreak: 'break-all' }}>{txHash}</div>
            <button onClick={onClose} style={{ ...primaryBtn, marginTop: 20 }}>Close</button>
          </div>
        ) : (
          <>
            <p style={{ color: '#94A3B8', fontSize: 14, marginBottom: 8 }}>Select a chain to receive your funds</p>
            <div style={chainSelectStyle}>
              <img src="/base_logo.webp" alt="Base" style={{ width: 20, height: 20, borderRadius: 4 }} />
              <span style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 600 }}>Base</span>
            </div>

            <p style={{ color: '#94A3B8', fontSize: 14, margin: '16px 0 8px' }}>
              Transfer tokens directly
            </p>

            <div style={infoBoxStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                <span style={{ color: '#94A3B8' }}>HH Embedded Wallet</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: '#E2E8F0', fontSize: 13, fontFamily: 'Inter, sans-serif' }}>
                  {embeddedAddress}
                </span>
                <button onClick={handleCopy} style={iconBtn}>
                  {copied
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  }
                </button>
              </div>
            </div>

            {/* Separator */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '24px 0' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
              <div style={{ margin: '0 16px', color: '#64748B', fontSize: 12, fontWeight: 700 }}>OR</div>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
            </div>

            <p style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
              Deposit from your External Wallet
            </p>

            {!externalWallet ? (
              <div style={{ textAlign: 'center', padding: '16px 0', background: 'rgba(255,255,255,0.02)', borderRadius: 12, border: '1px dashed rgba(255,255,255,0.1)' }}>
                <p style={{ color: '#94A3B8', fontSize: 14, marginBottom: 16 }}>
                  You need to connect an external wallet to use this feature.
                </p>
                <button onClick={onRequireWallet} style={{...primaryBtn, width: 'auto', padding: '10px 20px', fontSize: 14}}>Connect Wallet</button>
              </div>
            ) : (
              <>
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowTokenSelect(!showTokenSelect); }}
                    style={{
                      ...chainSelectStyle, width: '100%', cursor: 'pointer', justifyContent: 'space-between'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <img src={token.logo} alt={token.symbol} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                      <span style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 600 }}>{token.symbol}</span>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                  </button>
                  
                  {showTokenSelect && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8,
                      background: '#1A1D2E', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 12, overflow: 'hidden', zIndex: 100,
                      boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                    }}>
                      {Object.values(TOKENS).map(t => (
                        <button
                          key={t.symbol}
                          onClick={(e) => { e.stopPropagation(); setToken(t); setShowTokenSelect(false); }}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '12px 16px', background: 'transparent', border: 'none',
                            borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <img src={t.logo} alt={t.symbol} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                            <span style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 600 }}>{t.symbol}</span>
                          </div>
                          <span style={{ color: '#94A3B8', fontSize: 13 }}>{extBalances[t.symbol] || '0'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="0.00"
                    type="number"
                    style={{ ...inputStyle, paddingRight: 60 }}
                  />
                  <button 
                    onClick={handleMax}
                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(59,130,246,0.15)', color: '#3B82F6', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >
                    Max
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  {['25%', '50%', '100%'].map(p => (
                    <button key={p} onClick={() => handlePercent(parseInt(p))} style={percentBtn}>{p}</button>
                  ))}
                </div>

                {error && <div style={{ color: '#EF4444', fontSize: 13, marginTop: 12 }}>{error}</div>}

                <button
                  onClick={handleDeposit}
                  disabled={!isValidAmount || isSending}
                  style={{ ...primaryBtn, marginTop: 20, opacity: (!isValidAmount || isSending) ? 0.5 : 1 }}
                >
                  {isSending ? 'Depositing…' : 'Deposit'}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────
// Sub-component: Send Modal
// ─────────────────────────────────────────
function SendModal({ wallet, balances, onClose }) {
  const [token, setToken] = useState(TOKENS.ETH)
  const [amount, setAmount] = useState('')
  const [recipient, setRecipient] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [txHash, setTxHash] = useState(null)
  const [error, setError] = useState(null)
  const [showTokenSelect, setShowTokenSelect] = useState(false)

  const isValidRecipient = isAddress(recipient)
  const numAmt = parseFloat(amount)
  const isValidAmount = amount && !isNaN(numAmt) && numAmt > 0

  const handleMax = () => {
    let balStr = balances[token.symbol] || '0'
    let balNum = parseFloat(balStr)
    if (balNum <= 0) return setAmount('0')
    if (token.symbol === 'ETH') {
      const safeBal = Math.max(0, balNum - 0.0001)
      setAmount(safeBal.toFixed(6).replace(/\.?0+$/, ''))
    } else {
      setAmount(balStr)
    }
  }

  const handlePercent = (pct) => {
    if (pct === 100) return handleMax()
    let balStr = balances[token.symbol] || '0'
    let balNum = parseFloat(balStr)
    if (balNum <= 0) return setAmount('0')
    let target = balNum * (pct / 100)
    setAmount(target.toFixed(6).replace(/\.?0+$/, ''))
  }

  const handleSend = async () => {
    if (!isValidRecipient || !isValidAmount || !wallet) return
    setIsSending(true)
    setError(null)
    try {
      const provider = await wallet.getEthereumProvider()
      let tx;
      
      if (token.symbol === 'ETH') {
        tx = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: wallet.address,
            to: recipient,
            value: '0x' + parseEther(amount).toString(16),
          }]
        })
      } else {
        const data = encodeFunctionData({
          abi: [
            {
              "constant": false,
              "inputs": [
                { "name": "dst", "type": "address" },
                { "name": "wad", "type": "uint256" }
              ],
              "name": "transfer",
              "outputs": [{ "name": "", "type": "bool" }],
              "payable": false,
              "stateMutability": "nonpayable",
              "type": "function"
            }
          ],
          functionName: 'transfer',
          args: [recipient, parseUnits(amount, token.decimals)]
        })
        
        tx = await provider.request({
          method: 'eth_sendTransaction',
          params: [{
            from: wallet.address,
            to: token.address,
            data: data
          }]
        })
      }
      setTxHash(tx)
    } catch (err) {
      setError(err?.message || 'Transaction failed')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalBoxStyle} onClick={e => { e.stopPropagation(); setShowTokenSelect(false); }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 700, margin: 0 }}>Send</h2>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>

        {txHash ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
            <div style={{ color: '#22C55E', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Transaction Sent!</div>
            <div style={{ color: '#94A3B8', fontSize: 13, fontFamily: 'monospace', wordBreak: 'break-all' }}>{txHash}</div>
            <button onClick={onClose} style={{ ...primaryBtn, marginTop: 20 }}>Close</button>
          </div>
        ) : (
          <>
            <label style={labelStyle}>Token</label>
            <div style={{ position: 'relative' }}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowTokenSelect(!showTokenSelect); }}
                style={{
                  ...chainSelectStyle, width: '100%', cursor: 'pointer', justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <img src={token.logo} alt={token.symbol} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                  <span style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 600 }}>{token.symbol}</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
              </button>
              
              {showTokenSelect && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 8,
                  background: '#1A1D2E', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12, overflow: 'hidden', zIndex: 100,
                  boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
                }}>
                  {Object.values(TOKENS).map(t => (
                    <button
                      key={t.symbol}
                      onClick={(e) => { e.stopPropagation(); setToken(t); setShowTokenSelect(false); }}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px', background: 'transparent', border: 'none',
                        borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img src={t.logo} alt={t.symbol} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                        <span style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 600 }}>{t.symbol}</span>
                      </div>
                      <span style={{ color: '#94A3B8', fontSize: 13 }}>{balances[t.symbol] || '0'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label style={{ ...labelStyle, marginTop: 16 }}>Amount</label>
            <div style={{ position: 'relative' }}>
              <input
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                type="number"
                style={{ ...inputStyle, paddingRight: 60 }}
              />
              <button 
                onClick={handleMax}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'rgba(59,130,246,0.15)', color: '#3B82F6', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
              >
                Max
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {['25%', '50%', '100%'].map(p => (
                <button key={p} onClick={() => handlePercent(parseInt(p))} style={percentBtn}>{p}</button>
              ))}
            </div>

            <label style={{ ...labelStyle, marginTop: 16 }}>Recipient</label>
            <input
              value={recipient}
              onChange={e => setRecipient(e.target.value)}
              placeholder="Address or ENS"
              style={{ ...inputStyle, borderColor: recipient && !isValidRecipient ? '#EF4444' : 'rgba(255,255,255,0.1)' }}
            />
            {recipient && !isValidRecipient && (
              <div style={{ color: '#EF4444', fontSize: 12, marginTop: 4 }}>Invalid address</div>
            )}

            {error && <div style={{ color: '#EF4444', fontSize: 13, marginTop: 12 }}>{error}</div>}

            <button
              onClick={handleSend}
              disabled={!isValidRecipient || !isValidAmount || isSending}
              style={{ ...primaryBtn, marginTop: 20, opacity: (!isValidRecipient || !isValidAmount || isSending) ? 0.5 : 1 }}
            >
              {isSending ? 'Sending…' : 'Send'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function SwapModal({ onClose, wallet }) {
  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={{ ...modalBoxStyle, background: '#111318', padding: 0, maxHeight: 'calc(100dvh - 40px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)', boxSizing: 'border-box', position: 'sticky', top: 0, background: '#111318', zIndex: 10 }}>
          <h3 style={{ margin: 0, fontSize: 18, color: '#FFFFFF', fontWeight: 600 }}>Swap</h3>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <div style={{ padding: '24px 20px', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <CustomSwapWidget width={400} wallet={wallet} />
        </div>
      </div>
    </div>
  )
}


// ─────────────────────────────────────────
// Main WalletSection component
// ─────────────────────────────────────────
export function WalletSection({ onRequireWallet, setTab }) {
  const { wallets } = useWallets()
  const { user: privyUser } = usePrivy()
  const { createWallet } = useCreateWallet()

  const [activeWalletType, setActiveWalletType] = useState('embedded') // 'embedded' | 'external'
  const [modal, setModal] = useState(null) // null | 'deposit' | 'send'
  const [addrCopied, setAddrCopied] = useState(false)
  const [isCreatingWallet, setIsCreatingWallet] = useState(false)
  const [showCreateBtn, setShowCreateBtn] = useState(false)

  // Separate wallets
  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy')

  // External wallet: must be linked to the CURRENT Privy user (cross-reference linkedAccounts)
  // This prevents showing wallets from other sessions / browser extensions
  const linkedExternalAddresses = new Set(
    (privyUser?.linkedAccounts || [])
      .filter(a => a.type === 'wallet' && a.walletClientType !== 'privy' && a.connectorType !== 'embedded')
      .map(a => a.address?.toLowerCase())
  )
  const externalWallet = wallets.find(w =>
    w.walletClientType !== 'privy' &&
    linkedExternalAddresses.has(w.address?.toLowerCase())
  )

  // If no embedded wallet after 4 sec, show "Create Wallet" button
  useEffect(() => {
    if (embeddedWallet) { setShowCreateBtn(false); return }
    const t = setTimeout(() => setShowCreateBtn(true), 4000)
    return () => clearTimeout(t)
  }, [embeddedWallet])

  const handleCreateWallet = async () => {
    setIsCreatingWallet(true)
    try { await createWallet() } catch (e) { console.error('createWallet:', e) }
    finally { setIsCreatingWallet(false) }
  }

  const activeWallet = activeWalletType === 'embedded' ? embeddedWallet : externalWallet
  const activeAddress = activeWallet?.address

  // ETH Balance
  const { data: ethBalance } = useBalance({
    address: activeAddress,
    chainId: 8453,
    query: { enabled: !!activeAddress, refetchInterval: 15000 }
  })

  // ERC20 Balances
  const erc20Abi = [
    {
      "constant": true,
      "inputs": [{ "name": "_owner", "type": "address" }],
      "name": "balanceOf",
      "outputs": [{ "name": "balance", "type": "uint256" }],
      "type": "function"
    }
  ]

  const { data: erc20Balances } = useReadContracts({
    contracts: [
      { address: '0x4200000000000000000000000000000000000006', abi: erc20Abi, functionName: 'balanceOf', args: [activeAddress], chainId: 8453 }, // WETH
      { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', abi: erc20Abi, functionName: 'balanceOf', args: [activeAddress], chainId: 8453 }, // USDC
      { address: '0x8235EdF32a1e10Bd1867ad622915AB613664cbA3', abi: erc20Abi, functionName: 'balanceOf', args: [activeAddress], chainId: 8453 }  // HH
    ],
    query: { enabled: !!activeAddress, refetchInterval: 15000 }
  })

  const [localBalances, setLocalBalances] = useState({ ETH: '0.0000', WETH: '0.00', USDC: '0.00', HH: '0.00' })
  const [prices, setPrices] = useState({ ETH: 0, WETH: 0, USDC: 1, HH: 0 })

  useEffect(() => {
    Promise.all([
      fetch('https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006').then(r => r.json()),
      fetch('https://api.dexscreener.com/latest/dex/tokens/0x8235EdF32a1e10Bd1867ad622915AB613664cbA3').then(r => r.json())
    ]).then(([wethData, hhData]) => {
         let p = { ETH: 0, WETH: 0, USDC: 1, HH: 0 };
         
         if (wethData.pairs && wethData.pairs.length > 0) {
            p.WETH = parseFloat(wethData.pairs[0].priceUsd) || 0;
            p.ETH = parseFloat(wethData.pairs[0].priceUsd) || 0;
         }
         
         if (hhData.pairs && hhData.pairs.length > 0) {
            // Find the pair where HH is the baseToken
            const hhPair = hhData.pairs.find(pair => pair.baseToken.address.toLowerCase() === '0x8235EdF32a1e10Bd1867ad622915AB613664cbA3'.toLowerCase());
            if (hhPair) {
                p.HH = parseFloat(hhPair.priceUsd) || 0;
            } else {
                p.HH = parseFloat(hhData.pairs[0].priceUsd) || 0;
            }
         }
         
         setPrices(p);
      }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!activeAddress) {
      setLocalBalances({ ETH: '0.0000', WETH: '0.00', USDC: '0.00', HH: '0.00' });
      return;
    }
    setLocalBalances(prev => {
      const newBals = { ...prev };
      if (ethBalance?.formatted !== undefined) {
        newBals.ETH = parseFloat(ethBalance.formatted).toFixed(4);
      }
      if (erc20Balances) {
        if (erc20Balances[0]?.result !== undefined) newBals.WETH = formatBalance(erc20Balances[0].result.toString(), 18);
        if (erc20Balances[1]?.result !== undefined) newBals.USDC = formatBalance(erc20Balances[1].result.toString(), 6);
        if (erc20Balances[2]?.result !== undefined) newBals.HH = formatBalance(erc20Balances[2].result.toString(), 18);
      }
      return newBals;
    });
  }, [ethBalance, erc20Balances, activeAddress]);

  const ethAmt = localBalances.ETH;
  const wethAmt = localBalances.WETH;
  const usdcAmt = localBalances.USDC;
  const hhAmt = localBalances.HH;

  const handleToggleWallet = () => {
    if (activeWalletType === 'embedded') {
      if (externalWallet) {
        setActiveWalletType('external')
      } else {
        // No external wallet — trigger connect
        onRequireWallet()
      }
    } else {
      setActiveWalletType('embedded')
    }
  }

  const handleCopyAddr = async () => {
    if (!activeAddress) return
    try {
      await navigator.clipboard.writeText(activeAddress)
      setAddrCopied(true)
      setTimeout(() => setAddrCopied(false), 2000)
    } catch {}
  }

  if (!embeddedWallet) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center' }}>
        {!showCreateBtn ? (
          <>
            <div style={{ width: 44, height: 44, border: '3px solid rgba(59,130,246,0.3)', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 20px' }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            <h2 style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Setting up wallet…</h2>
            <p style={{ color: '#94A3B8', fontSize: 15 }}>Your embedded wallet is being created.</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔐</div>
            <h2 style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Wallet not found</h2>
            <p style={{ color: '#94A3B8', fontSize: 15, marginBottom: 24 }}>
              Click below to create your embedded wallet.
            </p>
            <button
              onClick={handleCreateWallet}
              disabled={isCreatingWallet}
              style={{
                background: '#3B82F6', color: '#FFFFFF', border: 'none',
                borderRadius: 12, padding: '14px 32px', fontSize: 15,
                fontWeight: 700, cursor: isCreatingWallet ? 'wait' : 'opacity: 1',
                opacity: isCreatingWallet ? 0.7 : 1
              }}
            >
              {isCreatingWallet ? 'Creating…' : 'Create Wallet'}
            </button>
          </>
        )}
      </div>
    )
  }

  const parseVal = (str) => {
    if (!str) return 0;
    let n = parseFloat(str.replace(/K|M|B/g, ''));
    if (str.includes('K')) n *= 1e3;
    if (str.includes('M')) n *= 1e6;
    if (str.includes('B')) n *= 1e9;
    return n || 0;
  };

  const totalUsd = (
    parseVal(ethAmt) * prices.ETH +
    parseVal(wethAmt) * prices.WETH +
    parseVal(usdcAmt) * prices.USDC +
    parseVal(hhAmt) * prices.HH
  );

  return (
    <div style={{ width: '100%', maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20, fontFamily: 'Inter, sans-serif' }}>

      {/* Header card */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24 }}>

        {/* Balance */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 4 }}>Your balance</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#FFFFFF' }}>
            ${totalUsd > 0 ? totalUsd.toFixed(2) : '0.00'}
          </div>
        </div>

        {/* Wallet mode toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontSize: 14, color: '#94A3B8', fontWeight: 600 }}>Wallet mode</span>
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

        {/* Wallet rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Embedded row */}
          <button
            onClick={() => setActiveWalletType('embedded')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 0, border: 'none', cursor: 'pointer',
              background: 'transparent',
              transition: 'opacity 0.15s',
              opacity: activeWalletType === 'embedded' ? 1 : 0.6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', background: activeWalletType === 'embedded' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: activeWalletType === 'embedded' ? '#3B82F6' : '#94A3B8', flexShrink: 0 }}>
                <img src="/logo.jfif" alt="HH" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14, color: activeWalletType === 'embedded' ? '#FFFFFF' : '#94A3B8', fontWeight: 600 }}>HH Embedded Wallet</div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{short(embeddedWallet?.address)}</div>
              </div>
            </div>
            <span style={{ fontSize: 13, color: activeWalletType === 'embedded' ? '#FFFFFF' : '#94A3B8', fontWeight: 600 }}>
              {activeWalletType === 'embedded' ? `${ethAmt} ETH` : '—'}
            </span>
          </button>

          {/* External row */}
          <button
            onClick={externalWallet ? () => setActiveWalletType('external') : onRequireWallet}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: 0, border: 'none', cursor: 'pointer',
              background: 'transparent',
              transition: 'opacity 0.15s',
              opacity: activeWalletType === 'external' ? 1 : 0.6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, overflow: 'hidden', background: activeWalletType === 'external' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: activeWalletType === 'external' ? '#3B82F6' : '#94A3B8', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/></svg>
              </div>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 14, color: activeWalletType === 'external' ? '#FFFFFF' : '#94A3B8', fontWeight: 600 }}>
                  {externalWallet ? 'External Wallet' : 'Connect Wallet'}
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                  {externalWallet ? short(externalWallet.address) : 'Not connected'}
                </div>
              </div>
            </div>
            <span style={{ fontSize: 13, color: '#94A3B8', fontWeight: 600 }}>
              {externalWallet && activeWalletType === 'external' ? `${ethAmt} ETH` : '—'}
            </span>
          </button>
        </div>
      </div>

      {/* Token balances card */}
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: 24 }}>
        {/* Wallet address header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#F8FAFC' }}>
              {activeWalletType === 'embedded' ? 'HH Embedded Wallet' : 'External Wallet'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 13, color: '#94A3B8' }}>{short(activeAddress)}</span>
              <button onClick={handleCopyAddr} style={iconBtn}>
                {addrCopied
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                }
              </button>
            </div>
          </div>
        </div>

        {/* Token list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={tokenRowStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={TOKENS.HH.logo} alt="HH" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
              <div>
                <div style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 600 }}>Happy Hour</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>$HH</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 600 }}>{hhAmt}</div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>{prices.HH > 0 ? `≈ $${(parseVal(hhAmt) * prices.HH).toFixed(2)}` : '—'}</div>
            </div>
          </div>

          <div style={tokenRowStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={TOKENS.ETH.logo} alt="ETH" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
              <div>
                <div style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 600 }}>Ethereum</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>ETH</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 600 }}>{ethAmt}</div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>{prices.ETH > 0 ? `≈ $${(parseVal(ethAmt) * prices.ETH).toFixed(2)}` : '—'}</div>
            </div>
          </div>

          <div style={tokenRowStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={TOKENS.WETH.logo} alt="WETH" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
              <div>
                <div style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 600 }}>Wrapped Ether</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>WETH</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 600 }}>{wethAmt}</div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>{prices.WETH > 0 ? `≈ $${(parseVal(wethAmt) * prices.WETH).toFixed(2)}` : '—'}</div>
            </div>
          </div>

          <div style={tokenRowStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={TOKENS.USDC.logo} alt="USDC" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
              <div>
                <div style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 600 }}>USD Coin</div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>USDC</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, color: '#FFFFFF', fontWeight: 600 }}>{usdcAmt}</div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>{prices.USDC > 0 ? `≈ $${(parseVal(usdcAmt) * prices.USDC).toFixed(2)}` : '—'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={() => setModal('deposit')}
          style={{ flex: 1, background: '#3B82F6', color: '#FFFFFF', border: 'none', borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
        >
          Deposit
        </button>
        <button
          onClick={() => setModal('send')}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          Send
        </button>
        <button
          onClick={() => setModal('swap')}
          style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: 'rgba(255,255,255,0.06)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M7 16V4m0 0L3 8m4-4 4 4"/><path d="M17 8v12m0 0 4-4m-4 4-4-4"/></svg>
          Swap
        </button>
      </div>

      {/* Modals */}
      {modal === 'deposit' && (
        <DepositModal embeddedWallet={embeddedWallet} externalWallet={externalWallet} onRequireWallet={onRequireWallet} onClose={() => setModal(null)} />
      )}
      {modal === 'send' && (
        <SendModal wallet={activeWallet} balances={localBalances} onClose={() => setModal(null)} />
      )}
      {modal === 'swap' && (
        <SwapModal onClose={() => setModal(null)} wallet={activeWallet} />
      )}
    </div>
  )
}

// ── Shared styles ──
const modalOverlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16,
}
const modalBoxStyle = {
  background: '#1A1D2E', borderRadius: 20, padding: 28, width: '100%', maxWidth: 460,
  border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
  fontFamily: 'Inter, sans-serif'
}
const closeBtn = {
  background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 18, lineHeight: 1,
}
const chainSelectStyle = {
  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
  background: 'rgba(255,255,255,0.05)', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)',
}
const infoBoxStyle = {
  background: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 16,
  border: '1px solid rgba(255,255,255,0.08)',
}
const primaryBtn = {
  width: '100%', background: '#3B82F6', color: '#FFFFFF', border: 'none',
  borderRadius: 12, padding: '14px 0', fontSize: 15, fontWeight: 700, cursor: 'pointer',
}
const labelStyle = { display: 'block', fontSize: 14, color: '#94A3B8', marginBottom: 8 }
const inputStyle = {
  width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 10, padding: '12px 14px', color: '#FFFFFF', fontSize: 15, boxSizing: 'border-box',
  outline: 'none', fontFamily: 'inherit',
}
const percentBtn = {
  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 6, padding: '4px 10px', fontSize: 12, color: '#94A3B8', cursor: 'pointer',
}
const iconBtn = {
  background: 'transparent', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center',
}
const tokenRowStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '10px 8px', borderRadius: 10,
}
