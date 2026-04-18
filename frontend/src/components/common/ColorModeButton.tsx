import React from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { FaMoon, FaSun } from 'react-icons/fa'; 

interface ColorModeButtonProps {
    className?: string;
}

const ColorModeButton: React.FC<ColorModeButtonProps> = ({ className }) => {
    const { theme, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            className={`
                flex items-center justify-center p-2 rounded-lg
                border-1 border-light-mode-border dark:border-dark-mode-border
                bg-light-mode-text-2 dark:bg-dark-mode-button-background
                hover:scale-110 active:scale-95
                ${className}
            `}
            aria-label="Toggle Color Mode"
        >
            {theme === 'light' ? (
                <FaMoon className="w-5 h-5 text-light-mode-text-1" />
            ) : (
                <FaSun className="w-5 h-5 text-dark-mode-text-1" />
            )}
        </button>
    );
};

export default ColorModeButton;