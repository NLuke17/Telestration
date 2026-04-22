import React, { useState } from 'react';
import Container from '../../components/common/Container';
import Button from '../../components/common/Button';
import { useParams, useNavigate } from 'react-router-dom';
import InitialAvatar from '../../components/common/Avatar';
import { useLobby, useGameState } from '../../hooks/useGameState';
import { startLobby, deleteLobby } from '../../services/api/lobbyApi';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

import lightBg from '../../assets/lightmode.jpg';
import darkBg from '../../assets/darkmode.jpg';
import ColorModeButton from '../../components/common/ColorModeButton';
import { PiPlanet } from 'react-icons/pi';
import { GAME_NAME } from '../../constants/branding';

const MIN_PLAYERS = 2;

const LobbyPage: React.FC = () => {
    const { theme } = useTheme();
    const { roomCode } = useParams<{ roomCode: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    // Get userId from auth context
    const userId = user?.id || localStorage.getItem('userId') || '';
    const sync = roomCode && userId ? { roomCode, userId } : undefined;

    // Use custom hooks for lobby state
    const { lobby, isConnected, error, wsStatus } = useLobby(roomCode || '', userId);
    const gameState = useGameState(lobby?.id, sync);

    const [isStarting, setIsStarting] = useState(false);
    const [startError, setStartError] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    // Handle game started event - redirect to countdown
    React.useEffect(() => {
        console.log('[LobbyPage] Game state updated:', {
            roundId: gameState.roundId,
            phase: gameState.phase,
            roundNumber: gameState.roundNumber
        });

        if (gameState.roundId && gameState.phase) {
            console.log('[LobbyPage] Game started, navigating to countdown page with phase:', gameState.phase);
            navigate(`/game/${roomCode}/countdown?phase=${gameState.phase}`, { replace: true });
        }
    }, [gameState.roundId, gameState.phase, gameState.roundNumber, navigate, roomCode]);

    // Handle lobby already in progress - redirect to countdown
    React.useEffect(() => {
        if (lobby && lobby.state === 'IN_PROGRESS') {
            console.log('[LobbyPage] Lobby is already in progress, checking game state');
            // If we have game state, redirect to countdown with phase
            if (gameState.roundId && gameState.phase) {
                console.log('[LobbyPage] Redirecting to countdown for game in progress with phase:', gameState.phase);
                navigate(`/game/${roomCode}/countdown?phase=${gameState.phase}`, { replace: true });
            }
        }
    }, [lobby, gameState, navigate, roomCode]);

    // Handle lobby deleted - redirect to home
    React.useEffect(() => {
        if (error && error.includes('deleted')) {
            setTimeout(() => {
                navigate('/');
            }, 2000);
        }
    }, [error, navigate]);

    const handleDeleteLobby = async () => {
        if (!roomCode || !userId || lobby?.host.id !== userId) return;
        if (!window.confirm('Delete this room for everyone? This cannot be undone.')) return;
        setIsDeleting(true);
        setDeleteError(null);
        try {
            await deleteLobby(roomCode, userId);
            navigate('/', { replace: true });
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to delete lobby';
            setDeleteError(msg);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleShare = async () => {
        if (!roomCode) return;

        const shareUrl = `${window.location.origin}/lobby/${roomCode}`;

        try {
            if (navigator.share) {
                await navigator.share({
                    title: `Join my ${GAME_NAME} game!`,
                    text: `Join my game with room code: ${roomCode}`,
                    url: shareUrl,
                });
            } else {
                // Fallback: copy to clipboard
                await navigator.clipboard.writeText(shareUrl);
                alert('Room link copied to clipboard!');
            }
        } catch (err) {
            console.error('Error sharing:', err);
        }
    };

    const handleStart = async () => {
        if (!roomCode || !lobby) return;

        console.log('[LobbyPage] handleStart called', { roomCode, lobbyId: lobby.id, playerCount: lobby.players.length });

        setIsStarting(true);
        setStartError(null);

        try {
            // Start the lobby via REST API
            console.log('[LobbyPage] Calling startLobby API...');
            const result = await startLobby(roomCode);
            console.log('[LobbyPage] startLobby API response:', result);

            const allPrefilled =
                result.flipbooks?.every((fb) => (fb.prompt || '').trim().length > 0) ?? false;
            const startPhase = allPrefilled ? 'DRAWING' : 'GUESSING';

            setTimeout(() => {
                console.log('[LobbyPage] Host navigating to countdown, phase:', startPhase);
                navigate(`/game/${roomCode}/countdown?phase=${startPhase}`);
            }, 400);

            // The game:started event will be received via WebSocket for other players
            // and handled by the useEffect above
        } catch (err: any) {
            console.error('[LobbyPage] Failed to start game:', err);
            setStartError(err.message || 'Failed to start game');
            setIsStarting(false);
        }
    };

    // Loading state
    if (wsStatus === 'connecting' || !isConnected) {
        return (
            <div className="box-border flex min-h-screen w-full flex-col items-center justify-center bg-gray-50 px-3 py-20 sm:px-5 sm:py-16">
                <ColorModeButton />
                <Container
                    width="900px"
                    height="500px"
                    padding="5em"
                    className="flex flex-col items-center justify-center border-2 border-dark-grey bg-white shadow-xl"
                >
                    <p className="text-heading-3">Connecting to lobby...</p>
                </Container>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="box-border flex min-h-screen w-full flex-col items-center justify-center bg-gray-50 px-3 py-20 sm:px-5 sm:py-16">
                <ColorModeButton />
                <Container
                    width="900px"
                    height="500px"
                    padding="5em"
                    className="flex flex-col items-center justify-center border-2 border-dark-grey bg-white shadow-xl"
                >
                    <p className="text-heading-3 text-red-600">Error: {error}</p>
                    {error.includes('deleted') && (
                        <p className="text-body mt-4">Redirecting to home...</p>
                    )}
                </Container>
            </div>
        );
    }

    const isHost = lobby?.host.id === userId;
    const playerCount = lobby?.players.length || 0;
    const hasMinimumPlayers = playerCount >= MIN_PLAYERS;
    const canStart =
        isHost &&
        hasMinimumPlayers &&
        (lobby?.state === 'WAITING' || lobby?.state === 'FINISHED');
    const isGameInProgress = lobby?.state === 'IN_PROGRESS';

    return (
        <div
            className="box-border flex min-h-screen w-full flex-col items-center justify-center bg-gray-50 px-3 py-20 sm:px-5 sm:py-16"
            style={{ backgroundImage: `url(${theme === 'dark' ? darkBg : lightBg})` }}
        >
            <ColorModeButton />
            <Container
                width="900px"
                height="550px"
                padding="2em"
                className="flex min-h-0 flex-col justify-between gap-6 rounded-lg border-2 border-dark-grey bg-white p-4 shadow-xl sm:p-8 xl:p-10"
            >
                <h1 className="mb-2 flex w-full items-center gap-2 text-left text-heading-1 text-light-mode-text-1 dark:text-dark-mode-text-1 sm:mb-4">
                    <PiPlanet className="shrink-0 text-indigo-500 dark:text-indigo-400" size={28} aria-hidden />
                    Join room
                </h1>
                <div className="flex w-full flex-1 flex-col items-stretch gap-8 xl:flex-row xl:justify-between xl:gap-6">
                    {/* Left: players */}
                    <div className="flex w-full shrink-0 flex-col gap-4 xl:w-64">
                        <h2 className="dark:text-dark-mode-text-2 text-lg font-bold text-center w-full">
                            Players ({playerCount}/{MIN_PLAYERS} min)
                        </h2>
                        <Container
                            width='100%'
                            height='auto'
                            padding='1em'
                            className='flex flex-col items-start border-2 border-light-grey rounded-lg bg-white shadow-xl gap-4'>

                            <div className="flex flex-col gap-2">
                                {lobby?.players.map((player) => {
                                    const isPlayerHost = player.id === lobby.host.id;
                                    return (
                                        <div key={player.id} className="flex items-center gap-2">
                                            <InitialAvatar
                                                name={player.username}
                                                src={player.profilePicture}
                                                size="40"
                                            />
                                            <span className="text-dark-grey">
                                                {player.username}
                                                {isPlayerHost && (
                                                    <span className="text-xs text-gray-500 ml-1">(Host)</span>
                                                )}
                                            </span>
                                        </div>
                                    )
                                })}
                            </div>
                        </Container>
                    </div>

                    {/* Middle: invite and start */}
                    <div className="flex w-full min-w-0 flex-1 flex-col items-center gap-2">
                        <h2 className="dark:text-dark-mode-text-2 text-lg font-bold text-center">Room code:</h2>
                        <p className="text-heading-1 dark:text-dark-mode-text-1 font-bold text-center leading-none mb-4">
                            {roomCode}
                        </p>

                        <div className="flex flex-col gap-3 items-center w-full">
                            <Button
                                label="Share"
                                className="w-40 py-3"
                                onClick={handleShare}
                            />

                            {isHost && (
                                <>
                                    <Button
                                        label={isDeleting ? 'Deleting…' : 'Delete room'}
                                        className="w-40 py-3 border border-red-300 text-red-700"
                                        onClick={() => void handleDeleteLobby()}
                                        disabled={isDeleting}
                                    />
                                    {isHost && !isGameInProgress && (
                                        <Button
                                            label={isStarting ? "Starting..." : "Start Game"}
                                            className="w-40 py-3"
                                            onClick={handleStart}
                                            disabled={!canStart || isStarting}
                                        />
                                    )}
                                </>
                            )}
                        </div>

                        {/* Feedback Messages - Moved inside the card */}
                        <div className="mt-4 min-h-[40px]">
                            {startError && (
                                <p className="text-red-600 text-sm text-center">{startError}</p>
                            )}
                            {deleteError && (
                                <p className="text-red-600 text-sm text-center">{deleteError}</p>
                            )}
                            {isGameInProgress && (
                                <p className="dark:text-dark-mode-text-2 text-blue-600 text-sm text-center">
                                    Game in progress...
                                </p>
                            )}
                            {isHost && !isGameInProgress && !hasMinimumPlayers && (
                                <p className="dark:text-dark-mode-text-2 text-amber-600 text-sm text-center">
                                    Need at least {MIN_PLAYERS} players ({playerCount}/{MIN_PLAYERS})
                                </p>
                            )}
                            {!isHost && !isGameInProgress && (
                                <p className="dark:text-dark-mode-text-2 text-gray-600 text-sm text-center">
                                    Waiting for host...
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Right: how to play */}
                    <div className="flex w-full shrink-0 flex-col items-center gap-4 xl:w-64">
                        <h2 className="dark:text-dark-mode-text-2 text-lg font-bold text-center">How to play</h2>
                        <Container
                            width='100%'
                            height='250px'
                            padding='0'
                            className='flex items-center justify-center border-2 border-light-grey rounded-lg bg-white shadow-xl'>
                            <p className="text-center text-gray-400">Slideshow here</p>
                        </Container>
                    </div>
                </div>
            </Container>
        </div>
    );
}

export default LobbyPage;
