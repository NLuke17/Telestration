import React from 'react';
import { Link } from 'react-router-dom';
import AuthForm from './components/AuthForm';
import Container from '../../components/common/Container';
import InitialAvatar from '../../components/common/Avatar';
import TutorialSlideshow from './components/TutorialSlideshow';
import { useTheme } from '../../contexts/ThemeContext';

import lightBg from '../../assets/lightmode.jpg';
import darkBg from '../../assets/darkmode.jpg';
import ColorModeButton from '../../components/common/ColorModeButton';
import SiteLogo from '../../components/common/SiteLogo';
import { GAME_NAME } from '../../constants/branding';

const LoginPage: React.FC = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <div
            className="box-border flex min-h-screen w-full flex-col items-center justify-center px-3 py-20 sm:px-5 sm:py-16"
            style={{ backgroundImage: `url(${theme === 'dark' ? darkBg : lightBg})` }}
        >
            <ColorModeButton />
            <Container
                width="900px"
                height="auto"
                padding="5em"
                className="flex min-h-0 flex-col items-center justify-center gap-6 border-2 border-light-mode-border dark:border-dark-mode-border rounded-lg sm:gap-8"
            >
                <div className="flex w-full flex-col gap-2">
                    <div className="flex w-full items-center gap-3">
                        <SiteLogo size={48} className="drop-shadow-sm" />
                        <h1 className="text-heading-1 text-light-mode-text-1 dark:text-dark-mode-text-1 text-left">Login</h1>
                    </div>
                    <p className="w-full text-center text-xs font-medium uppercase tracking-[0.22em] text-indigo-600/75 dark:text-indigo-300/70">
                        {GAME_NAME}
                    </p>
                </div>
                <div className="flex w-full max-w-full flex-col items-center justify-center gap-8 lg:flex-row lg:items-start lg:gap-10">
                    <InitialAvatar size="100" name="Person" iconType="astronaut" />
                    <AuthForm mode="login" />
                    <TutorialSlideshow className="w-full max-w-md lg:max-w-none" />
                </div>
                <div className="dark:text-dark-mode-text-1 text-sm text-center">
                    Don't have an account? <Link to="/signup" className="text-brand-charcoal dark:text-dark-mode-text-2 font-semibold hover:underline">Sign up here</Link>
                </div>
            </Container>
        </div>
    );
}

export default LoginPage;
