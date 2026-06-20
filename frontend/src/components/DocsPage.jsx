import { useEffect, useRef, useState } from 'react'

// ─── Contract addresses ───────────────────────────────────────────────────────
const CONTRACTS = {
  HH_TOKEN:     '0x8235EdF32a1e10Bd1867ad622915AB613664cbA3',
  PAYMENTS:     '0x7E861466bC2845C9f57051fb9652bC4a56d95542',
  STAKING:      '0xFd23526111280b78FF4e7F38B1fAF5818B9c5214',
  RAFFLE_VAULT: '0x3bdF461984142C473F2185B4F0F64a918B8ce49b',
  HH_MANAGER:   '0x13802fDe66BCf54BcebE2242aF0836A5Dfb45Fc8',
  FOUNDATION:   '0xdE76F43E17B1173947f63b72C85a2f0d9a97702F',
}

// ─── Nav sections ─────────────────────────────────────────────────────────────
const NAV = [
  {
    group: 'Getting Started',
    items: [
      { id: 'introduction', label: 'Introduction' },
      { id: 'official-links', label: 'Official Links' },
    ]
  },
  {
    group: '$HH Coin',
    items: [
      { id: 'utility-economy', label: '$HH Utility & Economy' },
    ]
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const short = (addr) => `${addr.slice(0, 6)}…${addr.slice(-4)}`

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button onClick={copy} style={{
      background: copied ? '#e8f5e9' : '#f1f5f9',
      border: `1px solid ${copied ? '#a5d6a7' : '#e2e8f0'}`,
      borderRadius: 6, padding: '3px 9px', fontSize: 11.5, fontWeight: 600,
      cursor: 'pointer', color: copied ? '#2e7d32' : '#64748b',
      display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 0.2s',
      fontFamily: 'inherit',
    }}>
      {copied ? (
        <><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#2e7d32" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>Copied</>
      ) : (
        <><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="1" y="3" width="7" height="8" rx="1.5" stroke="#64748b" strokeWidth="1.3"/><path d="M4 3V2.5A1.5 1.5 0 015.5 1h3A1.5 1.5 0 0110 2.5v6A1.5 1.5 0 018.5 10H8" stroke="#64748b" strokeWidth="1.3"/></svg>Copy</>
      )}
    </button>
  )
}

function AddressRow({ label, addr, desc }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
      padding: '12px 0', borderBottom: '1px solid #f1f5f9', gap: 12,
      flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a', marginBottom: 3 }}>{label}</div>
        {desc && <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.5 }}>{desc}</div>}
        <div style={{
          fontFamily: "'DM Mono', 'Fira Mono', monospace", fontSize: 12, color: '#475569',
          marginTop: 5, wordBreak: 'break-all', background: '#f8fafc',
          border: '1px solid #e2e8f0', borderRadius: 6, padding: '4px 8px',
          display: 'inline-block',
        }}>
          {addr}
        </div>
      </div>
      <div style={{ flexShrink: 0, paddingTop: 2 }}>
        <CopyBtn text={addr} />
      </div>
    </div>
  )
}

function SectionCallout({ type = 'note', children }) {
  const styles = {
    note:      { bg: '#eff6ff', border: '#bfdbfe', icon: 'ℹ️', label: 'Note',      labelColor: '#1d4ed8' },
    tip:       { bg: '#f0fdf4', border: '#bbf7d0', icon: '💡', label: 'Tip',       labelColor: '#15803d' },
    important: { bg: '#fffbeb', border: '#fde68a', icon: '⭐', label: 'Important', labelColor: '#b45309' },
  }
  const s = styles[type]
  return (
    <div style={{
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 10, padding: '14px 18px', margin: '18px 0',
    }}>
      <div style={{ fontWeight: 700, fontSize: 12.5, color: s.labelColor, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>{s.icon}</span>{s.label}
      </div>
      <div style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.7 }}>{children}</div>
    </div>
  )
}

function QuickCard({ icon, title, desc, href, sectionId, onNav }) {
  const handleClick = (e) => {
    if (sectionId) { e.preventDefault(); onNav(sectionId) }
  }
  return (
    <a
      href={href || '#'}
      onClick={handleClick}
      target={href && !sectionId ? '_blank' : undefined}
      rel="noopener noreferrer"
      style={{
        display: 'block', padding: '18px 20px',
        border: '1.5px solid #e2e8f0', borderRadius: 12,
        textDecoration: 'none', background: '#fff',
        transition: 'all 0.18s', cursor: 'pointer',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = '#0052ff'
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,82,255,0.1)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#e2e8f0'
        e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'
        e.currentTarget.style.transform = 'none'
      }}
    >
      <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 5 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.55 }}>{desc}</div>
    </a>
  )
}

// ─── Section: INTRODUCTION ────────────────────────────────────────────────────
function IntroSection({ onNav }) {
  return (
    <section id="introduction">
      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0052ff', marginBottom: 10, letterSpacing: 0.2 }}>
        Introduction
      </div>
      <h1 style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', margin: '0 0 10px', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
        Happy Hour
      </h1>
      <p style={{ fontSize: 15.5, color: '#475569', margin: '0 0 28px', lineHeight: 1.65 }}>
        A consumer app built on Base — where the community earns real USDC rewards through engagement, powered by a native coin with genuine utility.
      </p>

      <SectionCallout type="tip">
        Happy Hour is live on Base mainnet. No wallet connection is required to read these docs.
      </SectionCallout>

      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '32px 0 12px', letterSpacing: '-0.3px' }}>
        What is Happy Hour?
      </h2>
      <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.75, margin: '0 0 16px' }}>
        Happy Hour is a fully onchain consumer application on Base that rewards active participants with USDC and $HH. The platform was created by and for the Bankr community — transforming a grassroots memecoin into a native utility coin with a robust in-app economy.
      </p>
      <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.75, margin: '0 0 16px' }}>
        Users connect their Base wallet, complete daily activities, participate in raffles, stake $HH, and climb the leaderboard to earn seasonal USDC rewards — all onchain, all transparent.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '32px 0 12px', letterSpacing: '-0.3px' }}>
        Why $HH?
      </h2>
      <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.75, margin: '0 0 16px' }}>
        $HH started as a community coin within the Bankr ecosystem. Happy Hour gave it something most coins never achieve — real, sustainable utility embedded directly into an active application. Rather than speculative trading, $HH is now the engine of the entire economy: it's burned, staked, earned, and used as the primary interaction medium within the app.
      </p>
      <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.75, margin: '0 0 28px' }}>
        This transforms $HH from a short-term memecoin into a long-term ecosystem coin — accepted, powered by, and continuously strengthened by its community.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '32px 0 16px', letterSpacing: '-0.3px' }}>
        Explore the App
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 32 }}>
        <QuickCard
          icon="🎰"
          title="HH Raffle"
          desc="Buy tickets with USDC. 85% of the pool goes to the winner every round."
          sectionId="utility-economy"
          onNav={onNav}
        />
        <QuickCard
          icon="✅"
          title="Daily Check-in & Boost"
          desc="Earn HP points daily. Pay small USDC fees to boost your streak multiplier."
          sectionId="utility-economy"
          onNav={onNav}
        />
        <QuickCard
          icon="🔒"
          title="$HH Staking"
          desc="Lock $HH for 7 or 10 days. Earn HP points + APR rewards paid in $HH."
          sectionId="utility-economy"
          onNav={onNav}
        />
        <QuickCard
          icon="🏆"
          title="Points & Leaderboard"
          desc="Accumulate HP all season. Top holders earn seasonal USDC reward distributions."
          sectionId="utility-economy"
          onNav={onNav}
        />
        <QuickCard
          icon="⚔️"
          title="Happy Raids"
          desc="PvP on-chain raid battles. Use USDC or $HH to raid other players."
          sectionId="utility-economy"
          onNav={onNav}
        />
        <QuickCard
          icon="📦"
          title="Happy Boxes"
          desc="Open mystery boxes containing HP rewards. Extra attempts purchasable with $HH."
          sectionId="utility-economy"
          onNav={onNav}
        />
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '32px 0 12px', letterSpacing: '-0.3px' }}>
        Built on Base
      </h2>
      <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.75, margin: '0 0 16px' }}>
        All transactions, staking, and contract interactions happen on Base — Ethereum's fastest-growing L2, incubated by Coinbase. Base provides low fees, high throughput, and access to the broader Ethereum ecosystem, making it the ideal home for a consumer app like Happy Hour.
      </p>

      <SectionCallout type="note">
        Happy Hour is a non-custodial app. Your assets remain in your wallet at all times. The app never holds your funds.
      </SectionCallout>
    </section>
  )
}

// ─── Section: OFFICIAL LINKS ─────────────────────────────────────────────────
function LinksSection() {
  const links = [
    {
      category: 'Application',
      items: [
        { label: 'Happy Hour Web App', href: 'https://happy-hour-based.app', desc: 'Main application — connect your Base wallet and start earning.' },
        { label: 'Happy Hour on Base App Store', href: 'https://www.base.org/apps', desc: 'Discover Happy Hour in the official Base ecosystem app directory.' },
      ]
    },
    {
      category: 'Community & Social',
      items: [
        { label: 'Twitter / X — @HappyHourBased', href: 'https://x.com/HappyHourBased', desc: 'Official project Twitter for announcements, season updates, and community.' },
        { label: 'Twitter / X — Creator', href: 'https://x.com/maksyaka12', desc: 'Founder account for development updates and direct community interaction.' },
      ]
    },
    {
      category: 'On-Chain & Market Data',
      items: [
        { label: 'DexScreener — $HH/USDC', href: 'https://dexscreener.com/base/0xe186aa00d52844ed05d1b1373fc2ec8b0562d613f9f4b470ee7fafa0c1a388f9', desc: 'Real-time price chart, liquidity, and trading volume on Base.' },
        { label: 'GeckoTerminal — $HH Pool', href: 'https://www.geckoterminal.com/uk/base/pools/0xe186aa00d52844ed05d1b1373fc2ec8b0562d613f9f4b470ee7fafa0c1a388f9', desc: 'Pool analytics, holder data, and market metrics.' },
        { label: 'Basescan — $HH Contract', href: `https://basescan.org/token/${CONTRACTS.HH_TOKEN}`, desc: 'Verify the $HH coin smart contract on Basescan.' },
      ]
    },
  ]

  return (
    <section id="official-links" style={{ marginTop: 60, paddingTop: 40, borderTop: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0052ff', marginBottom: 10, letterSpacing: 0.2 }}>
        Official Links
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: '0 0 10px', letterSpacing: '-0.5px' }}>
        Official Links
      </h1>
      <p style={{ fontSize: 14.5, color: '#64748b', margin: '0 0 28px', lineHeight: 1.65 }}>
        All official Happy Hour resources. Only use links from this page — always verify URLs before connecting your wallet.
      </p>

      <SectionCallout type="important">
        Always verify you are on <strong>happy-hour-based.app</strong> before connecting your wallet. The team will never ask for your seed phrase or private key.
      </SectionCallout>

      {links.map(cat => (
        <div key={cat.category} style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 12px', letterSpacing: '-0.2px' }}>
            {cat.category}
          </h2>
          <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
            {cat.items.map((item, i) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px', gap: 12, textDecoration: 'none',
                  background: '#fff', transition: 'background 0.15s',
                  borderBottom: i < cat.items.length - 1 ? '1px solid #f1f5f9' : 'none',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = '#fff'}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0052ff', marginBottom: 3 }}>{item.label}</div>
                  <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.4 }}>{item.desc}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M2 7h10M7 2l5 5-5 5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            ))}
          </div>
        </div>
      ))}
    </section>
  )
}

// ─── Section: HH UTILITY & ECONOMY ───────────────────────────────────────────
function UtilitySection() {
  return (
    <section id="utility-economy" style={{ marginTop: 60, paddingTop: 40, borderTop: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0052ff', marginBottom: 10, letterSpacing: 0.2 }}>
        $HH Coin
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: '0 0 10px', letterSpacing: '-0.5px' }}>
        $HH Utility & Economy
      </h1>
      <p style={{ fontSize: 14.5, color: '#64748b', margin: '0 0 28px', lineHeight: 1.65 }}>
        $HH is the native coin of the Happy Hour ecosystem — not a speculative token, but a functional coin built to power every interaction in the app.
      </p>

      {/* Smart Contracts */}
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 6px', letterSpacing: '-0.3px' }}>
        Smart Contracts
      </h2>
      <p style={{ fontSize: 13.5, color: '#64748b', margin: '0 0 16px', lineHeight: 1.6 }}>
        All Happy Hour contracts are deployed on Base mainnet and fully verifiable on Basescan.
      </p>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: '4px 18px 0', background: '#fff', marginBottom: 28 }}>
        <AddressRow
          label="$HH Coin"
          addr={CONTRACTS.HH_TOKEN}
          desc="The native $HH coin contract. Used for staking, in-app transactions, and burn mechanics."
        />
        <AddressRow
          label="HappyHour Payments Vault"
          addr={CONTRACTS.PAYMENTS}
          desc="Receives all USDC payments (check-ins, daily boost, raids, boxes). Funds are distributed to the treasury and burned per the economic model."
        />
        <AddressRow
          label="HappyHour Staking"
          addr={CONTRACTS.STAKING}
          desc="Manages $HH staking positions. Users lock $HH for fixed durations and earn HP points + APR rewards."
        />
        <AddressRow
          label="HH Raffle Vault"
          addr={CONTRACTS.RAFFLE_VAULT}
          desc="Holds USDC raffle pools and executes winner payouts. 85% goes to the winner, 15% is burned."
        />
        <AddressRow
          label="HH Manager"
          addr={CONTRACTS.HH_MANAGER}
          desc="Core app orchestration contract. Manages task completions, box openings, and on-chain verification of user actions."
        />
        <AddressRow
          label="Foundation Treasury"
          addr={CONTRACTS.FOUNDATION}
          desc="Treasury vault smart contract. Receives 70% of in-app transaction fees and distributes rewards to the community."
        />
      </div>

      {/* Utility */}
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '32px 0 12px', letterSpacing: '-0.3px' }}>
        $HH In-App Utility
      </h2>
      <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.75, margin: '0 0 16px' }}>
        Unlike coins with no functional use, $HH is woven into every layer of the Happy Hour experience:
      </p>

      <div style={{ display: 'grid', gap: 14, marginBottom: 28 }}>
        {[
          {
            icon: '🔒',
            title: 'Staking',
            body: 'Lock $HH for 7 days (103% APR) or 10 days (166% APR) to earn APR rewards paid in $HH, plus HP points that contribute to your seasonal USDC reward allocation. Staking directly reduces circulating supply and creates long-term holding incentives.',
          },
          {
            icon: '💎',
            title: 'Hold-to-Earn',
            body: 'Simply holding $HH in your connected wallet earns HP points every day. The more $HH you hold, the more points you accumulate — rewarding long-term holders with real seasonal USDC distributions.',
          },
          {
            icon: '🔥',
            title: 'In-App Burn',
            body: 'The Happy Boxes section lets users burn $HH directly to purchase additional daily opening attempts. This is a direct deflationary mechanism — permanently removing $HH from supply in exchange for in-app privileges.',
          },
          {
            icon: '⚔️',
            title: 'Raid Payments',
            body: 'Happy Raids can be paid with $HH as an alternative to USDC, creating additional demand for the coin beyond speculation.',
          },
          {
            icon: '🏆',
            title: 'Points & Seasonal Rewards',
            body: 'HP (Happy Points) are earned through all in-app activities. At the end of each season, the top HP holders receive USDC distributions from the treasury — making $HH utility directly linked to real monetary rewards.',
          },
        ].map(item => (
          <div key={item.title} style={{
            display: 'flex', gap: 16, padding: '16px 18px',
            border: '1px solid #e2e8f0', borderRadius: 12, background: '#fff',
          }}>
            <div style={{ fontSize: 24, flexShrink: 0, marginTop: 1 }}>{item.icon}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 5 }}>{item.title}</div>
              <div style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.7 }}>{item.body}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Economy */}
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '32px 0 12px', letterSpacing: '-0.3px' }}>
        Tokenomics & Economic Model
      </h2>
      <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.75, margin: '0 0 20px' }}>
        The Happy Hour economy is designed to be deflationary and community-first. Every transaction in the app feeds back into the ecosystem — either reducing supply or funding community rewards.
      </p>

      {/* In-App Transaction Fee */}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 10px' }}>
        In-App Transaction Split
      </h3>
      <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.65, margin: '0 0 14px' }}>
        Every USDC payment made inside the app (check-ins, daily boosts, raids, boxes) follows this split:
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
        <div style={{
          background: 'linear-gradient(135deg, #fff7ed 0%, #fff 100%)',
          border: '1.5px solid #fed7aa', borderRadius: 14, padding: '18px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#ea580c', marginBottom: 4 }}>30%</div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#9a3412', marginBottom: 6 }}>🔥 Burned</div>
          <div style={{ fontSize: 12, color: '#c2410c', lineHeight: 1.5 }}>Permanently removed from supply. Every transaction makes $HH more scarce.</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #eff6ff 0%, #fff 100%)',
          border: '1.5px solid #bfdbfe', borderRadius: 14, padding: '18px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#1d4ed8', marginBottom: 4 }}>70%</div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1e3a8a', marginBottom: 6 }}>🏦 Treasury</div>
          <div style={{ fontSize: 12, color: '#1d4ed8', lineHeight: 1.5 }}>Goes to the Foundation Treasury. Distributed as staking rewards & seasonal USDC payouts.</div>
        </div>
      </div>

      {/* Raffle */}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '24px 0 10px' }}>
        HH Raffle Distribution
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 24 }}>
        <div style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #fff 100%)',
          border: '1.5px solid #bbf7d0', borderRadius: 14, padding: '18px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#15803d', marginBottom: 4 }}>85%</div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#14532d', marginBottom: 6 }}>🏆 Winner</div>
          <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.5 }}>Every raffle round pays 85% of the total pool directly to the winner.</div>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, #fff7ed 0%, #fff 100%)',
          border: '1.5px solid #fed7aa', borderRadius: 14, padding: '18px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#ea580c', marginBottom: 4 }}>15%</div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#9a3412', marginBottom: 6 }}>🔥 Burned</div>
          <div style={{ fontSize: 12, color: '#c2410c', lineHeight: 1.5 }}>15% of every raffle pool is permanently burned — adding continuous deflationary pressure.</div>
        </div>
      </div>

      {/* Fee Recipient */}
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '24px 0 10px' }}>
        Fee Recipient & Treasury Operations
      </h3>
      <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.75, margin: '0 0 14px' }}>
        The Happy Hour app operates a designated fee recipient — the project founder — who receives a portion of onchain transaction fees generated by the ecosystem. These funds are not retained for personal use. They serve two explicit purposes:
      </p>
      <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
        {[
          { icon: '💰', title: 'Treasury Funding', body: 'The majority of fee recipient proceeds are directed to the Foundation Treasury to ensure sustainable staking reward payouts and seasonal USDC distributions for the community.' },
          { icon: '🔥', title: 'Coin Burns', body: 'A portion of fee recipient funds is used for direct $HH coin burns, reinforcing the deflationary model and supporting long-term coin value.' },
        ].map(item => (
          <div key={item.title} style={{
            display: 'flex', gap: 14, padding: '14px 16px',
            background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
          }}>
            <div style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a', marginBottom: 4 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.65 }}>{item.body}</div>
            </div>
          </div>
        ))}
      </div>

      <SectionCallout type="note">
        All treasury addresses and contract interactions are fully transparent and verifiable on Basescan. The economic model is enforced at the smart contract level — not through trusted third parties.
      </SectionCallout>

      {/* Why not a memecoin */}
      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '36px 0 12px', letterSpacing: '-0.3px' }}>
        $HH: Community Coin, Not a Memecoin
      </h2>
      <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.75, margin: '0 0 16px' }}>
        $HH was born from the Bankr community — organic, community-driven, and free from VC allocation or team token unlocks. What separates $HH from a typical memecoin is sustained, real utility embedded in a live application:
      </p>
      <div style={{ display: 'grid', gap: 10, marginBottom: 24 }}>
        {[
          '✅ Accepted as an in-app payment coin on a live consumer application',
          '✅ Staking with real APR rewards paid in $HH',
          '✅ Hold-to-earn mechanics — passive HP accumulation for USDC rewards',
          '✅ Active burn mechanics embedded in every transaction and raffle',
          '✅ Deflationary by design — every app interaction reduces supply',
          '✅ Community-governed, community-powered, community-rewarded',
        ].map(item => (
          <div key={item} style={{
            fontSize: 13.5, color: '#374151', lineHeight: 1.6,
            padding: '10px 14px', background: '#f8fafc',
            border: '1px solid #e2e8f0', borderRadius: 8,
          }}>
            {item}
          </div>
        ))}
      </div>
      <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.75, margin: '0 0 12px' }}>
        The vision is clear: build a coin that the community wants to hold long-term — because holding it, using it, and staking it all generate real economic value in return.
      </p>

      <SectionCallout type="tip">
        Want to join the Happy Hour community? Connect your Base wallet at <a href="https://happy-hour-based.app" target="_blank" rel="noopener noreferrer" style={{ color: '#0052ff', fontWeight: 600 }}>happy-hour-based.app</a> and start earning from day one.
      </SectionCallout>
    </section>
  )
}

// ─── ROOT DOCS COMPONENT ──────────────────────────────────────────────────────
export function DocsPage() {
  const [activeSection, setActiveSection] = useState('introduction')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const contentRef = useRef(null)

  // Scroll-spy
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActiveSection(e.target.id)
        }
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    )
    const sections = document.querySelectorAll('section[id]')
    sections.forEach(s => obs.observe(s))
    return () => obs.disconnect()
  }, [])

  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveSection(id)
    setMobileNavOpen(false)
  }

  const allItems = NAV.flatMap(g => g.items)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }
        html { scroll-behavior: smooth; }
        .docs-nav-item:hover { background: #f1f5f9 !important; color: #0f172a !important; }
        .docs-nav-item.active { background: #eff6ff !important; color: #0052ff !important; font-weight: 700 !important; }
        @media (max-width: 768px) {
          .docs-sidebar { display: none !important; }
          .docs-sidebar.open { display: flex !important; }
          .docs-mobile-menu-btn { display: flex !important; }
          .docs-content-wrap { margin-left: 0 !important; max-width: 100% !important; }
        }
        @media (min-width: 769px) {
          .docs-mobile-menu-btn { display: none !important; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#fff', fontFamily: "'Inter', sans-serif" }}>

        {/* Top Header */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', height: 60,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {/* Mobile menu button */}
            <button
              className="docs-mobile-menu-btn"
              onClick={() => setMobileNavOpen(v => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: 6, borderRadius: 6, color: '#64748b',
                display: 'none', alignItems: 'center',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src="/logo.png" alt="Happy Hour" style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} />
              <span style={{ fontWeight: 800, fontSize: 15.5, color: '#0f172a', letterSpacing: '-0.3px' }}>
                Happy Hour <span style={{ color: '#94a3b8', fontWeight: 500 }}>docs</span>
              </span>
            </div>
          </div>
          <a
            href="https://happy-hour-based.app"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              background: '#0052ff', color: '#fff', fontWeight: 700, fontSize: 13,
              padding: '7px 18px', borderRadius: 8, textDecoration: 'none',
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Open App →
          </a>
        </header>

        <div style={{ display: 'flex', maxWidth: 1200, margin: '0 auto' }}>

          {/* Sidebar */}
          <aside
            className={`docs-sidebar${mobileNavOpen ? ' open' : ''}`}
            style={{
              width: 248, flexShrink: 0, position: 'sticky', top: 60,
              height: 'calc(100vh - 60px)', overflowY: 'auto',
              padding: '24px 0', borderRight: '1px solid #f1f5f9',
              display: 'flex', flexDirection: 'column',
              background: '#fff',
              // Mobile overlay styles applied via class
              ...(mobileNavOpen ? {
                position: 'fixed', top: 60, left: 0, bottom: 0, zIndex: 99,
                boxShadow: '4px 0 20px rgba(0,0,0,0.1)',
              } : {}),
            }}
          >
            {NAV.map(group => (
              <div key={group.group} style={{ marginBottom: 24 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase',
                  letterSpacing: 1, padding: '0 20px', marginBottom: 4,
                }}>
                  {group.group}
                </div>
                {group.items.map(item => (
                  <button
                    key={item.id}
                    onClick={() => scrollTo(item.id)}
                    className={`docs-nav-item${activeSection === item.id ? ' active' : ''}`}
                    style={{
                      width: '100%', textAlign: 'left', background: 'none', border: 'none',
                      cursor: 'pointer', padding: '7px 20px', fontSize: 13.5,
                      fontWeight: activeSection === item.id ? 700 : 500,
                      color: activeSection === item.id ? '#0052ff' : '#475569',
                      borderRadius: 0, transition: 'all 0.15s',
                      fontFamily: 'inherit',
                      borderLeft: activeSection === item.id ? '2px solid #0052ff' : '2px solid transparent',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ))}

            {/* Back to App */}
            <div style={{ marginTop: 'auto', padding: '20px 20px 0' }}>
              <a
                href="/"
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontSize: 12.5, color: '#94a3b8', textDecoration: 'none',
                  fontWeight: 600, transition: 'color 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#64748b'}
                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
              >
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <path d="M10 6.5H3M3 6.5L6 3.5M3 6.5L6 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Back to App
              </a>
            </div>
          </aside>

          {/* Mobile nav backdrop */}
          {mobileNavOpen && (
            <div
              onClick={() => setMobileNavOpen(false)}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)',
                zIndex: 98, display: 'none',
              }}
              className="docs-mobile-backdrop"
            />
          )}

          {/* Main content */}
          <main
            ref={contentRef}
            className="docs-content-wrap"
            style={{
              flex: 1, minWidth: 0, padding: '48px 56px 120px',
              maxWidth: 780,
            }}
          >
            {/* Prev/Next nav */}
            <IntroSection onNav={scrollTo} />
            <LinksSection />
            <UtilitySection />

            {/* Bottom nav */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', marginTop: 60,
              paddingTop: 24, borderTop: '1px solid #f1f5f9', gap: 12, flexWrap: 'wrap',
            }}>
              {allItems.map((item, i) => {
                const isFirst = i === 0
                const isLast = i === allItems.length - 1
                if (isFirst) return null
                return (
                  <button
                    key={item.id}
                    onClick={() => scrollTo(allItems[i - 1]?.id)}
                    style={{
                      background: 'none', border: '1px solid #e2e8f0', borderRadius: 10,
                      padding: '10px 18px', cursor: 'pointer', fontSize: 13,
                      color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'all 0.15s', fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#0052ff'; e.currentTarget.style.color = '#0052ff' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569' }}
                  >
                    ← {allItems[i - 1]?.label}
                  </button>
                )
              }).filter(Boolean)}
              {allItems.map((item, i) => {
                if (i === allItems.length - 1) return null
                return (
                  <button
                    key={item.id + '-next'}
                    onClick={() => scrollTo(allItems[i + 1]?.id)}
                    style={{
                      background: 'none', border: '1px solid #e2e8f0', borderRadius: 10,
                      padding: '10px 18px', cursor: 'pointer', fontSize: 13,
                      color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'all 0.15s', fontFamily: 'inherit', marginLeft: 'auto',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#0052ff'; e.currentTarget.style.color = '#0052ff' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569' }}
                  >
                    {allItems[i + 1]?.label} →
                  </button>
                )
              }).filter(Boolean)}
            </div>

            {/* Footer */}
            <div style={{
              marginTop: 48, paddingTop: 20, borderTop: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 8,
            }}>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                © {new Date().getFullYear()} Happy Hour. Built on Base.
              </span>
              <a
                href="https://x.com/HappyHourBased"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'none', fontWeight: 600 }}
                onMouseEnter={e => e.currentTarget.style.color = '#64748b'}
                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
              >
                @HappyHourBased ↗
              </a>
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
