export function HappyHourLogo({ size = 32 }) {
  return (
    <img 
      src="/logo.jfif" 
      alt="Happy Hour Base" 
      style={{
        width: size, 
        height: size,
        borderRadius: Math.round(size * 0.22),
        objectFit: 'cover',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }} 
    />
  )
}
