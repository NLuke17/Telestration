import React, { useState } from 'react';
import Container from '../../components/common/Container';
import Button from '../../components/common/Button';
import { useParams, useNavigate } from 'react-router-dom';
import InitialAvatar from '../../components/common/Avatar';
import { useLobby, useGameState } from '../../hooks/useGameState';
import { startLobby } from '../../services/api/lobbyApi';
import { useAuth } from '../../contexts/AuthContext';
import Tutorial from '../../components/common/Tutorial';

const MIN_PLAYERS = 2;

const LobbyPage: React.FC = () => {
    const { roomCode } = useParams<{ roomCode: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    // Get userId from auth context
    const userId = user?.id || '';
    
    // Use custom hooks for lobby state
    const { lobby, isConnected, error, wsStatus } = useLobby(roomCode || '', userId);
    const gameState = useGameState(lobby?.id);
    
    const [isStarting, setIsStarting] = useState(false);
    const [startError, setStartError] = useState<string | null>(null);

    // Handle game started event - redirect to countdown
    React.useEffect(() => {
        console.log('[LobbyPage] Game state updated:', { 
            roundId: gameState.roundId, 
            phase: gameState.phase,
            roundNumber: gameState.roundNumber 
        });
        
        if (gameState.roundId && gameState.phase) {
            console.log('[LobbyPage] Game started, navigating to countdown page with phase:', gameState.phase);
            // Navigate to countdown page with phase as URL parameter
            navigate(`/game/${roomCode}/countdown?phase=${gameState.phase}`);
        }
    }, [gameState.roundId, gameState.phase, gameState.roundNumber, navigate, roomCode]);

    // Handle lobby already in progress - redirect to countdown
    React.useEffect(() => {
        if (lobby && lobby.state === 'IN_PROGRESS') {
            console.log('[LobbyPage] Lobby is already in progress, checking game state');
            // If we have game state, redirect to countdown with phase
            if (gameState.roundId && gameState.phase) {
                console.log('[LobbyPage] Redirecting to countdown for game in progress with phase:', gameState.phase);
                navigate(`/game/${roomCode}/countdown?phase=${gameState.phase}`);
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

    const handleShare = async () => {
        if (!roomCode) return;
        
        const shareUrl = `${window.location.origin}/lobby/${roomCode}`;
        
        try {
            if (navigator.share) {
                await navigator.share({
                    title: 'Join my Telestration game!',
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
            
            // Wait a moment for WebSocket events to arrive, then navigate
            // Default to GUESSING phase for initial prompt writing
            setTimeout(() => {
                const phase = gameState.phase || 'GUESSING';
                console.log('[LobbyPage] Host navigating to countdown page with phase:', phase);
                navigate(`/game/${roomCode}/countdown?phase=${phase}`);
            }, 500);
            
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
            <div className="flex flex-col justify-center items-center h-screen bg-gray-50">
                <Container width='900px' height='500px' padding='5em' className='flex flex-col justify-center items-center border-2 border-dark-grey rounded-lg bg-white shadow-xl'>
                    <p className="text-heading-3">Connecting to lobby...</p>
                </Container>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex flex-col justify-center items-center h-screen bg-gray-50">
                <Container width='900px' height='500px' padding='5em' className='flex flex-col justify-center items-center border-2 border-dark-grey rounded-lg bg-white shadow-xl'>
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
    const canStart = isHost && hasMinimumPlayers && lobby?.state === 'WAITING';
    const isGameInProgress = lobby?.state === 'IN_PROGRESS';

    return (
        <div className="flex flex-col justify-center items-center h-screen bg-gray-50">
            <Container 
                width='900px' 
                height='500px' 
                padding='5em' 
                className='flex flex-col justify-center gap-2 flex-col border-2 border-dark-grey rounded-lg bg-white p-12'
            >
                {/* Header */}
                <h1 className="text-heading-1 w-full text-left mb-0">Join Room</h1>
                <div className='flex flex-row gap-12'>
                
                {/* Left: players */}
                    <div className="flex flex-col gap-6 w-auto">
                        <Container
                            width='200px'
                            height='auto'
                            padding='1em'
                            className='flex flex-col items-start border-2 border-light-grey rounded-lg bg-white gap-4'>                          
                            <h2 className="text-lg font-bold text-left w-full">
                                Players ({playerCount}/{MIN_PLAYERS} min)
                            </h2>
                            <div className="flex flex-col gap-2">
                                {lobby?.players.map((player) => {
                                    const isPlayerHost = player.id === lobby.host.id;
                                    return (
                                    <div
                                        key={player.id}
                                        className="flex items-center gap-2"
                                    >
                                        {/* Profile Picture */}
                                        <InitialAvatar
                                            name={player.username}
                                            src={player.profilePicture}
                                            size="40"
                                        />
                                        {/* Username */ }
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
                    <div className="flex flex-col gap-6 w-full">
                        <h2 className="text-lg font-bold pb-2 text-center">Room code:</h2>
                        {/* Displaying the Room Code numbers */}
                        <p className="text-heading-1 font-bold text-center">
                            {roomCode}
                        </p>
                        <Button 
                            label="Share" 
                            className="w-fit py-3 mt-2 self-center" 
                            onClick={handleShare}
                        />
                        {isGameInProgress && (
                            <p className="text-blue-600 text-sm text-center mt-4">
                                Game in progress... Loading game page...
                            </p>
                        )}
                        {isHost && !isGameInProgress && (
                            <>
                                <Button 
                                    label={isStarting ? "Starting..." : "Start Game"} 
                                    className="w-fit py-3 mt-2 self-center" 
                                    onClick={handleStart}
                                    disabled={!canStart || isStarting}
                                />
                                {startError && (
                                    <p className="text-red-600 text-sm text-center">{startError}</p>
                                )}
                                {!hasMinimumPlayers && (
                                    <p className="text-amber-600 text-sm text-center">
                                        Need at least {MIN_PLAYERS} players to start ({playerCount}/{MIN_PLAYERS})
                                    </p>
                                )}
                                {hasMinimumPlayers && !isStarting && (
                                    <p className="text-green-600 text-sm text-center">
                                        Ready to start! ✓
                                    </p>
                                )}
                            </>
                        )}
                        {!isHost && !isGameInProgress && (
                            <p className="text-gray-600 text-sm text-center mt-4">
                                Waiting for host to start the game...
                            </p>
                        )}
                    </div>

                {/* Right: how to play */}
                    <div>
                        <Tutorial width="w-1/5"/>
                    </div>
                </div>

            </Container>
        </div>
    );
}

export default LobbyPage;
