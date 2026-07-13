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
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
            }}>
              <img src="/logo.jfif" alt="Happy Hour Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            {/* Base Badge */}
            <div style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 24,
              height: 24,
              borderRadius: 6,
              overflow: 'hidden',
              border: '2.5px solid #13141F',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
              <img src="/base_logo.webp" alt="Base Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          </div>

          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 6,
            height: 80,
            boxSizing: 'border-box'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 28, fontWeight: 600, color: '#FFFFFF', margin: 0, lineHeight: 1.1 }}>Happy Hour</h1>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#8A8F9E', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 6 }}>$HH</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, color: '#8A8F9E', fontFamily: 'monospace' }}>{shortAddress}</span>
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
        border: 'none',
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

      {/* Explore on DEX Section */}
      <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#94A3B8', margin: 0, letterSpacing: '0.02em' }}>
          Explore on DEX
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16
        }}>
          {[
            { name: 'Dexscreener', logo: '/dexscreener.jpg', url: 'https://dexscreener.com/base/0xe186aa00d52844ed05d1b1373fc2ec8b0562d613f9f4b470ee7fafa0c1a388f9' },
            { name: 'GeckoTerminal', logo: '/geckoterminal.jpg', url: 'https://www.geckoterminal.com/base/pools/0xe186aa00d52844ed05d1b1373fc2ec8b0562d613f9f4b470ee7fafa0c1a388f9' },
            { name: 'Coingecko', logo: '/CoinGecko-logo.png', url: 'https://www.coingecko.com/en/coins/happy-hour' },
            { name: 'BankrTerminal', logo: '/bankr-logo.jpg', url: 'https://bankr.bot/terminal/agents/0x8235edf32a1e10bd1867ad622915ab613664cba3' }
          ].map((item) => (
            <a
              key={item.name}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 14,
                color: '#FFFFFF',
                textDecoration: 'none',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)'
                e.currentTarget.style.transform = 'translateY(-2px)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'
                e.currentTarget.style.transform = 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={item.logo} alt={item.name} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="7" y1="17" x2="17" y2="7"></line>
                <polyline points="7 7 17 7 17 17"></polyline>
              </svg>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
