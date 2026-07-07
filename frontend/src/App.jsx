import { useEffect, useMemo, useState } from 'react'
import { useAccount, useReadContract, useSwitchChain } from 'wagmi'
import { base } from 'wagmi/chains'
import { formatUnits } from 'viem'
import { db } from './config/supabase'
import { useBasename } from './hooks/useBasename'
import { ConnectScreen } from './components/ConnectScreen'
import { RaffleSection } from './components/RaffleSection'
import { EarnSection } from './components/EarnSection'
import { ContestsSection } from './components/ContestsSection'
import { ProfileSection } from './components/ProfileSection'
import { AccountSection } from './components/AccountSection'
import { BottomNav } from './components/BottomNav'
import { HappyHourLogo } from './components/HappyHourLogo'
import { HappyBotChat } from './components/HappyBotChat'
import { CSS } from './styles'
import { HAS_SUPABASE_CONFIG, USDC_ADDRESS, USDC_ABI, MEMBERSHIP_ADDRESS, MEMBERSHIP_ABI, HH_ADDRESS, HH_ABI, COORDINATOR_ADDRESS, COORDINATOR_ABI } from './config/constants'
import { WalletConnectModal } from './components/WalletConnectModal'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { DailyRaffleSection } from './components/DailyRaffleSection'

const short = (a) => (a ? `${a.slice(0, 6)}\u2026${a.slice(-4)}` : '\u2014')

const formatConcise = (num) => {
  const n = parseFloat(num || 0)
  if (n >= 1e9) {
    const val = (n / 1e9).toFixed(2)
    return val.endsWith('.00') ? val.slice(0, -3) + 'b' : val.endsWith('0') ? val.slice(0, -1) + 'b' : val + 'b'
  }
  if (n >= 1e6) {
    const val = (n / 1e6).toFixed(2)
    return val.endsWith('.00') ? val.slice(0, -3) + 'm' : val.endsWith('0') ? val.slice(0, -1) + 'm' : val + 'm'
  }
  if (n >= 1e3) {
    const val = (n / 1e3).toFixed(2)
    return val.endsWith('.00') ? val.slice(0, -3) + 'k' : val.endsWith('0') ? val.slice(0, -1) + 'k' : val + 'k'
  }
  return n.toFixed(2).replace(/\.00$/, '')
}

function getReferralCode() {
  const ref = new URLSearchParams(window.location.search).get('ref')?.trim()
  return ref || null
}

const URL_TO_TAB = {
  '': 'raffle',
  '/': 'raffle',
  '/profile': 'home',
  '/hourly-lottery': 'raffle',
  '/daily-lottery': 'dailyRaffle',
  '/staking': 'earn',
  '/campaigns': 'contests',
  '/account': 'account',
  '/terms': 'terms',
  '/affiliate': 'affiliate',
  '/privacy': 'privacy',
  '/skills': 'skills',
  '/x402': 'x402',
  '/agent-chat': 'agentChat'
}

const TAB_TO_URL = Object.fromEntries(Object.entries(URL_TO_TAB).map(([k, v]) => [v, k]))
TAB_TO_URL['home'] = '/profile'
TAB_TO_URL['raffle'] = '/hourly-lottery'
TAB_TO_URL['dailyRaffle'] = '/daily-lottery'
TAB_TO_URL['earn'] = '/staking'
TAB_TO_URL['contests'] = '/campaigns'
TAB_TO_URL['account'] = '/account'
TAB_TO_URL['terms'] = '/terms'
TAB_TO_URL['affiliate'] = '/affiliate'
TAB_TO_URL['privacy'] = '/privacy'
TAB_TO_URL['skills'] = '/skills'
TAB_TO_URL['x402'] = '/x402'
TAB_TO_URL['agentChat'] = '/agent-chat'

function useAppRouter() {
  const [tab, setTabState] = useState(() => {
    try {
      const path = window.location.pathname
      const initialTab = URL_TO_TAB[path]
      if (initialTab) return initialTab

      let saved = localStorage.getItem('happy_tab') || 'raffle'
      if (saved === 'profile') saved = 'home'
      if (saved === 'staking' || saved === 'raid') saved = 'earn'
      if (['tasks', 'leaderboard', 'boxes'].includes(saved)) saved = 'raffle'
      return saved
    } catch { return 'raffle' }
  })

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname
      if (URL_TO_TAB[path]) {
        setTabState(URL_TO_TAB[path])
      }
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const setTab = (newTab) => {
    setTabState(newTab)
    try { localStorage.setItem('happy_tab', newTab) } catch { }
    const newUrl = TAB_TO_URL[newTab] || '/'
    if (window.location.pathname !== newUrl) {
      window.history.pushState({}, '', newUrl)
    }
  }

  return [tab, setTab]
}

export default function App({ onLogin }) {
  const isMiniapp = useMemo(() => {
    if (typeof window === 'undefined') return false
    const params = new URLSearchParams(window.location.search)
    if (params.get('platform') === 'base' || params.get('miniapp') === 'true') {
      return true
    }
    try {
      if (window.self !== window.top) return true
    } catch (e) {
      return true
    }
    return false
  }, [])

  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false)
  const handleRequireWallet = () => {
    if (onLogin) {
      onLogin()
    } else {
      setIsConnectModalOpen(true)
    }
  }

  const [tab, setTab] = useAppRouter()
  const [caCopied, setCaCopied] = useState(false)
  const [initialContest, setInitialContest] = useState(null)

  // useAccount().chainId returns the REAL wallet chain (even if unsupported)
  // useChainId() returns base.id by default when chain is not in wagmi config — can't use it here
  const { address, isConnected, isConnecting, isReconnecting, chainId: accountChainId } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const basename = useBasename(address)
  const onWrongChain = isConnected && !!accountChainId && accountChainId !== base.id

  const { data: hhBalanceRaw } = useReadContract({
    address: HH_ADDRESS,
    abi: HH_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 }
  })
  const hhBalanceRawParsed = hhBalanceRaw !== undefined ? parseFloat(formatUnits(hhBalanceRaw, 18)) : 0
  const hhBalanceStr = formatConcise(hhBalanceRawParsed)

  const { data: summary } = useReadContract({
    address: COORDINATOR_ADDRESS,
    abi: COORDINATOR_ABI,
    functionName: 'getUserSummary',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 }
  })
  
  const [simulatedSummary] = useState({ hp: 1250, streak: 5 })

  const hpBalance = summary ? Number(summary[0]) : simulatedSummary.hp
  const streakCount = summary ? Number(summary[1]) : simulatedSummary.streak

  const referralCode = useMemo(() => getReferralCode(), [])

  const { data: isClubMemberRaw } = useReadContract({
    address: MEMBERSHIP_ADDRESS,
    abi: MEMBERSHIP_ABI,
    functionName: 'isMember',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15000 }
  })

  const [simulatedMember, setSimulatedMember] = useState(() => {
    try {
      return localStorage.getItem('hh_simulated_member') === 'true'
    } catch { return false }
  })

  // Keep simulatedMember synced with localStorage changes
  useEffect(() => {
    const checkSim = () => {
      try {
        const val = localStorage.getItem('hh_simulated_member') === 'true'
        setSimulatedMember(val)
      } catch {}
    }
    const interval = setInterval(checkSim, 2000)
    return () => clearInterval(interval)
  }, [])

  const isClubMember = isClubMemberRaw !== undefined ? isClubMemberRaw : simulatedMember

  const tabLabels = {
    home: 'Profile',
    raffle: 'Happy Raffle',
    earn: 'Staking',
    contests: 'Campaigns',
  }

  useEffect(() => {
    if (!isConnected || !address) return

    db.rpc('sync_user_profile', {
      p_address: address.toLowerCase(),
      p_basename: basename ?? null,
      p_ref_code: referralCode,
    }).then(({ error }) => {
      if (error) console.error('sync_user_profile:', error)
    })
  }, [isConnected, address, basename, referralCode])

  const [totalUsers, setTotalUsers] = useState(0)
  const isAdmin = address && atob('MHg0YzkxZDNiZWQzNzJjMTE3OTViOWNlOWE5MDE3ZGZlNDQ3YmYwNTBh') === address.toLowerCase()

  useEffect(() => {
    if (!isAdmin) return
    const fetchTotal = async () => {
      const { count } = await db.from('users').select('*', { count: 'exact', head: true })
      setTotalUsers(count || 0)
    }
    fetchTotal()
    const sub = db.channel(`admin-stats-${Date.now()}`).on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, fetchTotal).subscribe()
    return () => { db.removeChannel(sub) }
  }, [address, isAdmin])

  if (isConnecting || isReconnecting) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F9FC' }}>
          <div style={{ textAlign: 'center' }}>
            <HappyHourLogo size={48} />
            <div style={{ marginTop: 16, fontSize: 14, color: '#717886' }}>
              {isReconnecting ? 'Reconnecting…' : 'Connecting…'}
            </div>
          </div>
        </div>
      </>
    )
  }

  if (!isConnected && isMiniapp) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <ConnectScreen />
      </>
    )
  }

  if (!HAS_SUPABASE_CONFIG) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ minHeight: '100vh', background: '#F8F9FC', padding: '24px 16px' }}>
          <div style={{ maxWidth: 560, margin: '0 auto', paddingTop: 72 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <HappyHourLogo size={40} />
              <div style={{ fontSize: 28, fontWeight: 900, color: '#0A0B0D' }}>happy hour <span style={{ color: '#0052FF' }}>based</span></div>
            </div>
            <div style={{ background: '#fff', border: '1px solid #DEE1E7', borderLeft: '4px solid #FC401F', borderRadius: 18, padding: 20, boxShadow: '0 6px 24px rgba(10,11,13,0.06)' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0A0B0D', marginBottom: 8 }}>
                App setup is incomplete
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.7, color: '#717886', marginBottom: 14 }}>
                This deployment is missing Supabase frontend environment variables, so the app cannot load live data yet.
              </div>
              <div style={{ background: '#EEF0F3', borderRadius: 12, padding: 14, fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#32353D', lineHeight: 1.8 }}>
                VITE_SUPABASE_URL
                <br />
                VITE_SUPABASE_ANON
                <br />
                VITE_FOUNDATION_ADDRESS
                <br />
                VITE_BUILDER_CODE
                <br />
                VITE_APP_URL
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  const displayName = basename || short(address)

  // Maintenance Mode Toggle
  const IS_MAINTENANCE_MODE = false;

  if (IS_MAINTENANCE_MODE && !isAdmin) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F8F9FC', padding: 24 }}>
          <HappyHourLogo size={64} />
          <h1 style={{ marginTop: 24, fontSize: 28, fontWeight: 900, color: '#0A0B0D', textAlign: 'center', letterSpacing: '-0.5px' }}>
            System Debugging & Maintenance
          </h1>
          <p style={{ marginTop: 16, fontSize: 16, color: '#717886', textAlign: 'center', maxWidth: 455, lineHeight: 1.6 }}>
            We are currently conducting a debugging process and system maintenance.<br /><br />
            The app will be back online shortly. Thank you for your patience! 🛠️✨
          </p>
        </div>
      </>
    )
  }

  const renderTabContent = () => {
    switch (tab) {
      case 'home':
        return <ProfileSection address={address} basename={basename} totalUsers={totalUsers} setTab={setTab} onRequireWallet={handleRequireWallet} />
      case 'raffle':
        return <RaffleSection address={address} basename={basename} onRequireWallet={handleRequireWallet} />
      case 'dailyRaffle':
        return <DailyRaffleSection address={address} basename={basename} onRequireWallet={handleRequireWallet} />
      case 'earn':
        return <EarnSection setTab={setTab} address={address} onRequireWallet={handleRequireWallet} />
      case 'contests':
        return (
          <ContestsSection 
            setTab={setTab} 
            address={address} 
            initialContest={initialContest} 
            onClearInitialContest={() => setInitialContest(null)} 
            onRequireWallet={handleRequireWallet}
          />
        )
      case 'account':
        return <AccountSection address={address} onRequireWallet={handleRequireWallet} />
      case 'terms':
        return (
          <div style={{
            width: '100%',
            maxWidth: 1200,
            margin: '0 auto',
            padding: '40px 24px',
            fontFamily: "'Inter', sans-serif",
            color: '#94A3B8',
            lineHeight: 1.6,
            fontSize: 15
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40, flexWrap: 'wrap', gap: 16 }}>
              <h1 style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 600, margin: 0 }}>Terms of Service for Happy Hour</h1>
              <p style={{ fontSize: 14, margin: 0 }}>Last Updated: July 2026</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
              <section>
                <h2 style={{ color: '#FFFFFF', fontSize: 16, marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. Acceptance of Terms</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p>By accessing or using the Happy Hour Platform, website, smart contracts, AI agents (including @happyhourbot), or any related services (collectively, the "Services"), you agree to be bound by these Terms of Service. If you do not agree to all the terms and conditions, you may not access or use the Services.</p>
                  <p>The Services are operated by Happy Hour ("Company", "we", "us", or "our"). We reserve the right to modify these terms at any time at our sole discretion. Your continued use of the Services following the posting of revised Terms means that you accept and agree to the changes.</p>
                </div>
              </section>

              <section>
                <h2 style={{ color: '#FFFFFF', fontSize: 16, marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>2. Description of Services</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p>Happy Hour is an AI-powered consumer platform and decentralized finance ecosystem that allows users to interact with smart contracts on the blockchain. Core features include:</p>
                  <ul style={{ listStyleType: 'disc', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <li><strong style={{ color: '#E2E8F0' }}>Staking & Yield:</strong> Depositing $HH tokens into smart contracts to earn yields and platform rewards such as Happy Points (HP).</li>
                    <li><strong style={{ color: '#E2E8F0' }}>Lotteries & Raffles:</strong> Participating in Hourly and Big Daily Lotteries using verifiable on-chain randomness (e.g., Chainlink VRF).</li>
                    <li><strong style={{ color: '#E2E8F0' }}>AI Agents:</strong> Utilizing conversational interfaces to perform on-chain interactions, execute trades, and manage portfolios.</li>
                    <li><strong style={{ color: '#E2E8F0' }}>Happy Club:</strong> An exclusive membership offering enhanced agent capabilities and automation.</li>
                  </ul>
                  <p>We do not have control over the decentralized blockchain networks. All transactions are executed via unhosted, self-custodial wallets. You are solely responsible for managing your private keys and securing your assets.</p>
                </div>
              </section>

              <section>
                <h2 style={{ color: '#FFFFFF', fontSize: 16, marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>3. Eligibility and Compliance</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p>You must be at least 18 years old and possess the legal capacity to form a binding contract to use the Services. By accessing the Services, you represent and warrant that you are not on any trade or economic sanctions lists, such as the UN Security Council Sanctions list, nor restricted by the Office of Foreign Assets Control (OFAC).</p>
                  <p>The Services may not be available or appropriate for use in all jurisdictions. By accessing or using the Services, you agree that you are solely and entirely responsible for compliance with all laws and regulations that may apply to you.</p>
                </div>
              </section>

              <section>
                <h2 style={{ color: '#FFFFFF', fontSize: 16, marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>4. AI Agents and Automation Risks</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p>The Happy Hour AI Agents are experimental technologies designed to interpret your conversational inputs and execute on-chain instructions. You acknowledge that AI systems may misinterpret commands, hallucinate, or produce unexpected results.</p>
                  <p>You assume full responsibility for all transactions authorized through the AI agent interface. We strongly advise carefully reviewing all transaction prompts before confirming them in your wallet. The Company is not acting as an investment advisor, and no communication from the AI agents should be construed as financial advice.</p>
                </div>
              </section>

              <section>
                <h2 style={{ color: '#FFFFFF', fontSize: 16, marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>5. Assumption of Risk</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p>By interacting with the Services, you acknowledge and agree that:</p>
                  <ul style={{ listStyleType: 'disc', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <li>Cryptographic assets are highly volatile and subject to significant price fluctuations.</li>
                    <li>Smart contracts are subject to bugs, vulnerabilities, and potential exploits which could result in a total loss of your assets.</li>
                    <li>The regulatory environment for cryptographic technologies is uncertain, and new regulations could negatively impact the Services.</li>
                    <li>You are solely responsible for determining the tax implications of your interactions with the Services.</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 style={{ color: '#FFFFFF', fontSize: 16, marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>6. Limitation of Liability</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT SHALL THE COMPANY, ITS AFFILIATES, OR PERSONNEL BE LIABLE FOR ANY DIRECT, INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER INCLUDING, WITHOUT LIMITATION, DAMAGES FOR LOSS OF USE, DATA, OR CRYPTO ASSETS, ARISING OUT OF OR IN ANY WAY CONNECTED WITH THE USE OR PERFORMANCE OF THE SERVICES.</p>
                </div>
              </section>

              <section>
                <h2 style={{ color: '#FFFFFF', fontSize: 16, marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>7. Intellectual Property</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p>All content, features, and functionality provided via the Services, including but not limited to the Happy Hour logo, design, text, graphics, and underlying code, are the exclusive property of the Company and are protected by international copyright, trademark, and other intellectual property laws.</p>
                </div>
              </section>

              <section>
                <h2 style={{ color: '#FFFFFF', fontSize: 16, marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>8. Governing Law</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p>These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which the Company is incorporated, without giving effect to any principles of conflicts of law. Any dispute arising from these Terms shall be resolved exclusively in the competent courts of that jurisdiction.</p>
                </div>
              </section>
            </div>
          </div>
        )
      case 'privacy':
        return (
          <div style={{
            width: '100%',
            maxWidth: 1200,
            margin: '0 auto',
            padding: '40px 24px',
            fontFamily: "'Inter', sans-serif",
            color: '#94A3B8',
            lineHeight: 1.6,
            fontSize: 15
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40, flexWrap: 'wrap', gap: 16 }}>
              <h1 style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 600, margin: 0 }}>Privacy Policy for Happy Hour</h1>
              <p style={{ fontSize: 14, margin: 0 }}>Last Updated: July 2026</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
              <section>
                <h2 style={{ color: '#FFFFFF', fontSize: 16, marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. Introduction</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p>Happy Hour ("Company", "we", "us", or "our") is committed to protecting the privacy of its users. This Privacy Policy describes how we collect, use, store, and disclose information from users ("you") when you access our Platform, smart contracts, social channels, or interact with our AI agents (such as @happyhourbot and the in-app Happy Bot).</p>
                  <p>By connecting your wallet and interacting with the Services, you consent to the data collection and processing activities described in this Policy.</p>
                </div>
              </section>

              <section>
                <h2 style={{ color: '#FFFFFF', fontSize: 16, marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>2. Information We Collect</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p>Unlike traditional web applications, we do not require you to provide personal details such as your legal name, email address, physical address, or phone number. However, we collect certain identifiers to provide the Services:</p>
                  <ul style={{ listStyleType: 'disc', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <li><strong style={{ color: '#E2E8F0' }}>Blockchain Addresses & Wallet Data:</strong> We collect and store your public blockchain address (wallet address) which acts as your primary user identifier. We index public transaction histories related to our smart contracts (staking, lottery tickets, HP check-ins) to compute your badge rewards (e.g. Happy Holder, Happy Staker).</li>
                    <li><strong style={{ color: '#E2E8F0' }}>Social Media & Profile Linking:</strong> If you link your X (formerly Twitter) or Telegram account to your wallet address to use @happyhourbot, we store the mapping of your handle to your wallet address, along with authentication status.</li>
                    <li><strong style={{ color: '#E2E8F0' }}>Conversational Interactions & Chat Logs:</strong> We log inputs and queries sent to the in-app Happy Bot and @happyhourbot. This data is used to analyze queries, execute on-chain instructions, and improve the AI agent's responsiveness.</li>
                    <li><strong style={{ color: '#E2E8F0' }}>Usage & System Metrics:</strong> We log usage events (such as query counts per day, active check-in streaks) in our database to manage platform limits, track bot query quotas (5 free queries/day vs. unlimited for Happy Club members), and prevent spam/DDoS activities.</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 style={{ color: '#FFFFFF', fontSize: 16, marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>3. How We Use Your Information</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p>We use the collected information for the following business purposes:</p>
                  <ul style={{ listStyleType: 'disc', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <li>To provide, operate, and maintain the Happy Hour Platform, including the Hourly and Daily Raffle prize distributions.</li>
                    <li>To authenticate your wallet and social accounts for bot command execution (e.g. automating a raffle deposit or staking via Twitter DM).</li>
                    <li>To monitor and calculate user performance rankings, check-in streaks, badges, and Happy Points (HP).</li>
                    <li>To enforce our daily usage policies, query counts, and premium Happy Club memberships.</li>
                    <li>To identify, debug, and patch errors on our web interface and database services.</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 style={{ color: '#FFFFFF', fontSize: 16, marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>4. Blockchain Data Transparency</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p>Please note that any transactions or actions initiated on-chain via our smart contracts (such as staking tokens or buying lottery tickets) are permanently recorded on public ledger systems. This data is public, immutable, and accessible to anyone. We cannot delete or modify data stored on public blockchain networks.</p>
                </div>
              </section>

              <section>
                <h2 style={{ color: '#FFFFFF', fontSize: 16, marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>5. Third-Party Integrations</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p>We work with third-party service providers to power key features of our infrastructure. These include:</p>
                  <ul style={{ listStyleType: 'disc', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <li><strong style={{ color: '#E2E8F0' }}>Supabase:</strong> For off-chain database hosting, linked social handle records, query counters, and automation configurations.</li>
                    <li><strong style={{ color: '#E2E8F0' }}>Chainlink VRF:</strong> For verifiable, cryptographically secure randomness in daily draws.</li>
                    <li><strong style={{ color: '#E2E8F0' }}>Wallet Providers:</strong> Self-custodial connection kits (such as Privy) to handle secure logins.</li>
                  </ul>
                </div>
              </section>

              <section>
                <h2 style={{ color: '#FFFFFF', fontSize: 16, marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>6. Data Security</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p>We implement industry-standard database security measures to protect your off-chain profile data. Because we are a decentralized platform, we never collect, store, or have access to your wallet's private keys or recovery phrases. You are solely responsible for keeping your credentials and private keys secure.</p>
                </div>
              </section>

              <section>
                <h2 style={{ color: '#FFFFFF', fontSize: 16, marginBottom: 16, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>7. Your Privacy Rights</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <p>Depending on your jurisdiction (such as the EEA under GDPR or California under CCPA), you may have the right to request access to, deletion of, or restriction of our processing of your off-chain data (such as your linked X account or query history). Since we do not store names or emails, we verify request ownership solely by having you sign a cryptographically secure message with the wallet address linked to the data.</p>
                  <p>To request data deletion or exercise your rights, please submit a request to support@happyhour-based.app.</p>
                </div>
              </section>
            </div>
          </div>
        )
      case 'affiliate':
        return (
          <div style={{
            width: '100%',
            maxWidth: 1200,
            margin: '0 auto',
            padding: '60px 24px',
            fontFamily: "'Inter', sans-serif",
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <h1 style={{
              fontSize: 48,
              fontWeight: 700,
              color: '#FFFFFF',
              marginBottom: 16,
              letterSpacing: '-0.02em',
              fontFamily: "'Inter', sans-serif"
            }}>Become a part of the Happy Hour Team</h1>
            
            <p style={{
              fontSize: 16,
              color: '#94A3B8',
              lineHeight: 1.6,
              maxWidth: 600,
              marginBottom: 32,
              marginInline: 'auto'
            }}>
              We are looking for passionate individuals committed to the long-term growth of the Happy Hour project and our native $HH token, aligning with our vision.
            </p>

            <button style={{
              background: '#3B82F6',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: 8,
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'default',
              fontFamily: "'Inter', sans-serif",
              marginBottom: 56,
              transition: 'none'
            }}>
              Open Roles
            </button>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: 24,
              width: '100%',
              textAlign: 'left'
            }}>
              {/* Card 1: Community Managers */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: 12,
                padding: 24,
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#3B82F6',
                  flexShrink: 0
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: '#FFFFFF', margin: 0 }}>Community Managers</h3>
                  <p style={{ fontSize: 14, color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                    Moderate and cultivate active, healthy communities on X (Twitter) and Telegram. Host discussions, address user inquiries, guide newcomers, and maintain a highly engaged, positive environment.
                  </p>
                </div>
              </div>

              {/* Card 2: Social Media Managers */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: 12,
                padding: 24,
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#3B82F6',
                  flexShrink: 0
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9"></path>
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: '#FFFFFF', margin: 0 }}>Social Media Managers</h3>
                  <p style={{ fontSize: 14, color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                    Curate high-quality content and maintain a consistent project voice. Publish updates, highlight product announcements, write detailed guides/articles, and run campaigns to acquire new users.
                  </p>
                </div>
              </div>

              {/* Card 3: Market Leads */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: 12,
                padding: 24,
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#3B82F6',
                  flexShrink: 0
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                    <polyline points="2 17 12 22 22 17"></polyline>
                    <polyline points="2 12 12 17 22 12"></polyline>
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: '#FFFFFF', margin: 0 }}>Market Leads</h3>
                  <p style={{ fontSize: 14, color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                    Lead marketing calls and coordinate targeted campaigns to showcase native $HH token updates. Responsible for recruiting, onboarding, and managing a team of Market Managers to maximize reach.
                  </p>
                </div>
              </div>

              {/* Card 4: Market Managers */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: 12,
                padding: 24,
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#3B82F6',
                  flexShrink: 0
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: '#FFFFFF', margin: 0 }}>Market Managers</h3>
                  <p style={{ fontSize: 14, color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                    Promote ecosystem updates and share call updates regarding the native $HH token. Analyze market trends, build strategic visibility, and drive token adoption across crypto communities.
                  </p>
                </div>
              </div>

              {/* Card 5: Social Media Leads */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: 12,
                padding: 24,
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#3B82F6',
                  flexShrink: 0
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: '#FFFFFF', margin: 0 }}>Social Media Leads</h3>
                  <p style={{ fontSize: 14, color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                    Drive the overarching content strategy. Formulate promotional campaigns, draft high-impact announcements, write tutorials, oversee user growth, and manage/recruit Social Media Managers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      case 'skills':
      case 'x402':
      case 'agentChat':
        return (
          <div style={{ padding: '80px 20px', textAlign: 'center' }}>
            <h2 style={{ color: '#FFFFFF', fontSize: 28, marginBottom: 12 }}>
              {tab === 'skills' ? 'Skills' : 
               tab === 'agentChat' ? 'Agent Chat' : 'x402 Endpoints'}
            </h2>
            <p style={{ color: '#8A8F9E', fontSize: 16 }}>Coming Soon</p>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div 
        className={isMiniapp ? "miniapp-mode" : "web-mode sidebar-layout"} 
        style={{ minHeight: '100vh', color: 'var(--text)', position: 'relative' }}
      >

        {/* Wrong Network Banner */}
        {onWrongChain && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
            background: '#FC401F', color: '#fff',
            padding: '10px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 12,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>
              ⚠️ Wrong network. Switch to Base to use the app.
            </span>
            <button
              onClick={() => switchChain({ chainId: base.id })}
              disabled={isSwitching}
              style={{
                background: '#fff', color: '#FC401F',
                border: 'none', borderRadius: 20,
                padding: '6px 16px', fontSize: 13, fontWeight: 700,
                cursor: isSwitching ? 'wait' : 'pointer',
                flexShrink: 0,
              }}
            >
              {isSwitching ? 'Switching…' : 'Switch to Base'}
            </button>
          </div>
        )}

        {/* WEB DESKTOP SIDEBAR + HEADER LAYOUT */}
        {!isMiniapp && (
          <div className="desktop-only" style={{ display: 'flex', minHeight: '100vh', width: '100%', background: 'var(--bg2)' }}>
            <Sidebar 
              tab={tab} 
              setTab={setTab} 
              address={address} 
              isConnected={isConnected} 
              displayName={displayName} 
              isClubMember={isClubMember} 
              onRequireWallet={handleRequireWallet} 
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: 'var(--bg2)' }}>
              <Header 
                tab={tab} 
                address={address} 
                isConnected={isConnected} 
                displayName={displayName} 
                isClubMember={isClubMember} 
                hhBalance={hhBalanceStr}
                hpBalance={hpBalance}
                streakCount={streakCount}
                onRequireWallet={handleRequireWallet} 
              />
              <div className="dark-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '32px 16px 64px', boxSizing: 'border-box' }}>
                <div style={{ maxWidth: ['contests', 'earn'].includes(tab) ? 1200 : ['terms', 'privacy', 'affiliate', 'skills', 'x402', 'agentChat'].includes(tab) ? 800 : 640, margin: '0 auto', position: 'relative', zIndex: 1 }}>
                  {renderTabContent()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* MOBILE OR MINIAPP LAYOUT */}
        <div className={isMiniapp ? "" : "mobile-only"}>
          <div
            style={{
              position: 'sticky',
              top: onWrongChain ? 44 : 0,
              zIndex: 40,
              background: 'var(--bg)',
              borderBottom: '1px solid var(--border2)',
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 1px 8px rgba(10,11,13,0.06)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <HappyHourLogo size={26} />
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.5 }}>
                happy <span style={{ color: '#0052FF' }}>hour</span>
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {/* Telegram Link */}
              <a 
                href="https://t.me/happyhourapp" 
                target="_blank" 
                rel="noopener noreferrer"
                title="Telegram Channel"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'rgba(0, 136, 204, 0.08)',
                  border: '1px solid rgba(0, 136, 204, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textDecoration: 'none'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 136, 204, 0.16)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0, 136, 204, 0.08)'}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#0088cc' }}>
                  <path d="M21.9 2.19a1 1 0 0 0-.99-.08l-19 8a1 1 0 0 0-.1 1.82l4.9 2.2 3.1 7.1a1 1 0 0 0 1.77.16l2.9-3.8 4.7 3.3a1 1 0 0 0 1.51-.55l4-17a1 1 0 0 0-.39-.85zM8.62 13.12l8.28-5.28-6.4 6.72-.4 2.88z"/>
                </svg>
              </a>

              {/* X (Twitter) Link */}
              <a 
                href="https://x.com/happyhour_base" 
                target="_blank" 
                rel="noopener noreferrer"
                title="Follow us on X"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'rgba(0, 0, 0, 0.05)',
                  border: '1px solid var(--border2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textDecoration: 'none'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.05)'}
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text)' }}>
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>

              {/* Docs Link */}
              <a 
                href="/docs" 
                target="_blank" 
                rel="noopener noreferrer"
                title="Documentation"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'rgba(0, 82, 255, 0.08)',
                  border: '1px solid rgba(0, 82, 255, 0.2)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textDecoration: 'none',
                  gap: 1
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0, 82, 255, 0.16)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0, 82, 255, 0.08)'}
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#0052ff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                <span style={{ fontSize: 6, fontWeight: 800, color: '#0052ff', lineHeight: 1, letterSpacing: '-0.1px' }}>
                  docs
                </span>
              </a>

              {/* DexScreener Link */}
              <a 
                href="https://dexscreener.com/base/0xe186aa00d52844ed05d1b1373fc2ec8b0562d613f9f4b470ee7fafa0c1a388f9" 
                target="_blank" 
                rel="noopener noreferrer"
                title="DexScreener Chart"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textDecoration: 'none',
                  overflow: 'hidden'
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <img src="/dexscreener.jpg" alt="DexScreener" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </a>

              {/* GeckoTerminal Link */}
              <a 
                href="https://www.geckoterminal.com/uk/base/pools/0xe186aa00d52844ed05d1b1373fc2ec8b0562d613f9f4b470ee7fafa0c1a388f9" 
                target="_blank" 
                rel="noopener noreferrer"
                title="GeckoTerminal Chart"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textDecoration: 'none',
                  overflow: 'hidden'
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <img src="/geckoterminal.jpg" alt="GeckoTerminal" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </a>

              {/* CoinGecko Link */}
              <a 
                href="https://www.coingecko.com/en/coins/happy-hour" 
                target="_blank" 
                rel="noopener noreferrer"
                title="CoinGecko"
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textDecoration: 'none',
                  overflow: 'hidden'
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <img src="/CoinGecko-logo.png" alt="CoinGecko" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </a>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* Daily Streak */}
                {streakCount > 0 && (
                  <div style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 12,
                    padding: '4px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FF9800" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
                    </svg>
                    <span style={{ fontSize: 11, fontWeight: 750, color: '#FFFFFF', fontFamily: "'DM Mono', monospace" }}>
                      {streakCount}
                    </span>
                  </div>
                )}

                {/* HP Balance */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <span style={{ fontSize: 11, fontWeight: 750, color: '#FFFFFF', fontFamily: "'DM Mono', monospace" }}>
                    {hpBalance}
                  </span>
                  <img src="/logo.jfif" alt="HP" style={{ width: 12, height: 12, borderRadius: '50%' }} />
                </div>

                {/* $HH Balance */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 12,
                  padding: '4px 8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <span style={{ fontSize: 11, fontWeight: 750, color: '#FFFFFF', fontFamily: "'DM Mono', monospace" }}>
                    {hhBalanceStr}
                  </span>
                  <img src="/logo.jfif" alt="$HH" style={{ width: 12, height: 12, borderRadius: '50%' }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div style={{ position: 'relative', zIndex: 1, maxWidth: ['contests', 'earn'].includes(tab) ? 1200 : ['terms', 'privacy', 'affiliate', 'skills', 'x402', 'agentChat'].includes(tab) ? 800 : 640, margin: '0 auto' }}>
            {renderTabContent()}
          </div>

          <footer style={{
            width: '100%',
            background: '#1D1F23',
            borderTop: '1px solid rgba(255, 255, 255, 0.12)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16,
            padding: '32px 16px 140px',
            boxSizing: 'border-box',
            color: '#FFFFFF'
          }}>
            {/* Logo / Branding Row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <img src="/logo.jfif" alt="$HH Logo" style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#FFFFFF', display: 'flex', alignItems: 'center', gap: 6 }}>
                $HH <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 650 }}>powered by</span>
                <a 
                  href="https://x.com/bankrbot" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 6, 
                    textDecoration: 'none', 
                    color: '#FFFFFF',
                    transition: 'opacity 0.2s'
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  <img src="/bankr-logo.jpg" alt="Bankr Logo" style={{ width: 22, height: 22, borderRadius: 6, objectFit: 'cover' }} />
                  <span>Bankr</span>
                </a>
              </span>
            </div>

            {/* CA / Token Contract block */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 10,
              padding: '6px 10px',
              width: '100%',
              maxWidth: 350,
              justifyContent: 'space-between',
              boxSizing: 'border-box'
            }}>
              <span style={{ fontSize: 9.5, fontWeight: 900, color: '#3B82F6', letterSpacing: '0.5px', flexShrink: 0 }}>$HH CA:</span>
              <span style={{ 
                fontSize: 8.5, 
                fontWeight: 800, 
                fontFamily: "sf mono, consolas, 'Fira Code', monospace", 
                color: '#FFFFFF', 
                letterSpacing: '-0.1px',
                wordBreak: 'break-all',
                textAlign: 'center',
                flex: 1,
                padding: '0 4px'
              }}>
                {caCopied ? 'Copied! ✅' : '0x8235EdF32a1e10Bd1867ad622915AB613664cbA3'}
              </span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText('0x8235EdF32a1e10Bd1867ad622915AB613664cbA3');
                  setCaCopied(true);
                  setTimeout(() => setCaCopied(false), 2000);
                }}
                title="Copy Contract Address"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#3B82F6',
                  transition: 'all 0.2s',
                  flexShrink: 0
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>

            {/* Links Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%', margin: '8px 0' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px 20px' }}>
                <a 
                  href="https://t.me/happyhourapp" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 550, color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#3B82F6'; e.currentTarget.style.transform = 'translateY(-0.5px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', background: 'rgba(0, 136, 204, 0.15)',
                    border: '1px solid rgba(0, 136, 204, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#3B82F6' }}>
                      <path d="M21.9 2.19a1 1 0 0 0-.99-.08l-19 8a1 1 0 0 0-.1 1.82l4.9 2.2 3.1 7.1a1 1 0 0 0 1.77.16l2.9-3.8 4.7 3.3a1 1 0 0 0 1.51-.55l4-17a1 1 0 0 0-.39-.85zM8.62 13.12l8.28-5.28-6.4 6.72-.4 2.88z"/>
                    </svg>
                  </div>
                  <span>Official TG</span>
                </a>

                <a 
                  href="https://x.com/happyhour_base" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 550, color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#FFFFFF'; e.currentTarget.style.transform = 'translateY(-0.5px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#FFFFFF' }}>
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                  </div>
                  <span>Official X</span>
                </a>

                <a 
                  href="https://x.com/mksvibe" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 550, color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#3B82F6'; e.currentTarget.style.transform = 'translateY(-0.5px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', overflow: 'hidden',
                    border: '1.5px solid #3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <img src="/mksvibe.jpg" alt="mksvibe" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <span>Devs X</span>
                </a>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px 20px' }}>
                <a 
                  href="https://dexscreener.com/base/0xe186aa00d52844ed05d1b1373fc2ec8b0562d613f9f4b470ee7fafa0c1a388f9" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 550, color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-0.5px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <img src="/dexscreener.jpg" alt="DexScreener" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <span>Dexscreener</span>
                </a>

                <a 
                  href="https://www.geckoterminal.com/uk/base/pools/0xe186aa00d52844ed05d1b1373fc2ec8b0562d613f9f4b470ee7fafa0c1a388f9" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 550, color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-0.5px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <img src="/geckoterminal.jpg" alt="GeckoTerminal" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <span>GeckoTerminal</span>
                </a>

                <a 
                  href="https://www.coingecko.com/en/coins/happy-hour" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 550, color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'translateY(-0.5px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <img src="/CoinGecko-logo.png" alt="CoinGecko" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <span>CoinGecko</span>
                </a>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '12px 20px' }}>
                <a 
                  href="/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 550, color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#3B82F6'; e.currentTarget.style.transform = 'translateY(-0.5px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
                    </svg>
                  </div>
                  <span>Docs</span>
                </a>

                <a 
                  href="/docs/utility"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 550, color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#3B82F6'; e.currentTarget.style.transform = 'translateY(-0.5px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
                    </svg>
                  </div>
                  <span>$HH Utility</span>
                </a>

                <a 
                  href="/docs/economy"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 550, color: 'rgba(255, 255, 255, 0.7)', textDecoration: 'none', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#3B82F6'; e.currentTarget.style.transform = 'translateY(-0.5px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)'; e.currentTarget.style.transform = 'none'; }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="20" x2="18" y2="10"/>
                      <line x1="12" y1="20" x2="12" y2="4"/>
                      <line x1="6" y1="20" x2="6" y2="14"/>
                    </svg>
                  </div>
                  <span>$HH Economy</span>
                </a>
              </div>
            </div>

            {/* Copyright */}
            <div style={{ fontSize: 9.5, color: 'rgba(255, 255, 255, 0.5)', fontWeight: 650 }}>
              &copy; {new Date().getFullYear()} Happy Hour. All rights reserved.
            </div>
        </footer>

        <BottomNav tab={tab} setTab={setTab} />
      </div>

      {/* Floating AI Chat assistant */}
      {isConnected && <HappyBotChat address={address} isClubMember={isClubMember} />}

      {/* Wallet Connect Modal */}
      <WalletConnectModal isOpen={isConnectModalOpen} onClose={() => setIsConnectModalOpen(false)} />
    </div>
  </>
  )
}
