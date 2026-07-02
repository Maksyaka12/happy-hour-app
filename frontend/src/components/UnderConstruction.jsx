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
      {/* Happy Hour Logo */}
      <div style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 14,
        boxShadow: '0 8px 24px rgba(0, 82, 255, 0.2)',
        flexShrink: 0,
      }}>
        <img
          src="/logo.jfif"
          alt="Happy Hour"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* Title */}
      <div style={{
        fontSize: 15,
        fontWeight: 900,
        color: '#0A0B0D',
        textAlign: 'center',
        lineHeight: 1.3,
        marginBottom: 10,
        fontFamily: "'Outfit', 'Inter', sans-serif",
        letterSpacing: '-0.2px',
      }}>
        Building Happy Hour v2
      </div>

      {/* Subtitle lines */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        maxWidth: 250,
        textAlign: 'center',
        fontFamily: "'Outfit', 'Inter', sans-serif",
      }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#0052FF', lineHeight: 1.4 }}>
          Full-Scale AI Platform is on the way.
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#4B5563', lineHeight: 1.5 }}>
          Raffles &amp; Staking are still available —<br />
          enjoy them while you wait.
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#717886', lineHeight: 1.4 }}>
          We'll be back soon.
        </div>
      </div>

      {/* Pulsing dots */}
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
