export function TermsSection() {
  return (
    <div style={{
      width: '100%',
      maxWidth: 800,
      margin: '0 auto',
      padding: '40px 24px',
      fontFamily: "'Inter', sans-serif",
      color: '#94A3B8',
      lineHeight: 1.6,
      fontSize: 15
    }}>
      <h1 style={{ color: '#FFFFFF', fontSize: 28, marginBottom: 8, fontWeight: 700, letterSpacing: '-0.02em' }}>Terms of Service</h1>
      <p style={{ marginBottom: 40, fontSize: 14 }}>Last updated: July 2026</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        <section>
          <h2 style={{ color: '#FFFFFF', fontSize: 18, marginBottom: 12, fontWeight: 600 }}>1. Introduction</h2>
          <p>
            Welcome to the Happy Hour AI Consumer Platform ("Happy Hour", "we", "us", or "our"). These Terms of Service ("Terms") govern your access to and use of the Happy Hour website, platform, smart contracts, and AI agent services (collectively, the "Services"). By connecting your wallet and using our Services, you agree to be bound by these Terms.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#FFFFFF', fontSize: 18, marginBottom: 12, fontWeight: 600 }}>2. Platform Services</h2>
          <p style={{ marginBottom: 12 }}>
            Happy Hour provides a suite of decentralized finance and AI-driven services, including but not limited to:
          </p>
          <ul style={{ listStyleType: 'disc', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <li><strong>Staking:</strong> Users can stake $HH tokens to earn yields and Happy Points (HP).</li>
            <li><strong>Hourly Lottery:</strong> A frequent raffle system where users can deposit $HH for tickets to win a pooled prize.</li>
            <li><strong>Big Daily Lottery:</strong> A daily grand prize draw using Chainlink VRF for verifiable randomness.</li>
            <li><strong>Happy Points (HP) & Streaks:</strong> A reward system granting points for daily check-ins, staking, and participation.</li>
            <li><strong>Happy Club Membership:</strong> A premium subscription offering enhanced AI agent capabilities and automated on-chain actions.</li>
            <li><strong>AI Agents (@happyhourbot):</strong> Chat interfaces providing portfolio insights, platform data, and automated executions.</li>
          </ul>
        </section>

        <section>
          <h2 style={{ color: '#FFFFFF', fontSize: 18, marginBottom: 12, fontWeight: 600 }}>3. Smart Contracts and Blockchain Risks</h2>
          <p>
            Our Services rely on smart contracts deployed on the blockchain. While we strive to ensure security, interacting with smart contracts carries inherent risks, including vulnerabilities, bugs, and potential loss of funds. By using the Happy Hour platform, you acknowledge and accept these risks. We are not liable for any losses resulting from smart contract failures or blockchain network issues.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#FFFFFF', fontSize: 18, marginBottom: 12, fontWeight: 600 }}>4. Lotteries and Rewards</h2>
          <p>
            Participation in the Hourly Lottery and Big Daily Lottery requires the deposit of tokens or earning of eligible tickets. The Hourly Lottery distributes 85% of the pool to the winner, with 15% burned. The Big Daily Lottery relies on verifiable randomness to select winners. All lottery outcomes are final and recorded on the blockchain. Happy Points (HP) have no monetary value outside of the platform mechanics and cannot be directly exchanged for fiat currency.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#FFFFFF', fontSize: 18, marginBottom: 12, fontWeight: 600 }}>5. AI Agents and Automation</h2>
          <p>
            The Happy Hour AI Agents (including @happyhourbot) provide automated interactions and on-chain executions based on your instructions. You are solely responsible for the actions initiated by the AI agent on your behalf. We do not guarantee the accuracy, completeness, or profitability of the AI agent's actions or insights. Happy Club members assume full responsibility for any recurring or automated executions configured.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#FFFFFF', fontSize: 18, marginBottom: 12, fontWeight: 600 }}>6. User Obligations</h2>
          <p>
            You agree not to use the Services for any unlawful purpose, to manipulate the lottery systems, or to exploit platform mechanics. You must secure your wallet and private keys; we cannot recover lost access.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#FFFFFF', fontSize: 18, marginBottom: 12, fontWeight: 600 }}>7. Disclaimers and Limitation of Liability</h2>
          <p>
            The Services are provided "as is" and "as available". We disclaim all warranties, express or implied. In no event shall Happy Hour or its team be liable for any indirect, incidental, or consequential damages arising from your use of the platform, token volatility, or smart contract interactions.
          </p>
        </section>

        <section>
          <h2 style={{ color: '#FFFFFF', fontSize: 18, marginBottom: 12, fontWeight: 600 }}>8. Changes to Terms</h2>
          <p>
            We may modify these Terms at any time. Continued use of the Services following any updates constitutes your acceptance of the revised Terms.
          </p>
        </section>
      </div>
    </div>
  )
}
