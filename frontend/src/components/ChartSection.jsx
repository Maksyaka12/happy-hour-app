import { useState, useEffect } from 'react'

const HH_TOKEN_ADDRESS = '0x8235EdF32a1e10Bd1867ad622915AB613664cbA3'
// Default WETH/HH pool address on Base just in case API fails
const DEFAULT_POOL_ADDRESS = '0x3235edf32a1e10bd1867ad527915ab613664cba3' 

export function ChartSection() {
  const [tokenData, setTokenData] = useState({
    priceUsd: '0.000003264',
    mcap: '$32.78K',
    priceChange24h: -0.23,
    volume24h: '74.66',
    poolAddress: DEFAULT_POOL_ADDRESS,
    loading: true
  })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function fetchMarketData() {
      try {
        // Fetch pools to get the main pool address
        const poolRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/base/tokens/${HH_TOKEN_ADDRESS}/pools`)
        const poolJson = await poolRes.json()
        let resolvedPoolAddress = DEFAULT_POOL_ADDRESS
        
        if (poolJson.data && poolJson.data.length > 0) {
          resolvedPoolAddress = poolJson.data[0].attributes.address
        }

        // Fetch token details for price & volume
        const tokenRes = await fetch(`https://api.geckoterminal.com/api/v2/networks/base/tokens/${HH_TOKEN_ADDRESS}`)
        const tokenJson = await tokenRes.json()
        
        if (tokenJson.data) {
          const attr = tokenJson.data.attributes
          const mcapVal = attr.fdv_usd ? `$${(parseFloat(attr.fdv_usd) / 1000).toFixed(2)}K` : '$32.78K'
          const volVal = attr.volume_usd?.h24 ? parseFloat(attr.volume_usd.h24).toFixed(2) : '74.66'
          const changeVal = attr.price_change_percentage?.h24 ? parseFloat(attr.price_change_percentage.h24) : -0.23

          setTokenData({
            priceUsd: attr.price_usd || '0.000003264',
            mcap: mcapVal,
            priceChange24h: changeVal,
            volume24h: volVal,
            poolAddress: resolvedPoolAddress,
            loading: false
          })
        } else {
          setTokenData(prev => ({ ...prev, poolAddress: resolvedPoolAddress, loading: false }))
        }
      } catch (err) {
        console.error('Error fetching market data from GeckoTerminal:', err)
        setTokenData(prev => ({ ...prev, loading: false }))
      }
    }

    fetchMarketData()
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(HH_TOKEN_ADDRESS)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shortAddress = `${HH_TOKEN_ADDRESS.slice(0, 6)}...${HH_TOKEN_ADDRESS.slice(-4)}`
  const isPositive = tokenData.priceChange24h >= 0

  return (
    <div style={{
      width: '100%',
      maxWidth: 1200,
      margin: '0 auto',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Header Info */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16
      }}>
        {/* Token Branding */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
            }}>
              <img src="/logo.jfif" alt="Happy Hour Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            {/* Base Badge */}
            <div style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: '#0052FF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid #13141F',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              <span style={{ fontSize: 9, fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.5px' }}>B</span>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Happy Hour</h1>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#8A8F9E', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 6 }}>$HH</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 12, color: '#8A8F9E', fontFamily: 'monospace' }}>{shortAddress}</span>
              <button 
                onClick={handleCopy}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: copied ? '#10B981' : '#8A8F9E',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                {copied ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#FFFFFF', fontFamily: "'Outfit', 'Inter', sans-serif" }}>
            {tokenData.mcap}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginTop: 2 }}>
            <span style={{
              fontSize: 14,
              fontWeight: 700,
              color: isPositive ? '#10B981' : '#EF4444'
            }}>
              {isPositive ? '+' : ''}{tokenData.priceChange24h.toFixed(2)}%
            </span>
            <span style={{ fontSize: 13, color: '#64748B' }}>
              Vol ${tokenData.volume24h}
            </span>
          </div>
        </div>
      </div>

      {/* Chart Iframe container */}
      <div style={{
        width: '100%',
        height: 600,
        background: '#13141F',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
      }}>
        <iframe
          src={`https://www.geckoterminal.com/base/pools/${tokenData.poolAddress}?embed=1&info=0&swaps=0&dark_mode=true`}
          title="Happy Hour $HH Chart"
          style={{
            width: '100%',
            height: '100%',
            border: 'none'
          }}
        />
      </div>
    </div>
  )
}
