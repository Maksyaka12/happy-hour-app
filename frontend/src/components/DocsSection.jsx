// src/components/DocsSection.jsx
import { useState, useEffect, useRef } from 'react'

const CONTRACTS = {
  paymentsVault: '0x7E861466bC2845C9f57051fb9652bC4a56d95542',
  raffleVault: '0xdE76F43E17B1173947f63b72C85a2f0d9a97702F',
  usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
}

const BASESCAN = 'https://basescan.org/address/'

const NAV = [
  { id: 'vision',    icon: '✨', label: 'Vision & Mission' },
  { id: 'overview',  icon: '📖', label: 'How It Works' },
  { id: 'checkin',   icon: '✅', label: 'Daily Check-in' },
  { id: 'streaks',   icon: '🔥', label: 'Streaks' },
  { id: 'hp',        icon: '⭐', label: 'Happy Points (HP)' },
  { id: 'raffle',    icon: '🎰', label: 'Happy Raffle' },
  { id: 'boxes',     icon: '🎁', label: 'Happy Boxes' },
  { id: 'leaderboard', icon: '🏆', label: 'Season 1 Leaderboard' },
  { id: 'activity',  icon: '📊', label: 'Activity Leaderboard' },
  { id: 'tasks',     icon: '📋', label: 'Tasks & Submissions' },
  { id: 'profile',   icon: '👤', label: 'Profile & Levels' },
  { id: 'referral',  icon: '🔗', label: 'Referral Program' },
  { id: 'contracts', icon: '📜', label: 'Smart Contracts' },
  { id: 'faq',       icon: '❓', label: 'FAQ' },
]

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button onClick={copy} style={{
      background: copied ? 'rgba(0,180,100,0.15)' : 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
      fontSize: 11, fontWeight: 600, color: copied ? '#00b464' : 'rgba(255,255,255,0.6)',
      transition: 'all 0.2s', whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function ContractRow({ label, address }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: '14px 16px', marginBottom: 10,
    }}>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600, marginBottom: 6, letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <code style={{
          fontSize: 12, color: '#60a5fa', fontFamily: "'DM Mono', 'Courier New', monospace",
          flex: 1, minWidth: 0, wordBreak: 'break-all',
        }}>{address}</code>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <CopyButton text={address} />
          <a href={`${BASESCAN}${address}`} target="_blank" rel="noopener noreferrer" style={{
            background: 'rgba(0,82,255,0.15)', border: '1px solid rgba(0,82,255,0.3)',
            borderRadius: 8, padding: '4px 10px', textDecoration: 'none',
            fontSize: 11, fontWeight: 600, color: '#60a5fa', whiteSpace: 'nowrap',
          }}>
            Basescan ↗
          </a>
        </div>
      </div>
    </div>
  )
}

function InfoBox({ type = 'info', children }) {
  const styles = {
    info:    { bg: 'rgba(0,82,255,0.08)',  border: 'rgba(0,82,255,0.25)',  icon: 'ℹ️' },
    tip:     { bg: 'rgba(0,180,100,0.08)', border: 'rgba(0,180,100,0.25)', icon: '💡' },
    warning: { bg: 'rgba(252,64,31,0.08)', border: 'rgba(252,64,31,0.25)', icon: '⚠️' },
  }
  const s = styles[type]
  return (
    <div style={{
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 12, padding: '14px 16px', marginTop: 16, marginBottom: 16,
      display: 'flex', gap: 12, alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{s.icon}</span>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.65 }}>{children}</div>
    </div>
  )
}

function Table({ headers, rows }) {
  return (
    <div style={{ overflowX: 'auto', marginTop: 16, marginBottom: 16 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{
                padding: '10px 14px', textAlign: 'left',
                background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                fontWeight: 700, fontSize: 11, letterSpacing: 0.5,
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: i === 0 ? '8px 0 0 0' : i === headers.length - 1 ? '0 8px 0 0' : 0,
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding: '10px 14px', color: 'rgba(255,255,255,0.8)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  background: ri % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Section({ id, icon, title, children }) {
  return (
    <section id={id} style={{ marginBottom: 64, scrollMarginTop: 80 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ fontSize: 28 }}>{icon}</span>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: -0.5 }}>{title}</h2>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.75, color: 'rgba(255,255,255,0.72)' }}>
        {children}
      </div>
    </section>
  )
}

function H3({ children }) {
  return <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', margin: '24px 0 10px', letterSpacing: -0.2 }}>{children}</h3>
}

function P({ children }) {
  return <p style={{ margin: '0 0 14px', lineHeight: 1.75, color: 'rgba(255,255,255,0.72)', fontSize: 14 }}>{children}</p>
}

export function DocsSection({ onClose }) {
  const [activeSection, setActiveSection] = useState('vision')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const contentRef = useRef(null)

  // Track active section on scroll
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const handler = () => {
      const sections = NAV.map(n => document.getElementById(n.id)).filter(Boolean)
      for (let i = sections.length - 1; i >= 0; i--) {
        const rect = sections[i].getBoundingClientRect()
        if (rect.top <= 120) {
          setActiveSection(sections[i].id)
          break
        }
      }
    }
    el.addEventListener('scroll', handler, { passive: true })
    return () => el.removeEventListener('scroll', handler)
  }, [])

  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el && contentRef.current) {
      const offset = el.offsetTop - 80
      contentRef.current.scrollTo({ top: offset, behavior: 'smooth' })
    }
    setActiveSection(id)
    setSidebarOpen(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: '#0A0B0F',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', system-ui, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono&display=swap');
        #docs-content::-webkit-scrollbar { width: 6px; }
        #docs-content::-webkit-scrollbar-track { background: transparent; }
        #docs-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        #docs-sidebar::-webkit-scrollbar { width: 4px; }
        #docs-sidebar::-webkit-scrollbar-track { background: transparent; }
        #docs-sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
      `}</style>

      {/* Header */}
      <div style={{
        height: 56, borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', flexShrink: 0, background: '#0A0B0F', zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* Mobile hamburger */}
          <button onClick={() => setSidebarOpen(s => !s)} style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer', fontSize: 18, padding: 4, display: 'none',
            ['@media (max-width: 768px)']: { display: 'flex' },
          }} className="docs-hamburger">☰</button>
          <span style={{ fontSize: 20 }}>🕐</span>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>
            happy hour <span style={{ color: '#0052FF' }}>docs</span>
          </span>
          <div style={{
            background: 'rgba(0,82,255,0.15)', border: '1px solid rgba(0,82,255,0.3)',
            borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#60a5fa',
          }}>v1.0</div>
        </div>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: '7px 16px', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)',
          display: 'flex', alignItems: 'center', gap: 6,
          transition: 'all 0.2s',
        }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
        >
          ✕ Close
        </button>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .docs-hamburger { display: flex !important; }
          .docs-sidebar { display: ${sidebarOpen ? 'flex' : 'none'} !important; position: fixed !important; top: 56px !important; left: 0 !important; width: 260px !important; height: calc(100vh - 56px) !important; z-index: 100 !important; }
        }
      `}</style>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <div id="docs-sidebar" className="docs-sidebar" style={{
          width: 240, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)',
          overflowY: 'auto', padding: '20px 12px',
          background: '#0A0B0F',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, marginBottom: 8, paddingLeft: 8 }}>
            CONTENTS
          </div>
          {NAV.map(item => (
            <button key={item.id} onClick={() => scrollTo(item.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 9,
              padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: activeSection === item.id ? 'rgba(0,82,255,0.15)' : 'transparent',
              color: activeSection === item.id ? '#60a5fa' : 'rgba(255,255,255,0.55)',
              fontSize: 13, fontWeight: activeSection === item.id ? 700 : 500,
              textAlign: 'left', transition: 'all 0.15s',
              borderLeft: activeSection === item.id ? '2px solid #0052FF' : '2px solid transparent',
            }}
              onMouseEnter={e => { if (activeSection !== item.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
              onMouseLeave={e => { if (activeSection !== item.id) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 15 }}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          {/* Built on Base badge */}
          <div style={{ marginTop: 32, padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>Built on</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 18, height: 18, background: '#0052FF', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 10, color: '#fff', fontWeight: 900 }}>B</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Base</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div id="docs-content" ref={contentRef} style={{
          flex: 1, overflowY: 'auto', padding: '40px 32px 80px',
          maxWidth: '100%',
        }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>

            {/* ── VISION ── */}
            <Section id="vision" icon="✨" title="Vision & Mission">
              <div style={{
                background: 'linear-gradient(135deg, rgba(0,82,255,0.12), rgba(0,180,100,0.08))',
                border: '1px solid rgba(0,82,255,0.2)', borderRadius: 16,
                padding: '24px 28px', marginBottom: 28,
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 10, letterSpacing: -0.5 }}>
                  🕐 Every builder on Base deserves to be happy.
                </div>
                <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
                  Every wallet has a chance. Every day is an opportunity.
                </div>
              </div>
              <P>
                Happy Hour is a daily on-chain rewards app built entirely on <strong style={{ color: '#fff' }}>Base</strong>. We believe that
                participating in crypto should be fun, rewarding, and accessible to everyone — not just whales or early insiders.
              </P>
              <P>
                Our mission is simple: show up daily, engage with the community, earn rewards, and build habits that make being on-chain feel natural and exciting.
              </P>
              <P>
                Every check-in, every raffle entry, every task completed — it all counts. The more you engage, the more you earn.
              </P>
              <InfoBox type="tip">
                Happy Hour runs entirely on the Base blockchain. All transactions, raffles, and payouts happen on-chain — fully transparent and verifiable.
              </InfoBox>
            </Section>

            {/* ── OVERVIEW ── */}
            <Section id="overview" icon="📖" title="How It Works">
              <P>Happy Hour is built around a simple daily loop:</P>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
                {[
                  { n: '1', title: 'Connect Wallet', desc: 'Connect your Base-compatible wallet to get started', icon: '🔗' },
                  { n: '2', title: 'Check In Daily', desc: 'Send a small on-chain tx each day to earn HP & maintain your streak', icon: '✅' },
                  { n: '3', title: 'Earn HP', desc: 'Complete tasks, enter raffles, and boost your Happy Points', icon: '⭐' },
                  { n: '4', title: 'Win Rewards', desc: 'Raffles pay out USDC. Top leaderboard users earn season prizes', icon: '🏆' },
                ].map(s => (
                  <div key={s.n} style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 14, padding: '16px', position: 'relative',
                  }}>
                    <div style={{ fontSize: 22, marginBottom: 8 }}>{s.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{s.title}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>{s.desc}</div>
                    <div style={{
                      position: 'absolute', top: 12, right: 12,
                      width: 22, height: 22, borderRadius: '50%',
                      background: 'rgba(0,82,255,0.2)', border: '1px solid rgba(0,82,255,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 800, color: '#60a5fa',
                    }}>{s.n}</div>
                  </div>
                ))}
              </div>
              <P>The app consists of five main sections: <strong style={{ color: '#fff' }}>Raffle, Happy Boxes, Tasks, Leaderboard,</strong> and <strong style={{ color: '#fff' }}>Profile</strong>. Each section contributes to your overall experience and rewards.</P>
            </Section>

            {/* ── CHECKIN ── */}
            <Section id="checkin" icon="✅" title="Daily Check-in">
              <P>
                The daily check-in is the core habit of Happy Hour. Each day, you send a micro on-chain transaction to confirm your presence and earn rewards.
              </P>
              <H3>How to Check In</H3>
              <P>
                Navigate to your <strong style={{ color: '#fff' }}>Profile</strong> tab and tap the <strong style={{ color: '#fff' }}>Check In</strong> button. This initiates a small USDC transaction from your wallet.
              </P>
              <Table
                headers={['Parameter', 'Value']}
                rows={[
                  ['Check-in cost', '0.0001 USDC'],
                  ['HP earned', '1 HP per check-in'],
                  ['Frequency', 'Once per calendar day (UTC)'],
                  ['Destination', 'Payments Vault Contract'],
                ]}
              />
              <InfoBox type="info">
                Check-ins reset at midnight UTC. You have a full 24-hour window each day to maintain your streak.
              </InfoBox>
              <H3>Why On-Chain?</H3>
              <P>
                Requiring a real transaction ensures that participation is genuine and that the activity is recorded permanently on Base. It also means every check-in contributes to the on-chain activity metrics of our community.
              </P>
            </Section>

            {/* ── STREAKS ── */}
            <Section id="streaks" icon="🔥" title="Streaks">
              <P>
                A streak represents the number of consecutive days you have checked in without missing a day. Streaks are one of the most powerful ways to earn bonus HP.
              </P>
              <H3>Streak Rules</H3>
              <P>
                Your streak increases by 1 for each consecutive day you check in. If you miss a day, your streak resets to 1. There is no maximum — streaks continue indefinitely as long as you don't break the chain.
              </P>
              <H3>Streak Milestone Bonuses</H3>
              <P>When you reach specific milestones, you receive a bonus HP reward on top of your regular check-in HP:</P>
              <Table
                headers={['Milestone', 'Bonus HP', 'Total HP (including base)']}
                rows={[
                  ['Day 3', '+1 HP', '2 HP'],
                  ['Day 7', '+3 HP', '4 HP'],
                  ['Day 14', '+7 HP', '8 HP'],
                  ['Day 30', '+15 HP', '16 HP'],
                ]}
              />
              <InfoBox type="tip">
                After day 30, your streak continues to grow (31, 32, 33...) but milestone bonuses only trigger at the specific days listed above. Keep going — the streak itself is a badge of honor!
              </InfoBox>
              <P>
                Your current streak is always displayed prominently on your Profile page, along with a visual progress bar showing how far you are to the next milestone.
              </P>
            </Section>

            {/* ── HP ── */}
            <Section id="hp" icon="⭐" title="Happy Points (HP)">
              <P>
                Happy Points (HP) are the main currency of participation in Happy Hour. They represent your on-chain activity and engagement level.
              </P>
              <H3>How to Earn HP</H3>
              <Table
                headers={['Action', 'HP Earned']}
                rows={[
                  ['Daily check-in', '1.0 HP / day'],
                  ['3-day streak bonus', '+1.0 HP'],
                  ['7-day streak bonus', '+3.0 HP'],
                  ['14-day streak bonus', '+7.0 HP'],
                  ['30-day streak bonus', '+15.0 HP'],
                  ['HP Boost (0.10 USDC)', '+2.0 HP instantly (Limit: 1/day)'],
                  ['Daily Leaderboard Rank 1', '+20.0 HP'],
                  ['Daily Leaderboard Rank 2-5', '+15.0 HP'],
                  ['Daily Leaderboard Rank 6-10', '+10.0 HP'],
                  ['Daily Leaderboard Rank 11-20', '+5.0 HP'],
                  ['Daily Leaderboard Rank 21-30', '+3.0 HP'],
                  ['Happy Boxes (Common Box)', '2.0 – 4.0 HP (Avg: 3.0 HP)'],
                  ['Happy Boxes (Epic Box)', '5.0 – 10.0 HP (Avg: 7.5 HP)'],
                  ['Happy Boxes (Legendary Box)', '11.0 – 20.0 HP (Avg: 15.5 HP)'],
                  ['Post approval (Social)', '+2.0 HP per approved post'],
                ]}
              />
              <H3>What HP Is Used For</H3>
              <P>
                HP determines your rank on the <strong style={{ color: '#fff' }}>Season 1 Leaderboard</strong>. The more HP you accumulate, the higher your position — and the bigger your share of the seasonal USDC prize pool.
              </P>
              <H3>HP Boost</H3>
              <P>
                If you want to accelerate your HP earning, you can use the <strong style={{ color: '#fff' }}>HP Boost</strong> feature. For 0.10 USDC, you instantly receive +2.0 HP. Boost can be activated once per calendar day as a Sybil protection gate.
              </P>
              <InfoBox type="info">
                HP is non-transferable and lives in your profile. It cannot be sent or traded — it's purely a measure of your engagement.
              </InfoBox>
            </Section>

            {/* ── RAFFLE ── */}
            <Section id="raffle" icon="🎰" title="Happy Raffle">
              <P>
                The Happy Raffle is a live, on-chain lottery where anyone can buy tickets and win a share of the prize pool. Raffles run continuously, with new rounds starting automatically after each winner is drawn.
              </P>
              <H3>How to Enter</H3>
              <P>
                Go to the <strong style={{ color: '#fff' }}>Raffle</strong> tab and choose how many tickets you want to buy. Each ticket costs <strong style={{ color: '#fff' }}>0.1 USDC</strong>. You can buy multiple tickets in a single transaction to increase your chances.
              </P>
              <H3>Prize Pool Distribution</H3>
              <Table
                headers={['Allocation', 'Amount']}
                rows={[
                  ['Winner payout', '85% of the total pool'],
                  ['Platform fee', '15% of the total pool'],
                ]}
              />
              <H3>How the Winner Is Picked</H3>
              <P>
                When the raffle closes, a winner is selected randomly and on-chain. Each ticket is one entry — the more tickets you hold, the higher your probability of winning.
              </P>
              <InfoBox type="info">
                The raffle is fully transparent. You can verify every entry and the winning selection directly on Basescan using our Raffle Vault contract address.
              </InfoBox>
              <H3>Entry Options</H3>
              <Table
                headers={['Tickets', 'Cost (USDC)', 'Notes']}
                rows={[
                  ['1', '0.1 USDC', 'Minimum entry'],
                  ['5', '0.5 USDC', ''],
                  ['10', '1.0 USDC', ''],
                  ['30', '3.0 USDC', ''],
                  ['50', '5.0 USDC', ''],
                  ['100', '10.0 USDC', 'Maximum single entry'],
                ]}
              />
            </Section>

            {/* ── BOXES ── */}
            <Section id="boxes" icon="🎁" title="Happy Boxes">
              <P>
                Happy Boxes are mystery reward boxes that you can open to win surprise prizes. Each box costs USDC to open and contains a randomly selected reward.
              </P>
              <H3>How to Open a Box</H3>
              <P>
                Navigate to the <strong style={{ color: '#fff' }}>Boxes</strong> tab and select a box tier. Confirm the transaction and your prize will be revealed instantly on-screen.
              </P>
              <H3>What Can You Win?</H3>
              <P>
                Boxes contain a variety of prize types including USDC rewards, HP bonuses, and special in-app perks. Each box opening is a unique on-chain interaction.
              </P>
              <H3>Box Tiers & Reward Ranges (V3 Economy)</H3>
              <Table
                headers={['Box Tier', 'Price (USDC)', 'HP Reward Range', 'Special Jackpot Chance']}
                rows={[
                  ['Common Box', '0.20 USDC', '2.0 – 4.0 HP (Avg: 3.0 HP)', 'None'],
                  ['Epic Box', '0.45 USDC', '5.0 – 10.0 HP (Avg: 7.5 HP)', 'None'],
                  ['Legendary Box', '0.95 USDC', '11.0 – 20.0 HP (Avg: 15.5 HP)', 'None'],
                ]}
              />
              <InfoBox type="tip">
                Watch the Boxes tab for limited-time special boxes that appear during events and community milestones.
              </InfoBox>
            </Section>

            {/* ── LEADERBOARD ── */}
            <Section id="leaderboard" icon="🏆" title="Season 1 Leaderboard">
              <P>
                The Season 1 Leaderboard ranks all Happy Hour users by their total accumulated HP. At the end of Season 1, the top users will receive <strong style={{ color: '#fff' }}>USDC prize rewards</strong> directly to their wallets.
              </P>
              <H3>How Rankings Work</H3>
              <P>
                Your leaderboard position is determined by your total HP accumulated throughout the season. Every check-in, streak bonus, boost, and task completion adds to your HP total.
              </P>
              <H3>Season 1 Prizes</H3>
              <P>
                Season 1 prize pool details and the distribution breakdown will be announced as the season progresses. Top-ranked users will receive USDC directly to their connected wallet at the end of the season.
              </P>
              <InfoBox type="warning">
                Season 1 is ongoing. Keep checking in and earning HP every day — the leaderboard is live and competitive!
              </InfoBox>
              <H3>Season Reset</H3>
              <P>
                At the end of each season, the leaderboard resets and Season 2 begins. Your HP history and streak records are preserved, but the ranking competition starts fresh.
              </P>
            </Section>

            {/* ── ACTIVITY ── */}
            <Section id="activity" icon="📊" title="Activity Leaderboard">
              <P>
                In addition to the Season Leaderboard, Happy Hour features an <strong style={{ color: '#fff' }}>Activity Leaderboard</strong> — a daily ranking that measures your on-chain engagement.
              </P>
              <H3>How It Works</H3>
              <P>
                The activity score is calculated daily based on your on-chain actions: check-ins, transactions through Happy Hour contracts, task completions, and more. It is designed to reward consistent daily participants.
              </P>
              <H3>Activity Score Components (AP Logic)</H3>
              <Table
                headers={['Activity Action', 'Points Contributed (AP)', 'Details']}
                rows={[
                  ['Daily Check-in', '30 AP', 'Triggers on your daily check-in'],
                  ['Current Streak', '+1 AP per day', 'E.g., 10 AP for a 10-day streak'],
                  ['Completing Quests', '10 AP per task', 'Plus the transaction AP trigger (20 AP total)'],
                  ['Transaction count', '10 AP per transaction', 'Triggers on checkins, boosts, box opens, bets, etc.'],
                  ['Approved Posts', '50 AP per post', 'Awarded once post is verified and approved'],
                ]}
              />
              <H3>Daily Leaderboard Reward Pyramid (Top-30)</H3>
              <Table
                headers={['Rank Zone', 'Reward per Player', 'Group Payout Status']}
                rows={[
                  ['Rank 1', '20.0 HP', 'V3 prestige pool'],
                  ['Rank 2 – 5', '15.0 HP', 'High prestige tier'],
                  ['Rank 6 – 10', '10.0 HP', 'Active builder tier'],
                  ['Rank 11 – 20', '5.0 HP', 'Community support tier'],
                  ['Rank 21 – 30', '3.0 HP', 'Consolation incentive'],
                ]}
              />
              <InfoBox type="info">
                The Activity Leaderboard resets daily at midnight UTC. It's a great way to see who the most active community members are on any given day and claim valuable prestige HP.
              </InfoBox>
            </Section>

            {/* ── TASKS ── */}
            <Section id="tasks" icon="📋" title="Tasks & Submissions">
              <P>
                The Tasks section contains a list of challenges and quests you can complete to earn additional HP and rewards. Tasks range from simple social actions to on-chain interactions.
              </P>
              <H3>Types of Tasks</H3>
              <Table
                headers={['Type', 'Description']}
                rows={[
                  ['Social tasks', 'Follow on X, join Telegram, etc.'],
                  ['On-chain tasks', 'Perform specific Base transactions'],
                  ['Community tasks', 'Engage with Happy Hour community'],
                  ['Special events', 'Limited-time tasks during events'],
                ]}
              />
              <H3>Submission Process</H3>
              <P>
                Some tasks require proof of completion. After completing the action, submit your proof (link, transaction hash, or screenshot) through the task card. Submissions are reviewed and approved by the team.
              </P>
              <P>
                Once a task is approved, the HP reward is added to your profile automatically.
              </P>
              <InfoBox type="info">
                New tasks are added regularly. Check the Tasks tab often to make sure you don't miss time-limited opportunities.
              </InfoBox>
            </Section>

            {/* ── PROFILE ── */}
            <Section id="profile" icon="👤" title="Profile & Account Levels">
              <P>
                Your Profile is your home base in Happy Hour. It shows your HP balance, current streak, referral stats, and your overall progress in the app.
              </P>
              <H3>Account Levels</H3>
              <P>
                As you accumulate HP and engage with the platform, your account advances through levels. Higher levels unlock additional perks and recognition within the community.
              </P>
              <H3>Profile Information</H3>
              <Table
                headers={['Field', 'Description']}
                rows={[
                  ['HP Balance', 'Total Happy Points earned to date'],
                  ['Current Streak', 'Consecutive days of check-ins'],
                  ['Total Check-ins', 'All-time check-in count'],
                  ['Wins', 'Number of raffle wins'],
                  ['Referrals', 'Number of users you referred'],
                  ['Account Level', 'Your current tier based on HP'],
                ]}
              />
              <H3>Basename Integration</H3>
              <P>
                If your wallet has a <strong style={{ color: '#fff' }}>Base Basename</strong> (e.g., yourname.base.eth), it will automatically display throughout the app instead of your raw wallet address.
              </P>
            </Section>

            {/* ── REFERRAL ── */}
            <Section id="referral" icon="🔗" title="Referral Program">
              <P>
                Grow the Happy Hour community and earn rewards by referring new users. Every time someone joins using your referral link and starts participating, you benefit.
              </P>
              <H3>How to Refer</H3>
              <P>
                Find your unique referral link in the <strong style={{ color: '#fff' }}>Profile</strong> tab under Referral Hub. Share this link with friends on social media, Telegram, or anywhere you like.
              </P>
              <H3>Referral Rewards</H3>
              <P>
                When a referred user connects their wallet and engages with the app, you receive referral points that contribute to your overall standing in the community. The more quality referrals you bring, the greater the reward.
              </P>
              <InfoBox type="tip">
                Your referral code can also be shared as a standalone code (without the full link). New users can enter it manually when connecting for the first time.
              </InfoBox>
              <H3>Referral Tracking</H3>
              <P>
                Your Profile shows your total referral count and referral points in real time. You can also copy your referral link or code directly from the Referral Hub card.
              </P>
            </Section>

            {/* ── CONTRACTS ── */}
            <Section id="contracts" icon="📜" title="Smart Contracts">
              <P>
                All Happy Hour operations are powered by audited smart contracts deployed on the Base mainnet. Every transaction is on-chain and fully verifiable.
              </P>
              <H3>Deployed Contracts</H3>
              <ContractRow label="Payments Vault — Daily check-ins & HP boosts" address={CONTRACTS.paymentsVault} />
              <ContractRow label="Raffle Vault — Raffle ticket sales & prize distribution" address={CONTRACTS.raffleVault} />
              <ContractRow label="USDC (Base) — USD Coin on Base network" address={CONTRACTS.usdc} />

              <H3>Network</H3>
              <Table
                headers={['Parameter', 'Value']}
                rows={[
                  ['Network', 'Base Mainnet'],
                  ['Chain ID', '8453'],
                  ['Currency', 'ETH (gas) / USDC (payments)'],
                  ['Explorer', 'basescan.org'],
                ]}
              />

              <H3>Security</H3>
              <P>
                Our contracts use role-based access control with separate <strong style={{ color: '#fff' }}>owner</strong> and <strong style={{ color: '#fff' }}>operator</strong> roles. The owner can update configuration; the operator handles daily operations. All funds flow through the vault contracts — never through personal wallets.
              </P>
              <InfoBox type="info">
                All contracts are verified on Basescan. You can read the full source code by clicking the Basescan links above.
              </InfoBox>
            </Section>

            {/* ── FAQ ── */}
            <Section id="faq" icon="❓" title="FAQ">
              {[
                {
                  q: 'Do I need ETH to use Happy Hour?',
                  a: 'You need a tiny amount of ETH for gas fees on Base (usually less than $0.01 per transaction). The actual payments are in USDC.',
                },
                {
                  q: 'What happens if I miss a day?',
                  a: 'If you miss a single day, your streak resets to 1. Your total HP remains intact — only the streak counter resets.',
                },
                {
                  q: 'When does the raffle draw happen?',
                  a: 'Raffles draw automatically when the round ends. A new round begins immediately after. Check the Raffle tab for the current countdown timer.',
                },
                {
                  q: 'Can I have multiple entries in one raffle?',
                  a: 'Yes! You can buy as many tickets as you like in a single transaction. More tickets = higher probability of winning.',
                },
                {
                  q: 'Is Happy Hour available worldwide?',
                  a: 'Happy Hour is a permissionless on-chain app. Anyone with a Base-compatible wallet and USDC can participate.',
                },
                {
                  q: 'When does Season 1 end?',
                  a: 'Season 1 end date and prize details will be announced in the community. Stay tuned on X (@mksl3) and Telegram for updates.',
                },
                {
                  q: 'How do referral rewards work?',
                  a: 'When someone uses your referral link to join and starts participating, you earn referral points visible on your Profile. Referral rewards are separate from HP.',
                },
                {
                  q: 'Is my HP lost if Season 1 ends?',
                  a: 'Your HP history is preserved. The leaderboard ranking competition resets for Season 2, but your profile stats remain.',
                },
              ].map((item, i) => (
                <div key={i} style={{
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  paddingBottom: 20, marginBottom: 20,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
                    {item.q}
                  </div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7 }}>
                    {item.a}
                  </div>
                </div>
              ))}

              {/* Footer */}
              <div style={{
                marginTop: 40, padding: '24px', borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(0,82,255,0.1), rgba(0,82,255,0.05))',
                border: '1px solid rgba(0,82,255,0.2)', textAlign: 'center',
              }}>
                <div style={{ fontSize: 20, marginBottom: 12 }}>🕐</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
                  Happy Hour is live on Base
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 16 }}>
                  Join the community. Check in daily. Be happy.
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <a href="https://x.com/mksl3" target="_blank" rel="noopener noreferrer" style={{
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 10, padding: '8px 18px', textDecoration: 'none',
                    fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.7)',
                  }}>𝕏 Twitter</a>
                  <a href="https://t.me/happyhourbased" target="_blank" rel="noopener noreferrer" style={{
                    background: 'rgba(0,82,255,0.15)', border: '1px solid rgba(0,82,255,0.3)',
                    borderRadius: 10, padding: '8px 18px', textDecoration: 'none',
                    fontSize: 13, fontWeight: 600, color: '#60a5fa',
                  }}>✈️ Telegram</a>
                </div>
              </div>
            </Section>

          </div>
        </div>
      </div>
    </div>
  )
}
