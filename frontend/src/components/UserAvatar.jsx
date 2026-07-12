import Avatar from 'boring-avatars';

export function UserAvatar({ address, size = 40, variant = "beam", profilePictureUrl, shape = "circle" }) {
  // Use official Base and Happy Hour branding colors for deterministic avatars
  const basedColors = ["#0052FF", "#FC401F", "#FFE500", "#00E0FF", "#0A0B0D"];
  
  // Always use a consistent lowercase string for deterministic generation
  const seedString = address ? address.toLowerCase() : "unknown";

  const borderRadius = shape === 'square' ? Math.max(8, size * 0.2) : '50%';

  if (profilePictureUrl) {
    return (
      <img 
        src={profilePictureUrl} 
        alt="User Avatar" 
        style={{ width: size, height: size, borderRadius, objectFit: 'cover' }} 
      />
    );
  }

  return (
    <div style={{ width: size, height: size, borderRadius, overflow: 'hidden', display: 'flex' }}>
      <Avatar
        size={size}
        name={seedString}
        variant={variant}
        colors={basedColors}
        square={true} // Always generate square SVG, and clip it with the parent div's border-radius
      />
    </div>
  );
}
