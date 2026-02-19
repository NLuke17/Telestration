interface AvatarProps {
    name: string;
    size?: string;
    className?: string;
}

export default function InitialAvatar({ name, size='16', className="" }: AvatarProps) {
  // Get first letter, default to '?' if name is empty
  const initial = name ? name.charAt(0).toUpperCase() : '?';

  return (
        <div style={{ width: `${size}px`, height: `${size}px`}}
    className={`aspect-square bg-slate-800 rounded-full flex justify-center items-center text-white text-2xl font-bold ${className}`}>

      {initial}
    </div>
  );
}
