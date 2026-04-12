import React, { useState, useEffect, useRef } from 'react';
import Container from '../../../components/common/Container';
import InputField from '../../../components/common/InputField';
import Button from '../../../components/common/Button';
import PageCounter from '../../../components/game/PageCounter';
import TimerDisplay from '../../../components/game/TimerDisplay';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameState, usePhaseTimer, useLobby } from '../../../hooks/useGameState';
import { getAssignedFlipbook } from '../../../services/api/gameApi';
import { getGameState } from '../../../services/api/lobbyApi';
import { useAuth } from '../../../contexts/AuthContext';

const WritingPage: React.FC = () => {
    const { roomCode } = useParams<{ roomCode: string }>();
    const navigate = useNavigate();
    const [sentence, setSentence] = useState('');
    const { user } = useAuth();
    
    // Get userId from auth context or localStorage for guest users
    const userId = user?.id || localStorage.getItem('userId') || '';
    
    console.log('[WritingPage] userId:', userId);
    
    // First, get lobby to get lobbyId
    const { lobby, error: lobbyError } = useLobby(roomCode || '', userId);
    const sync = roomCode && userId ? { roomCode, userId } : undefined;
    
    // Game state - pass lobbyId to useGameState
    const gameState = useGameState(lobby?.id, sync);
    const timer = usePhaseTimer(gameState.phaseEndsAt);
    
    // Assignment state
    const [assignment, setAssignment] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isInitialPrompt, setIsInitialPrompt] = useState(false);
    const submitLockRef = useRef(false);

    useEffect(() => {
        if (gameState.phase === 'DRAWING' && roomCode) {
            navigate(`/game/${roomCode}/countdown?phase=DRAWING`, { replace: true });
        }
        if (gameState.phase === 'VOTING' && roomCode) {
            navigate(`/game/${roomCode}/countdown?phase=VOTING`, { replace: true });
        }
    }, [gameState.phase, roomCode, navigate]);

    useEffect(() => {
        if (lobbyError?.toLowerCase().includes('delete')) {
            navigate('/', { replace: true });
        }
    }, [lobbyError, navigate]);

    // Fetch assignment when component mounts
    useEffect(() => {
        const fetchAssignment = async () => {
            if (!gameState.roundId || !userId || !roomCode) return;
            
            try {
                setIsLoading(true);
                const result = await getAssignedFlipbook(gameState.roundId, userId, 'GUESSING');
                
                if (result.assigned && result.flipbook) {
                    setAssignment(result.flipbook);
                    // Check if the flipbook has an empty prompt (initial prompt writing)
                    const hasEmptyPrompt = !result.flipbook.prompt || result.flipbook.prompt.trim().length === 0;
                    setIsInitialPrompt(hasEmptyPrompt);
                    console.log('[WritingPage] Assignment received:', {
                        flipbookId: result.flipbook.id,
                        hasPrompt: !hasEmptyPrompt,
                        isInitialPrompt: hasEmptyPrompt
                    });
                } else {
                    const state = await getGameState(roomCode, userId);
                    if (state.phase !== 'GUESSING') {
                        if (roomCode) {
                            if (state.phase === 'DRAWING') {
                                navigate(`/game/${roomCode}/countdown?phase=DRAWING`, { replace: true });
                            } else if (state.phase === 'VOTING') {
                                navigate(`/game/${roomCode}/countdown?phase=VOTING`, { replace: true });
                            }
                        }
                        return;
                    }
                    const mine = state.flipbooks?.find((f) => f.authorId === userId);
                    if (mine?.prompt?.trim()) {
                        navigate(`/game/${roomCode}/waiting`, { replace: true });
                        return;
                    }
                    if (!mine?.id) {
                        setError('Could not find your flipbook in this round.');
                        return;
                    }
                    setIsInitialPrompt(true);
                    setAssignment({
                        id: mine.id,
                        prompt: mine.prompt || '',
                        isOwn: true,
                    });
                    console.log('[WritingPage] Initial prompt on own flipbook', { flipbookId: mine.id });
                }
            } catch (err: any) {
                console.error('Failed to fetch assignment:', err);
                setError(err.message || 'Failed to load assignment');
            } finally {
                setIsLoading(false);
            }
        };

        if (gameState.roundId && gameState.phase === 'GUESSING') {
            fetchAssignment();
        } else if (gameState.phase && gameState.phase !== 'GUESSING') {
            setIsLoading(false);
        }
    }, [gameState.roundId, gameState.phase, userId, roomCode, navigate]);

    // Handle phase complete
    useEffect(() => {
        if (gameState.isPhaseComplete) {
            console.log('Guessing phase complete');
        }
    }, [gameState.isPhaseComplete]);

    const handleSubmit = async () => {
        if (!assignment || !userId || !sentence.trim()) {
            console.error('Missing required data for submission');
            return;
        }
        if (!assignment.id) {
            setError('Missing flipbook; please refresh the page.');
            return;
        }
        if (submitLockRef.current) {
            return;
        }

        try {
            submitLockRef.current = true;
            setIsSubmitting(true);
            
            // Submit via WebSocket
            gameState.submitGuess(assignment.id, sentence.trim());
            
            console.log('Guess submitted successfully');

            if (isInitialPrompt) {
                sessionStorage.setItem('telestration.expectDrawAfterPromptWait', '1');
            }
            
            navigate(`/game/${roomCode}/waiting`, { replace: true });
        } catch (err: any) {
            console.error('Failed to submit guess:', err);
            setError(err.message || 'Failed to submit guess');
            submitLockRef.current = false;
        } finally {
            setIsSubmitting(false);
        }
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="flex flex-col justify-center items-center h-screen">
                <p className="text-heading-3">Loading assignment...</p>
            </div>
        );
    }

    // Error state
    if (error || !assignment) {
        return (
            <div className="flex flex-col justify-center items-center h-screen">
                <p className="text-heading-3 text-red-600">Error: {error || 'No assignment'}</p>
                <Button 
                    label="Back to Lobby" 
                    onClick={() => navigate(`/lobby/${roomCode}`)}
                    className="mt-4"
                />
            </div>
        );
    }

    const currentPage =
        gameState.chainWave != null && gameState.maxChainWave != null && gameState.maxChainWave > 0
            ? Math.min(gameState.chainWave, gameState.maxChainWave)
            : gameState.roundNumber || 1;
    const totalPages =
        gameState.maxChainWave != null && gameState.maxChainWave > 0 ? gameState.maxChainWave : 4;

    return (
        <div className="flex justify-center items-center h-screen">
            <Container width='900px' height='500px' padding='5em' className='flex flex-col justify-between items-center border-2 border-dark-grey rounded-lg'>
                <div className='flex w-full justify-between'>
                    <PageCounter pageNum={currentPage.toString()} totalPages={totalPages.toString()} className='text-heading-3'/>
                    <TimerDisplay 
                        minutesLeft={timer.minutes.toString().padStart(2, '0')} 
                        secondsLeft={timer.seconds.toString().padStart(2, '0')} 
                        className='text-heading-3'
                    />
                </div>
                <div className="text-heading-1">{isInitialPrompt ? 'Write your prompt!' : 'What did you see?'}</div>
                <div className="flex items-center justify-center w-full gap-8">
                    <InputField 
                        id='sentence'
                        label=""
                        placeholder={isInitialPrompt ? "e.g., 'A cat riding a skateboard'" : "Type your guess here!"}
                        value={sentence}
                        onChange={setSentence}
                        className='w-full'
                    />
                    <Button 
                        label={isSubmitting ? 'Submitting...' : 'Done'}
                        disabled={!(sentence.length > 0) || isSubmitting}
                        onClick={handleSubmit}
                    />
                </div>
            </Container>
        </div>
    );
}

export default WritingPage;
