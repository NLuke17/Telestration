import React, { useState } from 'react';
import Container from '../../components/common/Container';
import Button from '../../components/common/Button';
import { useParams, useNavigate } from 'react-router-dom';
import InitialAvatar from '../../components/common/Avatar';
import { useLobby, usePromptTracker, useGameState } from '../../hooks/useGameState';
import { startLobby } from '../../services/api/lobbyApi';

const LobbyPage: React.FC = () => {
    const { roomCode } = useParams<{ roomCode: string }>();
    const navigate = useNavigate();
    
    // Get userId from localStorage or context (you may want to implement proper auth)
    const userId = localStorage.getItem('userId') || '';
    
    // Use custom hooks for lobby state
    const { lobby, isConnected, error, connectedUserIds, wsStatus } = useLobby(roomCode || '', userId);
    const { submittedUserIds, allPromptsReady, hasSubmitted } = usePromptTracker(lobby?.id);
    const gameState = useGameState(lobby?.id);
    
    const [isStarting, setIsStarting] = useState(false);
    const [startError, setStartError] = useState<string | null>(null);

    // Handle game started event - redirect to game
    React.useEffect(() => {
        if (gameState.roundId && gameState.phase) {
            console.log('Game started, redirecting to game page');
            // Navigate to the appropriate game page based on phase
            if (gameState.phase === 'DRAWING') {
                navigate(`/game/${roomCode}/draw`);
            } else if (gameState.phase === 'GUESSING') {
                navigate(`/game/${roomCode}/guess`);
            }
        }
    }, [gameState.roundId, gameState.phase, navigate, roomCode]);

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
        
        setIsStarting(true);
        setStartError(null);
        
        try {
            // Start the lobby via REST API
            await startLobby(roomCode);
            // The game:started event will be received via WebSocket
            // and handled by the useEffect above
        } catch (err: any) {
            console.error('Failed to start game:', err);
            setStartError(err.message || 'Failed to start game');
        } finally {
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
    const canStart = isHost && lobby && lobby.players.length >= 2;

    return (
        <div className="flex flex-col justify-center items-center h-screen bg-gray-50">
            <Container 
                width='900px' 
                height='500px' 
                padding='5em' 
                className='flex flex-col justify-center gap-2 flex-col border-2 border-dark-grey rounded-lg bg-white shadow-xl p-12'
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
                            className='flex flex-col items-start border-2 border-light-grey rounded-lg bg-white shadow-xl gap-4'>                          
                            <h2 className="text-lg font-bold text-left w-full">Players</h2>
                            <div className="flex flex-col gap-2">
                                {lobby?.players.map((player) => {
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
                        {isHost && (
                            <>
                                <Button 
                                    label={isStarting ? "Starting..." : "Start"} 
                                    className="w-fit py-3 mt-2 self-center" 
                                    onClick={handleStart}
                                    disabled={!canStart || isStarting}
                                />
                                {startError && (
                                    <p className="text-red-600 text-sm text-center">{startError}</p>
                                )}
                                {!canStart && lobby && lobby.players.length < 2 && (
                                    <p className="text-gray-600 text-sm text-center">Need at least 2 players to start</p>
                                )}
                            </>
                        )}
                    </div>

                {/* Right: how to play */}
                    <div className="flex flex-col justify-center items-center gap-6 w-auto">
                        <h2 className="text-lg font-bold pb-2 text-center">How to play</h2>
                        <Container
                            width='200px'
                            height='250px'
                            padding='0'
                            className='gap-2 flex-col border-2 border-light-grey rounded-lg bg-white shadow-xl p-12'>
                              <p className="text-center">Slideshow here</p>
                        </Container>
                    </div>
                </div>

            </Container>
        </div>
    );
}

export default LobbyPage;
