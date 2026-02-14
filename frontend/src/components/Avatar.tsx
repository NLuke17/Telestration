interface AvatarProps {
    name: string;
    sizeX?: string;
    sizeY?: string;
    className?: string;
}

export default function InitialAvatar({ name, sizeX='16', sizeY='16', className = "" }: AvatarProps) {
  // Get first letter, default to '?' if name is empty
  const initial = name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div className={`w-${sizeX} h-${sizeY} rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-2xl shadow-inner ${className}`}>
      {initial}
    </div>
  );
}