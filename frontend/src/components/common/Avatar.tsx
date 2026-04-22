import { resolveProfilePictureSrc } from '../../utils/avatarUrl';

{/* Importing avatar icons */}
import astronaut from '../../assets/space-icons/astronaut.svg';
import comet from '../../assets/space-icons/comet.svg';
import earth from '../../assets/space-icons/earth.svg';
import star from '../../assets/space-icons/falling-star.svg';
import galaxy from '../../assets/space-icons/galaxy.svg';
import rocket from '../../assets/space-icons/rocket.svg';
import satellite from '../../assets/space-icons/satellite.svg';
import saturn from '../../assets/space-icons/saturn.svg';

const spaceIcons: Record<string, string> = { 
    astronaut, comet, earth, star, galaxy, rocket, satellite, saturn 
};

export type SpaceIconType = keyof typeof spaceIcons;

interface AvatarProps {
    name: string;
    src?: string | null;
    size?: string;
    className?: string;
    iconType?: SpaceIconType; 
}

export default function InitialAvatar({ 
    name, 
    src, 
    size='40', 
    className="", 
    iconType 
}: AvatarProps) {
  
  const imgSrc = resolveProfilePictureSrc(src ?? undefined);

  const renderContent = () => {
    // 1. Prioritize uploaded profile picture
    if (imgSrc) {
        return (
            <img 
                src={imgSrc} 
                alt={`${name}'s avatar`} 
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
        );
    }

    // 2. Secondary: Space Icon
    if (iconType && spaceIcons[iconType]) {
        return (
            <img 
                src={spaceIcons[iconType]} 
                alt={iconType}
                className="w-3/5 h-3/5 object-contain"
            />
        );
    }

    // 3. Fallback: Initials
    const initial = name ? name.charAt(0).toUpperCase() : '?';
    return (
        <span style={{ fontSize: `${parseInt(size) / 2.5}px` }}>
            {initial}
        </span>
    );
  };

  return (
    <div 
        style={{ width: `${size}px`, height: `${size}px`, minWidth: `${size}px` }}
        className={`
            relative inline-flex rounded-full justify-center items-center text-white font-bold overflow-hidden shadow-sm
            bg-slate-800 dark:bg-dark-mode-button-background
            ${className}
        `}
    >
        {renderContent()}
    </div>
  );
}