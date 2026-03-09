import React, { useState, useEffect } from 'react';
import Container from '../../../components/common/Container';
import InputField from '../../../components/common/InputField';
import Button from '../../../components/common/Button';
import PageCounter from '../../../components/game/PageCounter';
import TimerDisplay from '../../../components/game/TimerDisplay';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameState, usePhaseTimer } from '../../../hooks/useGameState';
import { getAssignedFlipbook } from '../../../services/api/gameApi';

const WritingPage: React.FC = () => {
    const { roomCode } = useParams<{ roomCode: string }>();
    const navigate = useNavigate();
    const [sentence, setSentence] = useState('');
    
    // Get userId from localStorage
    const userId = localStorage.getItem('userId') || '';
    
    // Game state
    const gameState = useGameState();
    const timer = usePhaseTimer(gameState.phaseEndsAt);
    
    // Assignment state
    const [assignment, setAssignment] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch assignment when component mounts
    useEffect(() => {
        const fetchAssignment = async () => {
            if (!gameState.roundId || !userId) return;
            
            try {
                setIsLoading(true);
                const result = await getAssignedFlipbook(gameState.roundId, userId, 'GUESSING');
                
                if (result.assigned && result.flipbook) {
                    setAssignment(result.flipbook);
                } else {
                    setError(result.message || 'No assignment available');
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
        }
    }, [gameState.roundId, gameState.phase, userId]);

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

        try {
            setIsSubmitting(true);
            
            // Submit via WebSocket
            gameState.submitGuess(assignment.id, sentence.trim());
            
            console.log('Guess submitted successfully');
            
            // Navigate to waiting page
            navigate(`/game/${roomCode}/waiting`);
        } catch (err: any) {
            console.error('Failed to submit guess:', err);
            setError(err.message || 'Failed to submit guess');
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

    const currentPage = gameState.roundNumber || 1;
    const totalPages = 4; // This should come from game config

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
                <div className="text-heading-1">What did you see?</div>
                <div className="flex items-center justify-center w-full gap-8">
                    <InputField 
                        id='sentence'
                        label=""
                        placeholder="Type your guess here!"
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
