import React, { useState } from 'react';
import Container from '../../components/common/Container';
import Tutorial from '../../components/common/Tutorial';
import { PiPlanet, PiRocketLaunch } from 'react-icons/pi';
import { GAME_NAME } from '../../constants/branding';
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
import SiteLogo from '../../components/common/SiteLogo';
import { getOrCreateLobbyUserId } from '../../utils/lobbyUserId';

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const [roomCodeInput, setRoomCodeInput] = useState<string>('');
    const [joinError, setJoinError] = useState<string | null>(null);
    const [createError, setCreateError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isJoining, setIsJoining] = useState(false);

    const handleCreateLobby = async () => {
        const userId = getOrCreateLobbyUserId(isAuthenticated, user);

        try {
            setIsCreating(true);
            setCreateError(null);

            const lobby = await createLobby(userId);
            navigate(`/lobby/${lobby.roomCode}`);
        } catch (err: any) {
            console.error("Create Error:", err);
            setCreateError(err.message || 'Failed to create lobby');
        } finally {
            setIsCreating(false);
        }
    };

    const handleJoinLobby = async () => {
        if (!roomCodeInput.trim()) {
            setJoinError('Please enter a room code');
            return;
        }

        const userId = getOrCreateLobbyUserId(isAuthenticated, user);

        try {
            setIsJoining(true);
            setJoinError(null);

            await joinLobby(roomCodeInput.trim().toUpperCase(), userId);
            navigate(`/lobby/${roomCodeInput.trim().toUpperCase()}`);
        } catch (err: any) {
            console.error("Join Error:", err);
            setJoinError(err.message || 'Failed to join lobby');
        } finally {
            setIsJoining(false);
        }
    };

    const { theme } = useTheme();


    return (
        <div
            className="box-border flex min-h-screen w-full flex-col items-center justify-center px-3 py-20 sm:px-5 sm:py-16"
            style={{ backgroundImage: `url(${theme === 'dark' ? darkBg : lightBg})` }}
        >
            <ColorModeButton />
            <Container
                width="900px"
                height="500px"
                padding="3em"
                className="flex flex-col items-center justify-center gap-6 border-2 border-dark-grey rounded-lg sm:gap-8"
            >
                <div className="relative z-20 flex w-full shrink-0 flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2">
                    <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                        <SiteLogo
                            size={80}
                            className="drop-shadow-sm h-10 w-10 shrink-0 sm:h-12 sm:w-12 md:h-16 md:w-16 lg:h-20 lg:w-20"
                        />
                        <h1 className="min-w-0 flex-1 break-words text-left text-[1.5rem] font-medium lowercase tracking-tight text-light-mode-text-1 dark:text-dark-mode-text-1 sm:text-3xl md:text-4xl lg:text-heading-1">
                            {GAME_NAME}
                        </h1>
                    </div>
                    <div className="flex shrink-0 flex-row items-center justify-end ">
                        {isAuthenticated && user ? (
                            <Link
                                to="/account"
                                className="flex max-w-full flex-row items-center gap-2 rounded-lg dark:bg-dark-mode-input-background/20 border border-dark-grey bg-white px-2 py-1.5 shadow-sm hover:bg-slate-50 dark:hover:bg-gray-900 dark:hover:border-dark-mode-text-2 transition-colors sm:gap-3 sm:px-4 sm:py-2"
                                title={user.username}
                            >
                                <InitialAvatar
                                    name={user.username}
                                    src={user.profilePicture ?? undefined}
                                    size="44"
                                />
                                <div className="hidden min-w-0 flex-col sm:flex">
                                    <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-dark-mode-text-2">
                                        Account
                                    </span>
                                    <span className="text-body-base truncate font-semibold text-brand-charcoal dark:text-dark-mode-text-1 sm:max-w-[200px]">
                                        {user.username}
                                    </span>
                                </div>
                            </Link>
                        ) : (
                            <Button
                                className="h-fit shrink-0"
                                label="Sign in"
                                onClick={() => navigate('/login')}
                            />
                        )}
                    </div>
                </div>
                <div className="flex min-h-0 w-full flex-1 flex-col justify-center gap-8 lg:flex-row lg:items-stretch lg:gap-6">
                    <div className="flex w-full min-w-0 flex-col items-center gap-5 text-center lg:min-h-0 lg:flex-1 lg:basis-0">
                        <div className="mb-8 flex items-start justify-center gap-2 text-center text-body dark:text-dark-mode-text-1">
                            <PiPlanet
                                className="mt-0.5 shrink-0 text-indigo-500/85 dark:text-indigo-400/90"
                                size={16}
                                aria-hidden
                            />
                            <span>Join a room using the code from whoever is hosting.</span>
                        </div>
                        <div className="flex w-full max-w-full flex-col items-center gap-3">
                            <input
                                type="text"
                                placeholder="Enter room code"
                                value={roomCodeInput}
                                onChange={(e) => {
                                    setRoomCodeInput(e.target.value.toUpperCase());
                                    setJoinError(null);
                                }}
                                className="dark:bg-dark-mode-input-background/20 dark:placeholder:text-gray-400 dark:text-gray-100 w-full border border-gray-300 dark:border-dark-mode-border-2 rounded px-3 py-2 text-center"
                                maxLength={6}
                            />
                            <Button
                                label={isJoining ? "Joining..." : "Join a room"}
                                disabled={!roomCodeInput.trim() || isJoining}
                                onClick={handleJoinLobby}
                            />
                            <div className="flex w-full flex-wrap items-start justify-center gap-3">
                                {!isAuthenticated && (
                                    <Alert severity="info" className="py-1 [&_.MuiAlert-message]:py-0">
                                        Playing as guest
                                    </Alert>
                                )}
                                {joinError && (
                                    <Alert severity="error" className="max-w-full py-1 sm:max-w-[280px] [&_.MuiAlert-message]:py-0">
                                        {joinError}
                                    </Alert>
                                )}
                            </div>
                        </div>
                    </div>
                    <Tutorial width="min-h-0 w-full min-w-0 max-h-[40vh] lg:max-h-full lg:flex-1 lg:basis-0" />
                    <div className="flex w-full min-w-0 flex-col items-center gap-5 text-center lg:min-h-0 lg:flex-1 lg:basis-0">
                        <div className="mb-8 flex items-start justify-center gap-2 text-center text-body dark:text-dark-mode-text-1">
                            <PiRocketLaunch
                                className="mt-0.5 shrink-0 text-indigo-500/85 dark:text-indigo-400/90"
                                size={16}
                                aria-hidden
                            />
                            <span>Start a room and invite your crew to jump in.</span>
                        </div>
                        <div className="flex w-full max-w-full flex-col items-center gap-3">
                            <Button
                                label={isCreating ? "Creating..." : "Start a new room"}
                                disabled={isCreating}
                                onClick={handleCreateLobby}
                            />
                            <div className="flex w-full flex-wrap items-start justify-center gap-3">
                                {!isAuthenticated && (
                                    <Alert severity="info" className="py-1 [&_.MuiAlert-message]:py-0">
                                        Playing as guest
                                    </Alert>
                                )}
                                {createError && (
                                    <Alert severity="error" className="max-w-full py-1 sm:max-w-[280px] [&_.MuiAlert-message]:py-0">
                                        {createError}
                                    </Alert>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </Container>
        </div>
    );
}

export default HomePage;
