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

const LoginPage: React.FC = () => {
    const { theme, toggleTheme } = useTheme();

    return (
        <div className="flex flex-col justify-center items-center h-screen"
        style={{ backgroundImage: `url(${theme === 'dark' ? darkBg : lightBg})`}}
        >
            {/* Toggle Button */}
            <ColorModeButton className="absolute top-8 right-8" />
            <Container width='900px' height='500px' padding='5em' className='flex items-center justify-center gap-8 flex-col border-2 border-light-mode-border dark:border-dark-mode-border rounded-lg'>
                <h1 className="text-heading-1 text-light-mode-text-1 dark:text-dark-mode-text-1 w-full text-left ">Login</h1>
                <div className="flex flex-row items-center justify-center w-full gap-8">
                    <InitialAvatar size='100' name='Firestone'/>
                    <AuthForm mode="login" />
                    <TutorialSlideshow />
                </div>
                <div className="text-sm text-center">
                    Don't have an account? <Link to="/signup" className="text-brand-charcoal font-semibold hover:underline">Sign up here</Link>
                </div>
            </Container>
        </div>
    );
}

export default LoginPage;
