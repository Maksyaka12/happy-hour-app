// src/components/UnderConstruction.jsx
// Reusable overlay component for sections under construction

export function UnderConstructionOverlay({ borderRadius = 20 }) {
  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 20,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '28px 20px',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      background: 'rgba(240, 244, 255, 0.82)',
      borderRadius,
    }}>
      {/* Construction SVG Icon */}
      <div style={{
        width: 56,
        height: 56,
        background: 'linear-gradient(135deg, #0052FF 0%, #3B82F6 100%)',
        borderRadius: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        boxShadow: '0 8px 24px rgba(0, 82, 255, 0.25)',
        flexShrink: 0,
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
        </svg>
      </div>

      {/* Badge */}
      <div style={{
        background: 'linear-gradient(135deg, #0052FF 0%, #3B82F6 100%)',
        color: '#FFFFFF',
        fontSize: 8.5,
        fontWeight: 900,
        padding: '3px 10px',
        borderRadius: 20,
        letterSpacing: '0.8px',
        textTransform: 'uppercase',
        marginBottom: 10,
        fontFamily: "'Outfit', 'Inter', sans-serif",
      }}>
        Coming Soon
      </div>

      {/* Title */}
      <div style={{
        fontSize: 15,
        fontWeight: 900,
        color: '#0A0B0D',
        textAlign: 'center',
        lineHeight: 1.3,
        marginBottom: 8,
        fontFamily: "'Outfit', 'Inter', sans-serif",
        letterSpacing: '-0.2px',
      }}>
        Building Happy Hour v2
      </div>

      {/* Subtitle */}
      <div style={{
        fontSize: 11.5,
        fontWeight: 600,
        color: '#717886',
        textAlign: 'center',
        lineHeight: 1.55,
        maxWidth: 240,
        fontFamily: "'Outfit', 'Inter', sans-serif",
      }}>
        We're upgrading to a{' '}
        <span style={{ color: '#0052FF', fontWeight: 800 }}>Full-Scale AI Platform</span>.
        {' '}Raffles & Staking are live now.
        We'll be back soon with the full experience.
      </div>

      {/* Divider with dots */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 14 }}>
        {[0, 0.3, 0.6].map((delay, i) => (
          <div key={i} style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#0052FF',
            opacity: 0.4 + i * 0.2,
            animation: `ucPulse 1.4s ease-in-out ${delay}s infinite`,
          }} />
        ))}
      </div>

      <style>{`
        @keyframes ucPulse {
          0%, 100% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.3); opacity: 0.9; }
        }
      `}</style>
    </div>
  )
}

// Wrapper that blurs its children and puts the overlay on top
export function UnderConstructionSection({ children, borderRadius = 20, style = {} }) {
  return (
    <div style={{ position: 'relative', borderRadius, overflow: 'hidden', ...style }}>
      {/* Blurred, non-interactive content behind */}
      <div style={{
        filter: 'blur(3.5px)',
        pointerEvents: 'none',
        userSelect: 'none',
        opacity: 0.6,
      }}>
        {children}
      </div>
      {/* Overlay on top */}
      <UnderConstructionOverlay borderRadius={borderRadius} />
    </div>
  )
}
