import React from 'react';
import { GAME_NAME } from '../../constants/branding';

type SiteLogoProps = {
    className?: string;
    /** Display size in CSS pixels (width and height). */
    size?: number;
};

/** App mark; source lives in `public/logo.svg` (also used as the tab favicon). */
const SiteLogo: React.FC<SiteLogoProps> = ({ className = '', size = 48 }) => (
    <img
        src="/logo.svg"
        alt={GAME_NAME}
        width={size}
        height={size}
        className={`shrink-0 select-none ${className}`.trim()}
        draggable={false}
    />
);

export default SiteLogo;
