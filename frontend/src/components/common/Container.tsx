import React from 'react';

interface ContainerProps {
    width: string;
    height: string;
    children: React.ReactNode;
    className?: string;
    padding?: string;
    filled?: boolean;
}

function buildStyle(width: string, height: string, padding: string): React.CSSProperties {
    const style: React.CSSProperties = {
        boxSizing: 'border-box',
    };

    const w = width.trim();
    const pxW = /^(\d+(?:\.\d+)?)px$/i.exec(w);
    if (pxW) {
        style.width = '100%';
        style.maxWidth = `${pxW[1]}px`;
    } else {
        style.width = w;
    }

    const h = height.trim();
    if (h === 'auto') {
        style.height = 'auto';
    } else {
        const pxH = /^(\d+(?:\.\d+)?)px$/i.exec(h);
        if (pxH) {
            style.minHeight = `${pxH[1]}px`;
            style.height = 'auto';
        } else {
            style.height = h;
        }
    }

    const p = padding.trim();
    const paddingClamped: Record<string, string> = {
        '5em': 'clamp(0.75rem, 4vw, 5em)',
        '3em': 'clamp(0.75rem, 3.5vw, 3em)',
        '2em': 'clamp(0.65rem, 3vw, 2em)',
        '1.5em': 'clamp(0.5rem, 2.5vw, 1.5em)',
        '1em': 'clamp(0.45rem, 2vw, 1em)',
        '0': '0',
        '0px': '0',
    };
    style.padding = paddingClamped[p] ?? p;

    return style;
}

export default function Container({
    width,
    height,
    padding = '5em',
    children,
    filled = true,
    className = '',
}: ContainerProps) {
    return (
        <div
            style={buildStyle(width, height, padding)}
            className={`mx-auto min-w-0 max-w-full ${filled ? 'bg-white dark:bg-gray-950' : ''} ${className}`.trim()}
        >
            {children}
        </div>
    );
}
