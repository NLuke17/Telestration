import { resolveProfilePictureSrc } from '../../utils/avatarUrl';

interface AvatarProps {
    name: string;
    src?: string | null;
    size?: string;
    className?: string;
}

export default function InitialAvatar({ name, src, size='16', className="" }: AvatarProps) {
  // Get first letter, default to '?' if name is empty
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const imgSrc = resolveProfilePictureSrc(src ?? undefined);

  return (
    <div 
        style={{ width: `${size}px`, height: `${size}px`, minWidth: `${size}px` }}
        className={`relative inline-flex bg-slate-800 rounded-full flex justify-center items-center text-white font-bold overflow-hidden shadow-sm ${className}`}
    >
        {imgSrc ? (
            <img 
                src={imgSrc} 
                alt={`${name}'s avatar`} 
                className="w-full h-full object-cover"
                // Optional: handle broken image links by falling back to initial
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
        ) : (
            // Use a dynamic font size based on the container size
            <span style={{ fontSize: `${parseInt(size) / 2.5}px` }}>
                {initial}
            </span>
        )}
    </div>
  );
}
