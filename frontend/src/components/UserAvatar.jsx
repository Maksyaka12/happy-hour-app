import Avatar from 'boring-avatars';

export function UserAvatar({ address, size = 40, variant = "beam", profilePictureUrl }) {
  // Use official Base and Happy Hour branding colors for deterministic avatars
  const basedColors = ["#0052FF", "#FC401F", "#FFE500", "#00E0FF", "#0A0B0D"];
  
  // Always use a consistent lowercase string for deterministic generation
  const seedString = address ? address.toLowerCase() : "unknown";

  if (profilePictureUrl) {
    return (
      <img 
        src={profilePictureUrl} 
        alt="User Avatar" 
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} 
      />
    );
  }

  return (
    <Avatar
      size={size}
      name={seedString}
      variant={variant}
      colors={basedColors}
    />
  );
}
