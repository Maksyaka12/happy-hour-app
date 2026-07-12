import { HappyHourLogo } from './HappyHourLogo'

export function ComingSoonScreen({ tab }) {
  return (
    <div style={{
      minHeight: '70vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      textAlign: 'center',
      fontFamily: "'Inter', sans-serif",
      animation: 'fadeIn 0.3s ease'
    }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
        @keyframes floatUp { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6px); } }
      `}</style>

      {/* Animated logo */}
      <div style={{ animation: 'floatUp 3s ease-in-out infinite', marginBottom: 28 }}>
        <div style={{
          width: 72,
          height: 72,
          borderRadius: 20,
          background: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(139,92,246,0.15))',
          border: '1px solid rgba(59,130,246,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="url(#grad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <defs>
              <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>
      </div>

      {/* "Coming Soon" pill */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(59,130,246,0.1)',
        border: '1px solid rgba(59,130,246,0.25)',
        borderRadius: 100,
        padding: '5px 14px',
        marginBottom: 20
      }}>
        <div style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: '#3B82F6',
          animation: 'pulse 1.5s ease-in-out infinite'
        }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#3B82F6', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Coming Soon
        </span>
      </div>

      <h2 style={{
        fontSize: 22,
        fontWeight: 800,
        color: '#FFFFFF',
        margin: '0 0 12px',
        letterSpacing: '-0.3px'
      }}>
        We're building something great
      </h2>

      <p style={{
        fontSize: 14,
        color: '#64748B',
        lineHeight: 1.6,
        maxWidth: 340,
        margin: 0
      }}>
        This section is under active development and will be available very soon. Stay tuned! 🚀
      </p>
    </div>
  )
}
