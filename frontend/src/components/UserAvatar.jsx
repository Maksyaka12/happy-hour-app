import Avatar from 'boring-avatars';

export function UserAvatar({ address, size = 40, variant = "beam" }) {
  // Use official Base and Happy Hour branding colors for deterministic avatars
  const basedColors = ["#0052FF", "#FC401F", "#FFE500", "#00E0FF", "#0A0B0D"];
  
  return (
    <Avatar
      size={size}
      name={address || "unknown"}
      variant={variant}
      colors={basedColors}
    />
  );
}
