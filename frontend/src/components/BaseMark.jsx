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
