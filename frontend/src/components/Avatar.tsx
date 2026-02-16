interface AvatarProps {
    name: string;
    sizeX?: string;
    className?: string;
}

export default function InitialAvatar({ name, sizeX='16', className="" }: AvatarProps) {
  // Get first letter, default to '?' if name is empty
  const initial = name ? name.charAt(0).toUpperCase() : '?';

  return (
    <div style={{ width: `${sizeX}px` }}
    className={`w-[${sizeX}px] aspect-square bg-slate-800 rounded-full flex justify-center items-center text-white text-2xl font-bold ${className}`}>
      {initial}
    </div>
  );
}