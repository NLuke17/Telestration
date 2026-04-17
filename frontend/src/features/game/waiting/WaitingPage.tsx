import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Container from '../../../components/common/Container';
import { useGameState, useLobby } from '../../../hooks/useGameState';
import { getGameState } from '../../../services/api/lobbyApi';
import { useAuth } from '../../../contexts/AuthContext';

const PROMPT_WAIT_FLAG = 'telestration.expectDrawAfterPromptWait';

/** Only send players who still owe work for this wave (`hasSubmitted` must be explicitly false). */
function shouldRedirectToDraw(s: { phase: string; hasSubmitted?: boolean }): boolean {
    return s.phase === 'DRAWING' && s.hasSubmitted === false;
}

function shouldRedirectToGuess(s: { phase: string; hasSubmitted?: boolean }): boolean {
    return s.phase === 'GUESSING' && s.hasSubmitted === false;
}

const WaitingPage: React.FC = () => {
    const { roomCode } = useParams<{ roomCode: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const userId = user?.id || localStorage.getItem('userId') || '';

    const { lobby, error: lobbyError } = useLobby(roomCode || '', userId);
    const sync = roomCode && userId ? { roomCode, userId } : undefined;
    const gameState = useGameState(lobby?.id, sync);

    const [phaseFromApi, setPhaseFromApi] = useState<string | null>(null);
    const prevWsPhaseRef = useRef<string | null>(null);

    useEffect(() => {
        if (lobbyError?.toLowerCase().includes('delete')) {
            navigate('/', { replace: true });
        }
    }, [lobbyError, navigate]);

    useEffect(() => {
        if (!roomCode || !userId) return;

        let cancelled = false;

        const check = async () => {
            try {
                const s = await getGameState(roomCode, userId);
                if (cancelled) return;

                if (s.phase) {
                    setPhaseFromApi(s.phase);
                }

                if (s.phase === 'RECAP') {
                    navigate(`/game/${roomCode}/countdown?phase=RECAP`, { replace: true });
                    return;
                }
                if (s.phase === 'VOTING') {
                    navigate(`/game/${roomCode}/countdown?phase=VOTING`, { replace: true });
                    return;
                }

                if (shouldRedirectToDraw(s)) {
                    sessionStorage.removeItem(PROMPT_WAIT_FLAG);
                    navigate(`/game/${roomCode}/countdown?phase=DRAWING`, { replace: true });
                    return;
                }
                if (shouldRedirectToGuess(s)) {
                    navigate(`/game/${roomCode}/countdown?phase=GUESSING`, { replace: true });
                    return;
                }
            } catch (e) {
                console.error('[WaitingPage] getGameState failed', e);
            }
        };

        void check();
        const id = setInterval(check, 2000);

        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [roomCode, userId, navigate]);

    useEffect(() => {
        if (!roomCode || !gameState.phase) return;
        const prev = prevWsPhaseRef.current;
        if (prev === 'GUESSING' && gameState.phase === 'DRAWING') {
            sessionStorage.removeItem(PROMPT_WAIT_FLAG);
            navigate(`/game/${roomCode}/countdown?phase=DRAWING`, { replace: true });
        } else if (prev === 'DRAWING' && gameState.phase === 'GUESSING') {
            navigate(`/game/${roomCode}/countdown?phase=GUESSING`, { replace: true });
        } else if (gameState.phase === 'RECAP' && prev !== 'RECAP') {
            navigate(`/game/${roomCode}/countdown?phase=RECAP`, { replace: true });
        } else if (gameState.phase === 'VOTING' && prev !== 'VOTING') {
            navigate(`/game/${roomCode}/countdown?phase=VOTING`, { replace: true });
        }
        prevWsPhaseRef.current = gameState.phase;
    }, [gameState.phase, roomCode, navigate]);

    const displayPhase = gameState.phase ?? phaseFromApi;

    return (
        <div className="flex flex-col justify-center items-center h-screen bg-gray-50">
            <Container 
                width='900px' 
                height='500px' 
                padding='5em' 
                className='flex flex-col justify-center items-center border-2 border-dark-grey rounded-lg bg-white shadow-xl gap-8'
            >
                <h1 className="text-heading-1">Waiting for other players...</h1>
                
                {displayPhase && (
                    <p className="text-heading-3 text-gray-600">
                        Current Phase: {displayPhase}
                    </p>
                )}
                
                {gameState.roundNumber > 0 && (
                    <p className="text-body">
                        Round {gameState.roundNumber}
                    </p>
                )}
                
                <div className="flex items-center justify-center gap-2">
                    <div className="animate-bounce w-3 h-3 bg-blue-500 rounded-full"></div>
                    <div className="animate-bounce w-3 h-3 bg-blue-500 rounded-full" style={{ animationDelay: '0.1s' }}></div>
                    <div className="animate-bounce w-3 h-3 bg-blue-500 rounded-full" style={{ animationDelay: '0.2s' }}></div>
                </div>
                
                <p className="text-body text-center max-w-md">
                    Please wait while other players complete their submissions.
                    You&apos;ll be redirected automatically when everyone is ready.
                </p>
            </Container>
        </div>
    );
};

export default WaitingPage;
