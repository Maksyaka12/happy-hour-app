// src/components/DocsSection.jsx
import React, { useState } from 'react'

const ARTICLES = [
  {
    id: 'overview',
    category: 'Getting Started',
    title: 'Overview & Core Loop',
    subtitle: 'Learn the core loop of Happy Hour on Base',
    content: (
      <div>
        <p>Welcome to <strong>Happy Hour</strong>, the ultimate on-chain social gaming hub built on the <strong>Base</strong> network. Happy Hour blends daily check-ins, puzzle boxes, high-stakes Player-vs-Player (PvP) raids, and weekly raffles into an immersive ecosystem where your activity translates directly into real rewards.</p>

        <div className="docs-alert docs-alert-info">
          <strong>ℹ️ Network Information</strong>
          <p>Happy Hour operates fully on the Base blockchain. All rewards, transactions, and leaderboard scores are processed on-chain. Make sure you have a small amount of Base ETH in your wallet to cover gas fees.</p>
        </div>

        <h3>The Core Gameplay Cycle</h3>
        <p>To maximize your rewards and climb to the top of the leaderboards, follow the daily gameplay loop:</p>
        <ol>
          <li><strong>Check-in Daily:</strong> Perform your check-in to claim free Keys and start your activity streak.</li>
          <li><strong>Unlock Happy Boxes:</strong> Spend your keys to open mystery boxes and win randomly distributed rewards: Health Points (HP), USDC, or Raffle Tickets.</li>
          <li><strong>PvP Raiding:</strong> Raid other players with 300+ HP to steal up to 5% of their HP balance.</li>
          <li><strong>Defend Your Stash:</strong> Buy a 24h Raid Shield to absolute-protect your HP from other players' raids.</li>
          <li><strong>Climb the Leaderboards:</strong> Climb the Seasonal USDC Leaderboard (based on activity points) and the Daily HP Leaderboard to earn direct USDC rewards.</li>
        </ol>

        <div className="docs-alert docs-alert-tip">
          <strong>💡 Pro Tip</strong>
          <p>Your daily activity streak is your most powerful multiplier. Checking in consecutive days significantly increases your activity points and keys received.</p>
        </div>
      </div>
    )
  },
  {
    id: 'faq',
    category: 'Getting Started',
    title: 'Frequently Asked Questions',
    subtitle: 'Quick answers to common questions',
    content: (
      <div>
        <h3>General FAQ</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
          <div>
            <strong style={{ display: 'block', color: '#0A0B0D', marginBottom: '4px' }}>Q: What is the goal of Happy Hour?</strong>
            <p>A: The goal is to accumulate Activity Points and HP to qualify for direct payouts. Payouts are made in USDC directly to your web3 wallet.</p>
          </div>
          <hr style={{ border: 'none', borderBottom: '1px solid #DEE1E7' }} />
          <div>
            <strong style={{ display: 'block', color: '#0A0B0D', marginBottom: '4px' }}>Q: Do I need real crypto to play?</strong>
            <p>A: Yes. While check-ins are free of charge, transactions occur on the Base network, which requires small gas fees (fractions of a cent) paid in Base ETH. Raids and shields also cost USDC.</p>
          </div>
          <hr style={{ border: 'none', borderBottom: '1px solid #DEE1E7' }} />
          <div>
            <strong style={{ display: 'block', color: '#0A0B0D', marginBottom: '4px' }}>Q: Can I get raided while offline?</strong>
            <p>A: Yes, other players can raid you at any time. To guarantee 100% safety, you should purchase a 24h Raid Shield.</p>
          </div>
          <hr style={{ border: 'none', borderBottom: '1px solid #DEE1E7' }} />
          <div>
            <strong style={{ display: 'block', color: '#0A0B0D', marginBottom: '4px' }}>Q: How are rewards paid out?</strong>
            <p>A: Payouts are automated via smart contracts and Supabase triggers. Daily HP rewards are distributed every 24 hours, and Seasonal USDC rewards are distributed at the end of each season.</p>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'boxes',
    category: 'Core Gameplay',
    title: 'Happy Boxes & Keys',
    subtitle: 'Daily check-ins, key rarities, and box rewards',
    content: (
      <div>
        <p>Happy Boxes represent the primary progression mechanic in Happy Hour. Inside each box lies a variety of randomized prizes that can boost your standings or pay out cash.</p>

        <h3>Obtaining Keys</h3>
        <p>Keys are the currency required to open Happy Boxes. You can obtain keys through:</p>
        <ul>
          <li><strong>Daily Check-in:</strong> Claiming your check-in rewards you with keys.</li>
          <li><strong>Streaks:</strong> Multi-day streaks reward you with additional and rarer keys.</li>
          <li><strong>Tasks:</strong> Special quests on the Tasks tab reward keys upon verification.</li>
        </ul>

        <h3>Key Rarities & Probabilities</h3>
        <p>Keys are categorized into three rarity tiers, determining the potential rewards of the box opened:</p>
        <table className="docs-table">
          <thead>
            <tr>
              <th>Key Rarity</th>
              <th>How to Get</th>
              <th>Box Rewards Tier</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Common (Gray)</strong></td>
              <td>Daily Check-in</td>
              <td>Standard HP and occasional tickets</td>
            </tr>
            <tr>
              <td><strong style={{ color: '#0052FF' }}>Rare (Blue)</strong></td>
              <td>3+ Day Streak / Hard Tasks</td>
              <td>Boosted HP, higher USDC odds, and more tickets</td>
            </tr>
            <tr>
              <td><strong style={{ color: '#8B5CF6' }}>Epic (Purple)</strong></td>
              <td>7+ Day Streak / Special Events</td>
              <td>Massive HP amounts, guaranteed USDC, or Raid Shields</td>
            </tr>
          </tbody>
        </table>

        <h3>Box Contents</h3>
        <p>When you spend a key to open a Happy Box, the rewards are instantly drawn from the smart contract:</p>
        <ul>
          <li><strong>Health Points (HP):</strong> Standard drops (typically 10 to 150 HP).</li>
          <li><strong>USDC Rewards:</strong> Cash amounts sent straight to your wallet balance.</li>
          <li><strong>Raffle Tickets:</strong> Automatic ticket entries into the active Weekly Raffle drawing.</li>
          <li><strong>Raid Shields:</strong> Instantly activates a 24-hour shield protection.</li>
        </ul>
      </div>
    )
  },
  {
    id: 'raids',
    category: 'Core Gameplay',
    title: 'Happy Raids & Shields',
    subtitle: 'Attacking other players, stealing HP, and defense mechanisms',
    content: (
      <div>
        <p>Happy Raids introduce competitive Player-vs-Player (PvP) mechanics. Raids allow active players to steal Health Points (HP) from others, shifting leaderboard rankings in real-time.</p>

        <h3>Raid Mechanics</h3>
        <ul>
          <li><strong>Target Eligibility:</strong> You can only raid players who currently hold <strong>300+ HP</strong> and are not protected by a Raid Shield.</li>
          <li><strong>USDC Cost:</strong> Performing a raid attempt costs <strong>0.25 USDC</strong>.</li>
          <li><strong>Success Chance:</strong> Raids have a baseline <strong>70% success chance</strong> (noted as 50% in banner estimates).</li>
          <li><strong>Raid Cooldown:</strong> To ensure fair play, there is a strict <strong>10-minute cooldown</strong> after each raid attempt.</li>
          <li><strong>Raid Stolen Amount:</strong> A successful raid steals a minimum of <strong>10 HP</strong> and up to <strong>5% of the target's current HP</strong>.</li>
        </ul>

        <div className="docs-alert docs-alert-warning">
          <strong>⚠️ Risk of Raiding</strong>
          <p>If you fail a raid, your USDC fee is consumed, but you do not steal any HP. Always target users with high HP balances to maximize your return on investment when successful!</p>
        </div>

        <h3>Raid Shield</h3>
        <p>The Raid Shield is your ultimate protection against other raiders. Once your HP grows past 300, you are visible on the target scanner and vulnerable to theft.</p>
        <ul>
          <li><strong>Cost:</strong> A Raid Shield costs <strong>0.15 USDC</strong>.</li>
          <li><strong>Duration:</strong> Provides <strong>absolute protection for 24 hours</strong>.</li>
          <li><strong>How it works:</strong> When you purchase a shield, your status becomes "Protected" and your profile is hidden from raid target sweeps. Any pending raid against you will fail automatically.</li>
        </ul>
      </div>
    )
  },
  {
    id: 'raffle',
    category: 'Core Gameplay',
    title: 'Happy Raffle & Tickets',
    subtitle: 'Raffle entries, drawings, and prizes',
    content: (
      <div>
        <p>The Happy Raffle is a periodic drawing where ticket holders compete for substantial cash prizes. The more tickets you hold, the higher your odds of winning.</p>

        <h3>Getting Raffle Tickets</h3>
        <p>Raffle tickets can be obtained in two ways:</p>
        <ol>
          <li><strong>Happy Boxes:</strong> Opening boxes has a high chance of dropping 1 to 5 raffle tickets.</li>
          <li><strong>Direct Purchase:</strong> You can buy tickets using USDC.</li>
        </ol>

        <h3>Draw Process & Prizes</h3>
        <ul>
          <li><strong>Automated Drawings:</strong> Draws occur at the end of each raffle cycle.</li>
          <li><strong>Winner Selection:</strong> The smart contract randomly selects winning ticket numbers.</li>
          <li><strong>Prizes:</strong> Direct USDC transfers to the winners' wallets.</li>
        </ul>

        <div className="docs-alert docs-alert-info">
          <strong>ℹ️ Raffle Integrity</strong>
          <p>All drawings are conducted transparently. Tickets are tied directly to your wallet address and recorded on the Base blockchain.</p>
        </div>
      </div>
    )
  },
  {
    id: 'points',
    category: 'System Mechanics',
    title: 'Activity Points & HP Formulae',
    subtitle: 'Understanding the scoring and formulas',
    content: (
      <div>
        <p>Happy Hour features two separate point systems: <strong>Activity Points</strong> and <strong>HP (Health Points)</strong>. Understanding how these are calculated is key to optimizing your strategy.</p>

        <h3>1. Activity Points (AP)</h3>
        <p>Activity Points measure your engagement in the ecosystem. These points dictate your position on the Seasonal USDC leaderboard.</p>
        
        <div style={{
          background: '#F8F9FC',
          border: '1px solid #DEE1E7',
          borderRadius: '12px',
          padding: '16px',
          fontFamily: "'DM Mono', monospace",
          fontSize: '12.5px',
          color: '#0A0B0D',
          marginBottom: '16px',
          lineHeight: '1.6'
        }}>
          <strong>Activity Formula:</strong>
          <br />
          AP = Daily Check-in + Tasks + In-App Transactions + Post Approval + Streak
        </div>

        <p>AP breakdown:</p>
        <ul>
          <li><strong>Daily Check-in:</strong> Baseline points awarded for logging in daily.</li>
          <li><strong>Tasks:</strong> Points earned for completing social actions (X follow, Telegram joins, etc.).</li>
          <li><strong>In-App Transactions:</strong> Points earned for making on-chain interactions (e.g. buying a box, raid, or shield).</li>
          <li><strong>Post Approval:</strong> Verified actions, including social share approvals.</li>
          <li><strong>Streak:</strong> Exponential points boost awarded for maintaining consecutive check-in days.</li>
        </ul>

        <h3>2. HP (Health Points)</h3>
        <p>Health Points represent your in-game "life" and determine your rank on the Daily HP Leaderboard. HP is fluid: it can be earned, won, stolen, or lost.</p>
        <ul>
          <li><strong>Earn HP:</strong> Complete specific Tasks or win HP inside Happy Boxes.</li>
          <li><strong>Steal HP (Raids):</strong> Conduct successful PvP raids to steal up to 5% of a target's HP.</li>
          <li><strong>Lose HP (Raids):</strong> Getting raided by other players reduces your HP by up to 5% (min 10 HP).</li>
        </ul>
      </div>
    )
  },
  {
    id: 'leaderboards',
    category: 'System Mechanics',
    title: 'USDC vs HP Leaderboards',
    subtitle: 'Climbing the rankings to claim prizes',
    content: (
      <div>
        <p>Happy Hour maintains two distinct leaderboards, offering two parallel ways to earn rewards. Both pay rewards directly in USDC.</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', margin: '16px 0' }}>
          <div style={{ background: '#FFF', border: '1px solid #DEE1E7', borderRadius: '14px', padding: '16px' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#0052FF', fontSize: '14px', margin: '0 0 8px' }}>
              🏆 Seasonal USDC Leaderboard
            </h4>
            <p style={{ fontSize: '11.5px', color: '#717886', lineHeight: '1.4' }}>
              Ranks players based on total cumulative <strong>Activity Points (AP)</strong>. Payouts are distributed at the end of the Season to top performers. Rewards consistency and daily interaction.
            </p>
          </div>
          <div style={{ background: '#FFF', border: '1px solid #DEE1E7', borderRadius: '14px', padding: '16px' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#10B981', fontSize: '14px', margin: '0 0 8px' }}>
              ⚡ Daily HP Leaderboard
            </h4>
            <p style={{ fontSize: '11.5px', color: '#717886', lineHeight: '1.4' }}>
              Ranks players based on their current <strong>HP balance</strong> at the daily snapshot. Rewards are paid out every 24 hours. Rewards aggressive raiding and proper shield defense.
            </p>
          </div>
        </div>

        <h3>Payout Distribution</h3>
        <p>Leaderboard prizes are distributed directly to the wallet associated with your profile. All payouts are automatically transferred in USDC on Base.</p>
      </div>
    )
  },
  {
    id: 'token',
    category: 'Economy & Security',
    title: 'Token Status & Information',
    subtitle: 'Official updates regarding tokenomics and tokens',
    content: (
      <div>
        <div className="docs-alert docs-alert-warning">
          <strong>⚠️ Security Warning</strong>
          <p>There is currently <strong>NO official token</strong> for the Happy Hour App. Anyone offering, selling, or airdropping a "Happy Hour" or "Happy" token is a scammer. Do not sign transactions or approve contracts from untrusted sites.</p>
        </div>

        <h3>Our Stance on Tokens</h3>
        <p>The Happy Hour team is actively researching sustainable tokenomics models and decentralized network designs for future expansions. If a token is introduced, it will be designed to align incentives, reward users, and support the ecosystem.</p>
        
        <h3>Official Channels</h3>
        <p>Any official updates regarding token launch, airdrops, or contract addresses will ONLY be announced via our official platforms:</p>
        <ul>
          <li><strong>X (Twitter):</strong> <a href="https://x.com/happyhour_base" target="_blank" rel="noopener noreferrer">@happyhour_base</a></li>
          <li><strong>Telegram:</strong> <a href="https://t.me/happyhourapp" target="_blank" rel="noopener noreferrer">t.me/happyhourapp</a></li>
        </ul>
      </div>
    )
  },
  {
    id: 'strategies',
    category: 'Economy & Security',
    title: 'Top Strategies for Success',
    subtitle: 'How to maximize rewards and dominate the leaderboards',
    content: (
      <div>
        <p>To help you climb the leaderboards and claim the highest USDC rewards, here are the top strategies used by top Happy Hour players:</p>

        <h3>1. The 300+ HP Shield Rule</h3>
        <p>As soon as your HP balance exceeds 300 HP, you become targetable by other players. A single raid can steal up to 5% of your balance. If you hold a high rank on the HP leaderboard, <strong>always buy a Raid Shield for 0.15 USDC</strong> to lock in your daily rewards.</p>

        <h3>2. Maintaining your Streak</h3>
        <p>Streaks multiply your daily activity points. Missing even a single check-in day resets your streak multiplier. Set a reminder to check in at the same time every day.</p>

        <h3>3. Focus on High-HP Targets</h3>
        <p>Since raids steal a percentage of the target's HP (up to 5%), raiding a target with 1000 HP yields 50 HP on success, whereas a target with 300 HP yields only 15 HP. Use the target sweeps to find high-HP players who forgot to shield.</p>

        <h3>4. Complete All Tasks</h3>
        <p>Complete new tasks immediately. They provide both key boosts and activity point injections that jump-start your position on the Seasonal Leaderboard.</p>
      </div>
    )
  }
]

export function DocsSection() {
  const [activeArticle, setActiveArticle] = useState('overview')
  const [mobileView, setMobileView] = useState('list') // 'list' or 'article'
  const [searchQuery, setSearchQuery] = useState('')

  // Group articles by category
  const categories = {}
  ARTICLES.forEach(art => {
    if (!categories[art.category]) {
      categories[art.category] = []
    }
    // Apply search filter if present
    if (!searchQuery || 
        art.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
        art.subtitle.toLowerCase().includes(searchQuery.toLowerCase())) {
      categories[art.category].push(art)
    }
  })

  const selectedArticle = ARTICLES.find(art => art.id === activeArticle) || ARTICLES[0]

  const handleSelectArticle = (id) => {
    setActiveArticle(id)
    setMobileView('article')
  }

  return (
    <div className="docs-root" style={{
      maxWidth: 1024,
      margin: '0 auto',
      padding: '0 16px 120px',
      color: '#0A0B0D',
      fontFamily: "'Outfit', 'Inter', sans-serif",
      animation: 'docsFadeIn 0.4s ease'
    }}>
      <style>{`
        @keyframes docsFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .docs-container {
          display: flex;
          background: #ffffff;
          border: 1px solid #DEE1E7;
          borderRadius: 20px;
          boxShadow: 0 4px 20px rgba(10,11,13,0.02);
          overflow: hidden;
          margin-top: 16px;
          min-height: 520px;
        }
        .docs-sidebar {
          width: 240px;
          border-right: 1px solid #DEE1E7;
          background: #F8F9FC;
          padding: 20px 16px;
          flex-shrink: 0;
        }
        .docs-content {
          flex: 1;
          padding: 32px 40px;
          min-width: 0;
          overflow-y: auto;
        }
        .docs-category-title {
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          color: #717886;
          letter-spacing: 0.8px;
          margin: 16px 0 8px;
          padding-left: 8px;
        }
        .docs-article-btn {
          width: 100%;
          text-align: left;
          background: transparent;
          border: none;
          padding: 8px 12px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 600;
          color: #32353D;
          cursor: pointer;
          transition: all 0.2s;
          margin-bottom: 2px;
        }
        .docs-article-btn:hover {
          background: rgba(0, 82, 255, 0.05);
          color: #0052FF;
        }
        .docs-article-btn.active {
          background: rgba(0, 82, 255, 0.1);
          color: #0052FF;
          font-weight: 750;
        }
        .docs-alert {
          border-left: 4px solid;
          border-radius: 6px;
          padding: 12px 16px;
          margin: 20px 0;
          font-size: 12px;
          line-height: 1.5;
        }
        .docs-alert strong {
          display: block;
          margin-bottom: 4px;
        }
        .docs-alert p {
          margin: 0;
        }
        .docs-alert-info {
          background: #F0F5FF;
          border-color: #0052FF;
          color: #1E3A8A;
        }
        .docs-alert-tip {
          background: #ECFDF5;
          border-color: #10B981;
          color: #065F46;
        }
        .docs-alert-warning {
          background: #FFF1F2;
          border-color: #FC401F;
          color: #9F1239;
        }
        .docs-table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
          font-size: 11.5px;
          text-align: left;
        }
        .docs-table th, .docs-table td {
          padding: 10px 12px;
          border-bottom: 1px solid #DEE1E7;
        }
        .docs-table th {
          background: #F8F9FC;
          color: #717886;
          font-weight: 700;
        }
        .docs-content h3 {
          font-size: 16px;
          font-weight: 800;
          color: #0A0B0D;
          margin: 24px 0 10px;
          letter-spacing: -0.3px;
        }
        .docs-content p {
          font-size: 13px;
          line-height: 1.6;
          color: #32353D;
          margin: 0 0 14px;
        }
        .docs-content ul, .docs-content ol {
          margin: 0 0 16px;
          padding-left: 20px;
          font-size: 13px;
          line-height: 1.6;
          color: #32353D;
        }
        .docs-content li {
          margin-bottom: 6px;
        }
        .docs-search {
          width: 100%;
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid #DEE1E7;
          background: #FFF;
          font-size: 12px;
          font-family: inherit;
          margin-bottom: 12px;
          outline: none;
          transition: border-color 0.2s;
        }
        .docs-search:focus {
          border-color: #0052FF;
        }
        @media (max-width: 768px) {
          .docs-container {
            border: none;
            background: transparent;
            box-shadow: none;
            margin-top: 8px;
            min-height: auto;
          }
          .docs-sidebar {
            display: ${mobileView === 'list' ? 'block' : 'none'};
            width: 100%;
            border: 1px solid #DEE1E7;
            border-radius: 20px;
            background: #ffffff;
            box-shadow: 0 4px 20px rgba(10,11,13,0.02);
          }
          .docs-content {
            display: ${mobileView === 'article' ? 'block' : 'none'};
            width: 100%;
            padding: 20px 16px;
            background: #ffffff;
            border: 1px solid #DEE1E7;
            border-radius: 20px;
            box-shadow: 0 4px 20px rgba(10,11,13,0.02);
          }
        }
        @media (min-width: 769px) {
          .docs-sidebar {
            display: block !important;
          }
          .docs-content {
            display: block !important;
          }
        }
      `}</style>

      {/* Docs Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #0052FF 0%, #1D4ED8 100%)',
        borderRadius: 24,
        padding: '24px 20px',
        color: '#ffffff',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,82,255,0.15)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        marginTop: 12
      }}>
        {/* Floating tech background elements */}
        <div style={{ position: 'absolute', top: '-10%', right: '-5%', width: 140, height: 140, background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '-20%', left: '10%', width: 120, height: 120, background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%)', pointerEvents: 'none' }} />
        
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 4px', letterSpacing: '-0.5px' }}>
            Base Docs System
          </h2>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', margin: 0, fontWeight: 500 }}>
            Official documentation for Happy Hour features, game mechanics, and rewards.
          </p>
        </div>
      </div>

      <div className="docs-container">
        {/* SIDEBAR NAVIGATION */}
        <div className="docs-sidebar">
          {/* Search input */}
          <input
            type="text"
            className="docs-search"
            placeholder="Search docs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          {Object.keys(categories).map(catName => {
            const list = categories[catName]
            if (list.length === 0) return null
            return (
              <div key={catName}>
                <div className="docs-category-title">{catName}</div>
                {list.map(art => (
                  <button
                    key={art.id}
                    onClick={() => handleSelectArticle(art.id)}
                    className={`docs-article-btn ${activeArticle === art.id ? 'active' : ''}`}
                  >
                    {art.title}
                  </button>
                ))}
              </div>
            )
          })}
        </div>

        {/* CONTENT VIEW */}
        <div className="docs-content">
          {/* Mobile Back Button */}
          {mobileView === 'article' && (
            <button
              onClick={() => setMobileView('list')}
              style={{
                display: 'none', // Hidden on desktop via CSS, styled block on mobile
                background: '#EEF0F3',
                border: '1px solid #DEE1E7',
                borderRadius: 12,
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 700,
                color: '#32353D',
                cursor: 'pointer',
                marginBottom: 16,
                alignItems: 'center',
                gap: 4
              }}
              className="docs-mobile-back-btn"
            >
              ← Back to articles
            </button>
          )}

          {/* Inject style for mobile back button */}
          <style>{`
            @media (max-width: 768px) {
              .docs-mobile-back-btn {
                display: inline-flex !important;
              }
            }
          `}</style>

          {/* Selected Article Body */}
          {selectedArticle ? (
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 900, color: '#0A0B0D', margin: '0 0 4px', letterSpacing: '-0.5px' }}>
                {selectedArticle.title}
              </h1>
              <p style={{ fontSize: 12.5, color: '#717886', margin: '0 0 20px', fontWeight: 500 }}>
                {selectedArticle.subtitle}
              </p>
              <hr style={{ border: 'none', borderBottom: '1px solid #DEE1E7', marginBottom: 20 }} />
              <div className="docs-article-body">
                {selectedArticle.content}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#717886', paddingTop: 40 }}>
              Select an article to view details
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
