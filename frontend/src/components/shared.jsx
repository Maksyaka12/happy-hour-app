// src/components/HappyHourLogo.jsx
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

// src/components/BaseMark.jsx
export function BaseMark({ size = 24, color = '#0000FF' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect width="10" height="10" fill={color}/>
      <rect x="14" width="10" height="10" fill={color} opacity="0.4"/>
      <rect y="14" width="10" height="10" fill={color} opacity="0.4"/>
      <rect x="14" y="14" width="10" height="10" fill={color} opacity="0.15"/>
    </svg>
  )
}

// src/components/PBar.jsx
export function PBar({ participants, totalPot }) {
  const COLORS = ["#FF6B6B","#FFD93D","#6BCB77","#4D96FF","#C77DFF","#FF9F1C","#00B4D8","#F72585","#3A86FF","#8338EC","#FB5607","#FFBE0B","#06D6A0","#EF476F","#118AB2"]
  const pColor = (addr) => COLORS[parseInt(addr?.slice(2,4)||'0',16) % COLORS.length]

  if (!totalPot || !participants.length) {
    return <div style={{ height: 10, borderRadius: 5, background: '#EEF0F3' }} />
  }
  return (
    <div style={{ height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex' }}>
      {participants.map((p, i) => (
        <div key={i} style={{
          width: `${(p.amount / totalPot * 100).toFixed(2)}%`,
          minWidth: 4, height: '100%',
          background: pColor(p.address),
          transition: 'width 0.5s ease',
        }} />
      ))}
    </div>
  )
}
