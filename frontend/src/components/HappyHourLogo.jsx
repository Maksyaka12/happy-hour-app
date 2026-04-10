export function HappyHourLogo({ size = 32 }) {
  return (
    <div style={{
      width: size, height: size,
      background: '#FFA500', borderRadius: Math.round(size * 0.22),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg width={size * 0.75} height={size * 0.5} viewBox="0 0 48 32" fill="none">
        <path d="M2 2 L2 30 M2 13 C2 13 5 7 12 7 C19 7 20 13 20 17 L20 30" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M26 2 L26 30 M26 13 C26 13 29 7 36 7 C43 7 44 13 44 17 L44 30" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}
