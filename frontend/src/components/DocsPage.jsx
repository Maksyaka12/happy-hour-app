import { useEffect, useRef, useState } from 'react'

// ─── Contract addresses ───────────────────────────────────────────────────────
const CONTRACTS = {
  HH_TOKEN:         '0x8235EdF32a1e10Bd1867ad622915AB613664cbA3',
  USDC_PAYMENTS:    '0x7E861466bC2845C9f57051fb9652bC4a56d95542',
  USDC_RAFFLE:      '0x3bdF461984142C473F2185B4F0F64a918B8ce49b',
  HH_PAYMENTS:      '0x13802fDe66BCf54BcebE2242aF0836A5Dfb45Fc8',
  HH_RAFFLE:        '0xdE76F43E17B1173947f63b72C85a2f0d9a97702F',
  HH_STAKING:       '0xFd23526111280b78FF4e7F38B1fAF5818B9c5214',
}

// ─── Nav sections ─────────────────────────────────────────────────────────────
const NAV = [
  {
    group: 'Getting Started',
    items: [
      { id: 'introduction',   label: 'Introduction' },
      { id: 'official-links', label: 'Official Links' },
      { id: 'contracts',      label: 'Contracts' },
    ]
  },
  {
    group: '$HH Coin',
    items: [
      { id: 'hh-introduction', label: '$HH Introduction' },
      { id: 'hh-utility',      label: '$HH Utility' },
      { id: 'hh-economy',      label: '$HH Economy' },
    ]
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
      borderRadius: 6, padding: '3px 10px', fontSize: 11.5, fontWeight: 600,
      cursor: 'pointer', color: copied ? '#2e7d32' : '#64748b',
      display: 'inline-flex', alignItems: 'center', gap: 5, transition: 'all 0.2s',
      fontFamily: 'inherit', flexShrink: 0,
    }}>
      {copied ? (
        <><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#2e7d32" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>Copied</>
      ) : (
        <><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="1" y="3" width="7" height="8" rx="1.5" stroke="#64748b" strokeWidth="1.3"/><path d="M4 3V2.5A1.5 1.5 0 015.5 1h3A1.5 1.5 0 0110 2.5v6A1.5 1.5 0 018.5 10H8" stroke="#64748b" strokeWidth="1.3"/></svg>Copy</>
      )}
    </button>
  )
}

function SectionCallout({ type = 'note', children }) {
  const styles = {
    note:      { bg: '#eff6ff', border: '#bfdbfe', icon: 'ℹ️', label: 'Note',      labelColor: '#1d4ed8' },
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

function QuickCard({ icon, title, desc, href, sectionId, onNav, isImg, isCoin }) {
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
        display: 'block', padding: '22px 24px',
        border: '1.5px solid #e2e8f0', borderRadius: 14,
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
      <div style={{ marginBottom: 10 }}>
        {isImg
          ? <img src={icon} alt={title} style={{ width: 32, height: 32, borderRadius: isCoin ? '50%' : 8, objectFit: 'cover', boxShadow: isCoin ? '0 2px 8px rgba(0,82,255,0.18)' : 'none' }} />
          : <span style={{ fontSize: 26 }}>{icon}</span>
        }
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{desc}</div>
    </a>
  )
}

// ─── Contract row ─────────────────────────────────────────────────────────────
function ContractRow({ label, addr, desc }) {
  return (
    <div style={{ padding: '14px 18px', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0f172a', marginBottom: desc ? 4 : 10 }}>{label}</div>
      {desc && <div style={{ fontSize: 12.5, color: '#64748b', marginBottom: 10, lineHeight: 1.5 }}>{desc}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <code style={{
          fontFamily: "'DM Mono', 'Fira Mono', monospace", fontSize: 11.5, color: '#475569',
          background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6,
          padding: '5px 10px', wordBreak: 'break-all', flex: 1, minWidth: 180,
        }}>
          {addr}
        </code>
        <CopyBtn text={addr} />
      </div>
    </div>
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
      <p style={{ fontSize: 15.5, color: '#475569', margin: '0 0 32px', lineHeight: 1.65 }}>
        Happy Hour is a consumer app built on Base.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '0 0 12px', letterSpacing: '-0.3px' }}>
        What is Happy Hour?
      </h2>
      <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.8, margin: '0 0 16px' }}>
        Happy Hour is a consumer application built on Base, featuring hourly USDC and $HH raffles with full on-chain randomization — giving every participant an equal chance to win. The platform includes a comprehensive points system that rewards users for in-app activity, with seasonal USDC distributions for the most active community members.
      </p>
      <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.8, margin: '0 0 28px' }}>
        $HH is the <span style={{ fontWeight: 600, color: '#334155' }}>native utility coin</span> of Happy Hour App. It was created by the Bankr community — the coin is <span style={{ fontWeight: 600, color: '#334155' }}>owned by BANKR</span> — and we accepted it as the native coin of Happy Hour, embedding <span style={{ fontWeight: 600, color: '#334155' }}>real utility</span> and <span style={{ fontWeight: 600, color: '#334155' }}>economy </span>into it. This makes <span style={{ fontWeight: 600, color: '#334155' }}>$HH a long-term ecosystem coin</span>, not just a speculative asset (memecoin).
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '32px 0 16px', letterSpacing: '-0.3px' }}>
        Explore
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16, marginBottom: 32 }}>
        <QuickCard
          icon="/logo.png"
          isImg
          title="Happy Hour App"
          desc="Connect your Base wallet and start earning USDC and $HH rewards."
          href="https://happy-hour-based.app"
        />
        <QuickCard
          icon="/logo.png"
          isImg
          isCoin
          title="$HH Utility & Economy"
          desc="Contracts, tokenomics, staking APR, burn mechanics, and the full economic model."
          sectionId="hh-introduction"
          onNav={onNav}
        />
      </div>

      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#0f172a', margin: '32px 0 12px', letterSpacing: '-0.3px' }}>
        Built on Base
      </h2>
      <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.8, margin: '0' }}>
        All transactions, staking, and contract interactions happen on Base — Ethereum's fastest-growing L2, incubated by Coinbase. Base provides low fees, high throughput, and access to the broader Ethereum ecosystem.
      </p>
    </section>
  )
}

// ─── Section: OFFICIAL LINKS ─────────────────────────────────────────────────
function LinksSection() {
  return (
    <section id="official-links" style={{ marginTop: 60, paddingTop: 40, borderTop: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0052ff', marginBottom: 10, letterSpacing: 0.2 }}>
        Getting Started
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: '0 0 10px', letterSpacing: '-0.5px' }}>
        Official Links
      </h1>
      <p style={{ fontSize: 14.5, color: '#64748b', margin: '0 0 32px', lineHeight: 1.65 }}>
        All official Happy Hour resources and social media platforms.
      </p>

      {/* Application */}
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '0 0 12px' }}>Application</h2>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 4 }}>
        {[
          { label: 'Happy Hour App (Web Version)',      url: 'https://happy-hour-based.app/' },
          { label: 'Happy Hour App (Base App Version)', url: 'https://happy-hour-based.app/r/' },
        ].map((item, i, arr) => (
          <a
            key={item.label}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', gap: 16, textDecoration: 'none', background: '#fff',
              transition: 'background 0.15s',
              borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0052ff', marginBottom: 6 }}>{item.label}</div>
              <code style={{
                fontFamily: "'DM Mono', monospace", fontSize: 11.5, color: '#475569',
                background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 5,
                padding: '3px 8px',
              }}>{item.url}</code>
            </div>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <path d="M2 7h10M7 2l5 5-5 5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        ))}
      </div>

      {/* Socials */}
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '28px 0 12px' }}>Socials</h2>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 4 }}>
        {[
          {
            label: 'X — @happyhour_base',
            icon: (
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#000', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 1200 1227" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.163 519.284ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.828Z" fill="white"/>
                </svg>
              </div>
            ),
            url:   'https://x.com/happyhour_base',
          },
          {
            label: 'X (Dev) — @mksvibe',
            icon: (
              <img
                src="/mksvibe.jpg"
                alt="Dev"
                style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0', flexShrink: 0 }}
              />
            ),
            url:   'https://x.com/mksvibe',
          },
          {
            label: 'Telegram — @happyhourapp',
            icon:  (
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#229ED9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path d="M21.8 3.1L2.3 10.8c-1.3.5-1.3 1.3-.2 1.6l4.9 1.5 1.9 5.8c.2.7.4.9 1 .9.5 0 .7-.2 1-.5l2.4-2.3 4.9 3.6c.9.5 1.5.2 1.7-.8L22.9 4c.3-1.3-.5-1.9-1.1-.9z" fill="white"/>
                </svg>
              </div>
            ),
            url:   'https://t.me/happyhourapp',
          },
        ].map((item, i, arr) => (
          <a
            key={item.label}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 18px', textDecoration: 'none', background: '#fff',
              transition: 'background 0.15s',
              borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >
            <span style={{ flexShrink: 0 }}>{item.icon}</span>
            <span style={{ flex: 1, fontWeight: 700, fontSize: 13.5, color: '#0052ff' }}>{item.label}</span>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <path d="M2 7h10M7 2l5 5-5 5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        ))}
      </div>

      {/* Market data */}
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', margin: '28px 0 12px' }}>Market Data</h2>
      <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
        {[
          {
            label: 'DexScreener',
            logo:  '/dexscreener.jpg',
            href:  'https://dexscreener.com/base/0xe186aa00d52844ed05d1b1373fc2ec8b0562d613f9f4b470ee7fafa0c1a388f9',
          },
          {
            label: 'GeckoTerminal',
            logo:  '/geckoterminal.jpg',
            href:  'https://www.geckoterminal.com/base/pools/0xe186aa00d52844ed05d1b1373fc2ec8b0562d613f9f4b470ee7fafa0c1a388f9',
          },
          {
            label: 'Basescan',
            logo:  '/basescan-logo.svg',
            href:  `https://basescan.org/token/${CONTRACTS.HH_TOKEN}`,
          },
        ].map((item, i, arr) => (
          <a
            key={item.label}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '13px 18px', textDecoration: 'none', background: '#fff',
              transition: 'background 0.15s',
              borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >
            <img src={item.logo} alt={item.label} style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover', border: '1px solid #e2e8f0', flexShrink: 0 }} />
            <span style={{ flex: 1, fontWeight: 600, fontSize: 13.5, color: '#0f172a' }}>{item.label}</span>
            <span style={{ fontSize: 11, color: '#94a3b8', fontFamily: "'DM Mono', monospace" }}>
              {item.href.replace('https://', '').split('/')[0]}
            </span>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <path d="M2 7h10M7 2l5 5-5 5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        ))}
      </div>
    </section>
  )
}

// ─── Section: CONTRACTS ──────────────────────────────────────────────────────
function ContractsSection() {
  return (
    <section id="contracts" style={{ marginTop: 60, paddingTop: 40, borderTop: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0052ff', marginBottom: 10, letterSpacing: 0.2 }}>
        Getting Started
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: '0 0 10px', letterSpacing: '-0.5px' }}>
        Contracts
      </h1>
      <p style={{ fontSize: 14.5, color: '#64748b', margin: '0 0 32px', lineHeight: 1.65 }}>
        All verified on-chain smart contracts deployed on Base mainnet.
      </p>

      {/* Official CA */}
      <div style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #fff 100%)', border: '1.5px solid #bfdbfe', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#0052ff', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Official $HH CA</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <code style={{
            fontFamily: "'DM Mono', 'Fira Mono', monospace", fontSize: 12, color: '#1e3a8a',
            background: 'rgba(255,255,255,0.7)', border: '1px solid #bfdbfe', borderRadius: 6,
            padding: '5px 10px', wordBreak: 'break-all', flex: 1, minWidth: 180,
          }}>
            {CONTRACTS.HH_TOKEN}
          </code>
          <CopyBtn text={CONTRACTS.HH_TOKEN} />
        </div>
      </div>

      {/* USDC contracts */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>USDC Contracts</div>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ borderBottom: '1px solid #f1f5f9' }}>
            <ContractRow
              label="HappyHour USDC Payments Vault"
              addr={CONTRACTS.USDC_PAYMENTS}
              desc="Receives all in-app USDC payments"
            />
          </div>
          <ContractRow
            label="HappyHour USDC Raffle Vault"
            addr={CONTRACTS.USDC_RAFFLE}
            desc="Holds USDC raffle pools and executes payouts: 85% to the winner, 15% goes to the treasury"
          />
        </div>
      </div>

      {/* HH contracts */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>$HH Contracts</div>
        <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ borderBottom: '1px solid #f1f5f9' }}>
            <ContractRow
              label="HappyHour $HH Payments Vault"
              addr={CONTRACTS.HH_PAYMENTS}
              desc="Receives all in-app $HH payments & burns 30% of every transaction"
            />
          </div>
          <div style={{ borderBottom: '1px solid #f1f5f9' }}>
            <ContractRow
              label="HappyHour $HH Raffle Vault"
              addr={CONTRACTS.HH_RAFFLE}
              desc="Holds $HH raffle pools and executes payouts: 85% to the winner, 15% is burned"
            />
          </div>
          <div style={{ borderBottom: '1px solid #f1f5f9' }}>
            <ContractRow
              label="HappyHour $HH Staking Vault"
              addr={CONTRACTS.HH_STAKING}
            />
          </div>
          <ContractRow
            label="Burn Address"
            addr="0x000000000000000000000000000000000000dEaD"
            desc="The burn address used to permanently remove $HH from circulation from every in-app transaction & fee recipient burns"
          />
        </div>
      </div>
    </section>
  )
}

// Reusable link table
function LinkTable({ items }) {
  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 4 }}>
      {items.map((item, i) => (
        <a
          key={item.label}
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            padding: '14px 18px', gap: 16, textDecoration: 'none', background: '#fff',
            transition: 'background 0.15s',
            borderBottom: i < items.length - 1 ? '1px solid #f1f5f9' : 'none',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
          onMouseLeave={e => e.currentTarget.style.background = '#fff'}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: '#0052ff', marginBottom: 3 }}>{item.label}</div>
            {item.desc && <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.45, marginBottom: 4 }}>{item.desc}</div>}
            <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: '#94a3b8', wordBreak: 'break-all' }}>{item.url}</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: 2 }}>
            <path d="M2 7h10M7 2l5 5-5 5" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
      ))}
    </div>
  )
}

// ─── Section: HH INTRODUCTION ────────────────────────────────────────────────
function HHIntroSection() {
  return (
    <section id="hh-introduction" style={{ marginTop: 60, paddingTop: 40, borderTop: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0052ff', marginBottom: 10, letterSpacing: 0.2 }}>
        $HH Coin
      </div>
      <img 
        src="/banner-introduction.jfif" 
        alt="Introduction Banner" 
        style={{ width: '100%', borderRadius: 12, display: 'block', marginBottom: 24, border: '1px solid #e2e8f0' }} 
      />
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: '0 0 16px', letterSpacing: '-0.5px' }}>
        $HH Introduction
      </h1>
      <p style={{ fontSize: 14.5, color: '#64748b', margin: '0 0 16px', lineHeight: 1.75 }}>
        $HH is the <span style={{ fontWeight: 600, color: '#334155' }}>native utility coin</span> of Happy Hour App. It was created by the Bankr community — the coin is <span style={{ fontWeight: 600, color: '#334155' }}>owned by BANKR</span>, ensuring full transparency, zero team speculation, and no insider allocations. We <span style={{ fontWeight: 600, color: '#334155' }}>accepted $HH</span> as the native coin of Happy Hour and embedded <span style={{ fontWeight: 600, color: '#334155' }}>real utility</span> into it across the entire application. This makes $HH a <span style={{ fontWeight: 600, color: '#334155' }}>long-term ecosystem coin</span> — not just a speculative asset (memecoin).
      </p>
      <p style={{ fontSize: 14.5, color: '#64748b', margin: '0', lineHeight: 1.75 }}>
        The Happy Hour team is fully committed to supporting $HH and reinforcing its role within our ecosystem. We are continuously building, integrating, and expanding utility to ensure its long-term strength, organic demand, and stability.
      </p>
    </section>
  )
}

// ─── Section: HH UTILITY ─────────────────────────────────────────────────────
function HHUtilitySection() {
  return (
    <section id="hh-utility" style={{ marginTop: 60, paddingTop: 40, borderTop: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0052ff', marginBottom: 10, letterSpacing: 0.2 }}>
        $HH Coin
      </div>
      <img 
        src="/banner-utility.jfif" 
        alt="Utility Banner" 
        style={{ width: '100%', borderRadius: 12, display: 'block', marginBottom: 24, border: '1px solid #e2e8f0' }} 
      />
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: '0 0 16px', letterSpacing: '-0.5px' }}>
        $HH Utility
      </h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {[
          {
            title: 'Staking',
            body: 'Lock $HH for 7 days (103% APR) or 10 days (166% APR) to earn APR rewards paid in $HH, plus HP points that contribute to your seasonal USDC reward allocation. Staking directly reduces circulating supply and creates long-term holding incentives.',
          },
          {
            title: 'Hold-to-Earn',
            body: 'Holding $HH in your registered in app wallet earns HP points passively every day. The more $HH you hold, the more points you accumulate — rewarding long-term holders with seasonal USDC distributions.',
          },
          {
            title: 'Native In-App Currency',
            body: '$HH is the native currency of the Happy Hour App, powering all in-app transactions and payments.',
          },
          {
            title: 'In-App Burn',
            body: '30% of every transaction and payment made in $HH within the app is permanently burned, removing $HH from circulation. Certain in-app features also offer direct $HH burning to unlock exclusive privileges and boost points generation for seasonal USDC rewards.',
          },
          {
            title: 'Points & Seasonal Rewards',
            body: 'HP (Happy Points) are earned through all in-app activities. At the end of each season, top HP holders receive USDC distributions from the treasury — directly linking $HH utility to real monetary rewards.',
          },
        ].map((item, index) => (
          <div key={item.title} style={{ paddingBottom: index < 4 ? 20 : 0, borderBottom: index < 4 ? '1px solid #f1f5f9' : 'none' }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#0052ff' }} />
              {item.title}
            </h3>
            <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.7, margin: 0, paddingLeft: 14 }}>
              {item.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Section: HH ECONOMY ─────────────────────────────────────────────────────
function HHEconomySection() {
  return (
    <section id="hh-economy" style={{ marginTop: 60, paddingTop: 40, borderTop: '1px solid #f1f5f9' }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0052ff', marginBottom: 10, letterSpacing: 0.2 }}>
        $HH Coin
      </div>
      <img 
        src="/banner-economy.jfif" 
        alt="Economy Banner" 
        style={{ width: '100%', borderRadius: 12, display: 'block', marginBottom: 24, border: '1px solid #e2e8f0' }} 
      />
      <h1 style={{ fontSize: 28, fontWeight: 800, color: '#0f172a', margin: '0 0 16px', letterSpacing: '-0.5px' }}>
        $HH Economy
      </h1>
      <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.75, margin: '0 0 16px' }}>
        The Happy Hour economy is designed to be deflationary and community-first. Every transaction feeds back into the ecosystem — either <span style={{ fontWeight: 600, color: '#334155' }}>reducing supply</span> or <span style={{ fontWeight: 600, color: '#334155' }}>funding community</span> rewards.
      </p>
      <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.75, margin: '0 0 16px' }}>
        $HH is an organic, community-driven coin with <span style={{ fontWeight: 600, color: '#334155' }}>zero VC allocations</span>, <span style={{ fontWeight: 600, color: '#334155' }}>zero team token unlocks</span>, and <span style={{ fontWeight: 600, color: '#334155' }}>no insider distributions</span>. Created by the Bankr community, with <span style={{ fontWeight: 600, color: '#334155' }}>BANKR</span> as the <span style={{ fontWeight: 600, color: '#334155' }}>official coin owner</span>. It is powered by sustained, real-world utility in a live application through automated burns, staking, hold-to-earn points, and continuous deflationary feedback loops.
      </p>
      <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.75, margin: '0 0 28px' }}>
        The Happy Hour team is fully committed to <span style={{ fontWeight: 600, color: '#334155' }}>supporting $HH</span> and reinforcing its role within our ecosystem. We are continuously building, integrating, and expanding utility to ensure its <span style={{ fontWeight: 600, color: '#334155' }}>long-term strength</span>, <span style={{ fontWeight: 600, color: '#334155' }}>organic demand</span>, and <span style={{ fontWeight: 600, color: '#334155' }}>stability</span>.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Item 1: In-App Burn Mechanics */}
        <div style={{ paddingBottom: 20, borderBottom: '1px solid #f1f5f9' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#0052ff' }} />
            In-App Burn Mechanics
          </h3>
          <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.7, margin: '0 0 12px', paddingLeft: 14 }}>
            Every payment inside the application is automatically split at the smart contract level: <span style={{ fontWeight: 600, color: '#334155' }}>30%</span> of every transaction is permanently burned to reduce circulating supply, and <span style={{ fontWeight: 600, color: '#334155' }}>70%</span> goes to the Foundation Treasury to fund staking incentives and seasonal rewards.
          </p>
          <div style={{ paddingLeft: 24, display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#334155', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: '#64748b' }} />
                Raffle Burn Mechanics
              </div>
              <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.6, paddingLeft: 10 }}>
                Every round of the $HH raffle pool has an automated deflationary mechanic: <span style={{ fontWeight: 600, color: '#334155' }}>85%</span> of the total pool is paid directly to the raffle winner, and <span style={{ fontWeight: 600, color: '#334155' }}>15%</span> is permanently burned.
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#334155', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: '#64748b' }} />
                Boxes Burn Mechanics
              </div>
              <div style={{ fontSize: 12.5, color: '#64748b', lineHeight: 1.6, paddingLeft: 10 }}>
                Users can burn $HH directly to unlock exclusive in-app privileges, such as purchasing additional daily attempts to open Happy Boxes to earn more in-app points.
              </div>
            </div>
          </div>
        </div>

        {/* Item 2: Recipient Fee Utilization */}
        <div>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#0052ff' }} />
            Recipient Fee Utilization
          </h3>
          <p style={{ fontSize: 13.5, color: '#475569', lineHeight: 1.7, margin: 0, paddingLeft: 14 }}>
            All $HH collected through the designated fee recipient address are utilized to strengthen the coin's economy. A significant portion of these fees is permanently burned, while the remainder is redistributed to fund staking incentives and loyalty rewards for active users.
          </p>
        </div>
      </div>
    </section>
  )
}

// ─── ROOT DOCS COMPONENT ──────────────────────────────────────────────────────
export function DocsPage() {
  const [activeSection, setActiveSection] = useState('introduction')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const contentRef = useRef(null)

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
        .docs-nav-item { transition: all 0.15s; }
        .docs-nav-item:hover { background: #f1f5f9 !important; color: #0f172a !important; }
        .docs-nav-item.active { background: #eff6ff !important; color: #0052ff !important; font-weight: 700 !important; }
        .docs-content-section p + p { margin-top: 0; }
        @media (max-width: 768px) {
          .docs-sidebar { display: none !important; }
          .docs-sidebar.open { display: flex !important; position: fixed; top: 60px; left: 0; bottom: 0; z-index: 99; box-shadow: 4px 0 20px rgba(0,0,0,0.1); }
          .docs-mobile-menu-btn { display: flex !important; }
          .docs-content-wrap { padding: 32px 20px 100px !important; }
        }
        @media (min-width: 769px) {
          .docs-mobile-menu-btn { display: none !important; }
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#fff', fontFamily: "'Inter', sans-serif" }}>

        {/* Header */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 100,
          background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', height: 60,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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
              padding: '28px 0', borderRight: '1px solid #f1f5f9',
              display: 'flex', flexDirection: 'column', background: '#fff',
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
                      borderRadius: 0,
                      fontFamily: 'inherit',
                      borderLeft: activeSection === item.id ? '2px solid #0052ff' : '2px solid transparent',
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ))}

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

          {/* Mobile backdrop */}
          {mobileNavOpen && (
            <div
              onClick={() => setMobileNavOpen(false)}
              style={{
                position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)',
                zIndex: 98,
              }}
            />
          )}

          {/* Main content */}
          <main
            ref={contentRef}
            className="docs-content-wrap"
            style={{ flex: 1, minWidth: 0, padding: '48px 60px 120px', maxWidth: 780 }}
          >
            <IntroSection onNav={scrollTo} />
            <LinksSection />
            <ContractsSection />
            <HHIntroSection />
            <HHUtilitySection />
            <HHEconomySection />

            {/* Prev / Next */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', marginTop: 60,
              paddingTop: 24, borderTop: '1px solid #f1f5f9', gap: 12, flexWrap: 'wrap',
            }}>
              {allItems.map((item, i) => {
                if (i === 0) return null
                return (
                  <button
                    key={item.id + '-prev'}
                    onClick={() => scrollTo(allItems[i - 1].id)}
                    style={{
                      background: 'none', border: '1px solid #e2e8f0', borderRadius: 10,
                      padding: '10px 18px', cursor: 'pointer', fontSize: 13,
                      color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'all 0.15s', fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#0052ff'; e.currentTarget.style.color = '#0052ff' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569' }}
                  >
                    ← {allItems[i - 1].label}
                  </button>
                )
              })}
              {allItems.map((item, i) => {
                if (i === allItems.length - 1) return null
                return (
                  <button
                    key={item.id + '-next'}
                    onClick={() => scrollTo(allItems[i + 1].id)}
                    style={{
                      background: 'none', border: '1px solid #e2e8f0', borderRadius: 10,
                      padding: '10px 18px', cursor: 'pointer', fontSize: 13,
                      color: '#475569', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'all 0.15s', fontFamily: 'inherit', marginLeft: 'auto',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#0052ff'; e.currentTarget.style.color = '#0052ff' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569' }}
                  >
                    {allItems[i + 1].label} →
                  </button>
                )
              })}
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
                href="https://x.com/happyhour_base"
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: '#94a3b8', textDecoration: 'none', fontWeight: 600 }}
                onMouseEnter={e => e.currentTarget.style.color = '#64748b'}
                onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
              >
                @happyhour_base ↗
              </a>
            </div>
          </main>
        </div>
      </div>
    </>
  )
}
