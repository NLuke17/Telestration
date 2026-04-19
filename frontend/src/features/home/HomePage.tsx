import React, { useState } from 'react';
import Container from '../../components/common/Container';
import TutorialSlideshow from '../auth/components/TutorialSlideshow';
import { PiNumberCircleOne, PiNumberCircleTwo } from "react-icons/pi";
import Button from '../../components/common/Button';
import { useNavigate, Link } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import { createLobby, joinLobby } from '../../services/api/lobbyApi';
import { useAuth } from '../../contexts/AuthContext';
import InitialAvatar from '../../components/common/Avatar';
import { useTheme } from '../../contexts/ThemeContext';

import lightBg from '../../assets/lightmode.jpg';
import darkBg from '../../assets/darkmode.jpg';
import ColorModeButton from '../../components/common/ColorModeButton';

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const [roomCodeInput, setRoomCodeInput] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isJoining, setIsJoining] = useState(false);

    const handleCreateLobby = async () => {
        let userId: string;

        if (isAuthenticated && user) {
            userId = user.id;
        } else {
            // Generate a temporary user ID if not logged in
            const storedUserId = localStorage.getItem('userId');
            if (storedUserId) {
                userId = storedUserId;
            } else {
                userId = crypto.randomUUID();
                localStorage.setItem('userId', userId);
            }
        }

        try {
            setIsCreating(true);
            setError(null);

            const lobby = await createLobby(userId);
            navigate(`/lobby/${lobby.roomCode}`);
        } catch (err: any) {
            console.error("Create Error:", err);
            setError(err.message || 'Failed to create lobby');
        } finally {
            setIsCreating(false);
        }
    };

    const handleJoinLobby = async () => {
        if (!roomCodeInput.trim()) {
            setError('Please enter a room code');
            return;
        }

        let userId: string;

        if (isAuthenticated && user) {
            userId = user.id;
        } else {
            // Generate a temporary user ID if not logged in
            const storedUserId = localStorage.getItem('userId');
            if (storedUserId) {
                userId = storedUserId;
            } else {
                userId = crypto.randomUUID();
                localStorage.setItem('userId', userId);
            }
        }

        try {
            setIsJoining(true);
            setError(null);

            await joinLobby(roomCodeInput.trim().toUpperCase(), userId);
            navigate(`/lobby/${roomCodeInput.trim().toUpperCase()}`);
        } catch (err: any) {
            console.error("Join Error:", err);
            setError(err.message || 'Failed to join lobby');
        } finally {
            setIsJoining(false);
        }
    };

    const { theme, toggleTheme } = useTheme();


    return (
        <div className="flex flex-col justify-center items-center h-screen"
            style={{ backgroundImage: `url(${theme === 'dark' ? darkBg : lightBg})` }}
        >
            {/* Toggle Button */}
            <ColorModeButton className="absolute top-8 right-8" />
            {/* Home content container */}
            <Container width='900px' height='500px' padding='3em' className='flex items-center justify-center gap-8 flex-col border-2 border-dark-grey rounded-lg'>
                {/* Heading */}
                <div className="relative z-20 flex w-full shrink-0 items-center justify-between gap-4">
                    <h1 className="text-heading-1 text-light-mode-text-1 dark:text-dark-mode-text-1 text-left">New Game</h1>
                    <div className='flex flex-row items-center gap-4'>
                        {isAuthenticated && user ? (
                            <Link
                                to="/account"
                                className="flex flex-row items-center gap-3 rounded-lg border border-dark-grey bg-white px-4 py-2 shadow-sm hover:bg-slate-50 transition-colors cursor-pointer text-left no-underline text-inherit"
                            >
                                <InitialAvatar
                                    name={user.username}
                                    src={user.profilePicture ?? undefined}
                                    size="44"
                                />
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs uppercase text-gray-500 tracking-wide">Account</span>
                                    <span className="text-body-base font-semibold text-brand-charcoal truncate max-w-[200px]">
                                        {user.username}
                                    </span>
                                </div>
                            </Link>
                        ) : (
                            <>
                                <div className='text-heading-3'>or</div>
                                <Button
                                    className='h-fit flex'
                                    label="Sign in"
                                    onClick={() => navigate('/login')}
                                />
                            </>
                        )}
                    </div>
                </div>
                {/* Main content */}
                <div className="flex min-h-0 w-full flex-1 flex-row justify-center gap-8">
                    {/* Join a room option */}
                    <div className='flex min-h-0 flex-col items-center justify-between text-center'>
                        <PiNumberCircleOne
                            size={33}
                            className="text-light-mode-text-1 dark:text-dark-mode-text-1 transition-colors duration-300"
                        />
                        <div className="flex flex-col items-center gap-2">
                            <input
                                type="text"
                                placeholder="Enter room code"
                                value={roomCodeInput}
                                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                                className="dark:bg-white border border-gray-300 rounded px-3 py-2 text-center"
                                maxLength={6}
                            />
                            <Button
                                label={isJoining ? "Joining..." : "Join a room"}
                                disabled={!roomCodeInput.trim() || isJoining}
                                onClick={handleJoinLobby}
                            />
                        </div>
                        <div>{!isAuthenticated ? (
                            <Alert severity='info'>Playing as guest</Alert>
                        ) : (
                            <div></div>
                        )}</div>
                        <div className='dark:text-dark-mode-text-1'>Join a room using the code provided by whoever is hosting!</div>
                    </div>
                    {/* How to Play slideshow */}
                    <TutorialSlideshow className='w-hug min-h-0 max-h-full' />
                    {/* Start a new room option */}
                    <div className='flex min-h-0 w-hug flex-col items-center justify-between text-center gap-auto'>
                        <PiNumberCircleTwo 
                            size={33}
                            className="text-light-mode-text-1 dark:text-dark-mode-text-1 transition-colors duration-300"
                        />
                        <Button
                            label={isCreating ? "Creating..." : "Start a new room"}
                            disabled={isCreating}
                            onClick={handleCreateLobby}
                        />
                        <div>{!isAuthenticated ? (
                            <Alert severity='info'>Playing as guest</Alert>
                        ) : (
                            <div></div>
                        )}</div>
                        <div className='dark:text-dark-mode-text-1'>Start a room of your own and invite your friends to join!</div>
                    </div>
                </div>
                {error && (
                    <Alert severity='error' className='w-full'>{error}</Alert>
                )}
            </Container>
        </div>
    );
}

export default HomePage;
