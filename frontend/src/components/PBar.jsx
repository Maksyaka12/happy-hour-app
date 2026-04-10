const COLORS = ["#FF6B6B","#FFD93D","#6BCB77","#4D96FF","#C77DFF","#FF9F1C","#00B4D8","#F72585","#3A86FF","#8338EC","#FB5607","#FFBE0B","#06D6A0","#EF476F","#118AB2"]
const pColor = (addr) => COLORS[parseInt(addr?.slice(2,4)||'0',16) % COLORS.length]

export function PBar({ participants, totalPot }) {
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
