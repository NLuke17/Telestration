import { ReactSketchCanvas } from 'react-sketch-canvas';
import type { ReactSketchCanvasRef } from 'react-sketch-canvas';
import { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Container from '../../../components/common/Container';
import ToolButton from '../../../components/game/ToolButton';
import ColorButton from '../../../components/game/ColorButton';
import { SlActionUndo, SlActionRedo, SlPencil } from "react-icons/sl";
import { BsEraser } from "react-icons/bs";
import PageCounter from '../../../components/game/PageCounter';
import TimerDisplay from '../../../components/game/TimerDisplay';
import ToolSizeIndicator from '../../../components/game/ToolSizeIndicator';
import Button from '../../../components/common/Button';
import { useGameState, usePhaseTimer, useLobby } from '../../../hooks/useGameState';
import { getAssignedFlipbook } from '../../../services/api/gameApi';
import { getGameState } from '../../../services/api/lobbyApi';
import { getWSClient } from '../../../services/ws/wsClient';
import { useAuth } from '../../../contexts/AuthContext';

const styles = {
  border: '0.0625rem solid #9c9c9c',
  borderRadius: '0.25rem',
};

const DrawingPage: React.FC = () => {
    const { roomCode } = useParams<{ roomCode: string}>();
    const navigate = useNavigate();
    const canvasRef = useRef<ReactSketchCanvasRef>(null);
    const prevPhaseRef = useRef<'DRAWING' | 'GUESSING' | 'RECAP' | 'VOTING' | null>(null);
    const { user } = useAuth();

    useEffect(() => {
        sessionStorage.removeItem('telestration.expectDrawAfterPromptWait');
    }, []);
    
    // Get userId from auth context or localStorage for guest users
    const userId = user?.id || localStorage.getItem('userId') || '';

    // First, get lobby to get lobbyId
    const { lobby, error: lobbyError, isConnected } = useLobby(roomCode || '', userId);
    const sync = roomCode && userId ? { roomCode, userId } : undefined;
    
    // Canvas state
    const [penColor, setPenColor] = useState("#000000");
    const [selectedSize, setSelectedSize] = useState(5);
    const [selectedTool, setSelectedTool] = useState('pen');
    const sizes = [5, 10, 15, 20, 25, 30];
    
    // Game state - pass lobbyId to useGameState
    const gameState = useGameState(lobby?.id, sync);
    const timer = usePhaseTimer(gameState.phaseEndsAt);

    useEffect(() => {
        const prev = prevPhaseRef.current;
        if (
            prev === 'DRAWING' &&
            gameState.phase &&
            gameState.phase !== 'DRAWING' &&
            (gameState.phase === 'GUESSING' ||
                gameState.phase === 'RECAP' ||
                gameState.phase === 'VOTING') &&
            roomCode
        ) {
            navigate(`/game/${roomCode}/countdown?phase=${gameState.phase}`, { replace: true });
        }
        prevPhaseRef.current = gameState.phase;
    }, [gameState.phase, roomCode, navigate]);

    useEffect(() => {
        if (lobbyError?.toLowerCase().includes('delete')) {
            navigate('/', { replace: true });
        }
    }, [lobbyError, navigate]);
    
    // Assignment state
    const [assignment, setAssignment] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** Submitted for this phase; waiting on others until the server advances. */
    const [hasFinishedSubmit, setHasFinishedSubmit] = useState(false);
    /** User chose to edit again after submitting (local only until they press Done). */
    const [allowLocalEdit, setAllowLocalEdit] = useState(false);
    const pendingFlipbookIdRef = useRef<string | null>(null);
    const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const optimisticRevokeRef = useRef(false);
    const handleSubmitRef = useRef<(opts?: { fromTimer?: boolean }) => Promise<void>>(async () => {});
    const timeUpAutoSubmitRef = useRef(false);

    useEffect(() => {
        setHasFinishedSubmit(false);
        setAllowLocalEdit(false);
        pendingFlipbookIdRef.current = null;
        optimisticRevokeRef.current = false;
        timeUpAutoSubmitRef.current = false;
        if (submitTimeoutRef.current) {
            clearTimeout(submitTimeoutRef.current);
            submitTimeoutRef.current = null;
        }
    }, [gameState.chainWave, gameState.roundId, gameState.phaseEndsAt]);

    useEffect(() => {
        if (!isConnected || !userId) return;
        const client = getWSClient();
        const unsubDraw = client.subscribe<{
            type: 'game:drawing_submitted';
            flipbookId: string;
            userId: string;
        }>('game:drawing_submitted', (msg) => {
            if (msg.userId !== userId || msg.flipbookId !== pendingFlipbookIdRef.current) {
                return;
            }
            if (submitTimeoutRef.current) {
                clearTimeout(submitTimeoutRef.current);
                submitTimeoutRef.current = null;
            }
            pendingFlipbookIdRef.current = null;
            setHasFinishedSubmit(true);
            setAllowLocalEdit(false);
            setIsSubmitting(false);
        });
        const unsubRevoked = client.subscribe<{
            type: 'game:submission_revoked';
            flipbookId: string;
            userId: string;
        }>('game:submission_revoked', (msg) => {
            if (msg.userId !== userId) return;
            optimisticRevokeRef.current = false;
        });
        const unsubErr = client.subscribe<{ type: 'error'; error: string; message?: string }>(
            'error',
            (msg) => {
                if (msg.error === 'REVOKE_SUBMISSION_FAILED' && optimisticRevokeRef.current) {
                    optimisticRevokeRef.current = false;
                    setHasFinishedSubmit(true);
                    setAllowLocalEdit(false);
                    setError(msg.message || 'Could not unlock for editing');
                    return;
                }
                if (msg.error !== 'DRAWING_SUBMISSION_FAILED' || !pendingFlipbookIdRef.current) {
                    return;
                }
                if (submitTimeoutRef.current) {
                    clearTimeout(submitTimeoutRef.current);
                    submitTimeoutRef.current = null;
                }
                pendingFlipbookIdRef.current = null;
                setIsSubmitting(false);
                setError(msg.message || 'Drawing submission failed');
            }
        );
        return () => {
            unsubDraw();
            unsubRevoked();
            unsubErr();
        };
    }, [isConnected, userId]);

    // Fetch assignment when component mounts
    useEffect(() => {
        const fetchAssignment = async () => {
            if (!gameState.roundId || !userId || !roomCode) return;

            try {
                setIsLoading(true);
                setError(null);
                const result = await getAssignedFlipbook(gameState.roundId, userId, 'DRAWING');

                if (result.assigned && result.flipbook) {
                    setAssignment(result.flipbook);
                    const state = await getGameState(roomCode, userId);
                    if (state.phase === 'DRAWING' && state.hasSubmitted) {
                        setHasFinishedSubmit(true);
                        setAllowLocalEdit(false);
                    }
                } else {
                    const state = await getGameState(roomCode, userId);
                    if (state.phase !== 'DRAWING') {
                        if (
                            roomCode &&
                            (state.phase === 'GUESSING' ||
                                state.phase === 'RECAP' ||
                                state.phase === 'VOTING')
                        ) {
                            navigate(`/game/${roomCode}/countdown?phase=${state.phase}`, {
                                replace: true,
                            });
                            return;
                        }
                        setError(result.message || 'No assignment available');
                        return;
                    }
                    if (state.hasSubmitted && state.workFlipbookId) {
                        setAssignment({
                            id: state.workFlipbookId,
                            prompt: state.assignedPrompt || '',
                            drawFromText:
                                state.workFlipbookDrawFromText ||
                                state.assignedPrompt ||
                                'Draw something!',
                        });
                        setHasFinishedSubmit(true);
                        setAllowLocalEdit(false);
                    } else {
                        setError(result.message || 'No assignment available');
                    }
                }
            } catch (err: any) {
                console.error('Failed to fetch assignment:', err);
                setError(err.message || 'Failed to load assignment');
            } finally {
                setIsLoading(false);
            }
        };

        if (gameState.roundId && gameState.phase === 'DRAWING') {
            void fetchAssignment();
        }
    }, [gameState.roundId, gameState.phase, userId, roomCode]);

    // Handle phase complete - navigate to waiting or next phase
    useEffect(() => {
        if (gameState.isPhaseComplete) {
            // Phase is complete, show waiting screen or navigate
            console.log('Drawing phase complete');
        }
    }, [gameState.isPhaseComplete]);

    const handleSubmit = async (opts?: { fromTimer?: boolean }) => {
        if (!canvasRef.current || !assignment || !userId) {
            console.error('Missing required data for submission');
            return;
        }
        if (!opts?.fromTimer && !isConnected) {
            setError('Not connected — please wait a moment and try again.');
            return;
        }
        if (opts?.fromTimer && !isConnected) {
            return;
        }

        try {
            setError(null);
            const paths = await canvasRef.current.exportPaths();
            const drawingData = JSON.stringify(paths);

            if (submitTimeoutRef.current) {
                clearTimeout(submitTimeoutRef.current);
            }
            pendingFlipbookIdRef.current = assignment.id;
            setIsSubmitting(true);

            gameState.submitDrawing(assignment.id, drawingData);

            submitTimeoutRef.current = window.setTimeout(() => {
                submitTimeoutRef.current = null;
                if (pendingFlipbookIdRef.current === assignment.id) {
                    pendingFlipbookIdRef.current = null;
                    setIsSubmitting(false);
                    setError('No confirmation from server. Check your connection and try again.');
                }
            }, 20000);
        } catch (err: any) {
            console.error('Failed to submit drawing:', err);
            pendingFlipbookIdRef.current = null;
            setError(err.message || 'Failed to submit drawing');
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        handleSubmitRef.current = handleSubmit;
    });

    useEffect(() => {
        if (!gameState.phaseEndsAt || !timer.isExpired || gameState.phase !== 'DRAWING') {
            return;
        }
        if (!assignment || hasFinishedSubmit || isSubmitting) {
            return;
        }
        if (timeUpAutoSubmitRef.current) {
            return;
        }
        timeUpAutoSubmitRef.current = true;
        void handleSubmitRef.current({ fromTimer: true });
    }, [
        timer.isExpired,
        gameState.phaseEndsAt,
        gameState.phase,
        assignment,
        hasFinishedSubmit,
        isSubmitting,
    ]);

    const handleEditDrawing = () => {
        if (!assignment?.id || !isConnected) {
            setError('Not connected — cannot unlock yet.');
            return;
        }
        setError(null);
        optimisticRevokeRef.current = true;
        getWSClient().send('game:revoke_submission', { flipbookId: assignment.id });
        setAllowLocalEdit(true);
        setHasFinishedSubmit(false);
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

    // Get the prompt to display
    const promptToDisplay =
        (assignment as { drawFromText?: string }).drawFromText ||
        assignment.prompt ||
        'Draw something!';
    const currentPage =
        gameState.chainWave != null && gameState.maxChainWave != null && gameState.maxChainWave > 0
            ? Math.min(gameState.chainWave, gameState.maxChainWave)
            : gameState.roundNumber || 1;
    const totalPages =
        gameState.maxChainWave != null && gameState.maxChainWave > 0 ? gameState.maxChainWave : 4;

    const isCanvasLocked = hasFinishedSubmit && !allowLocalEdit;

    return (
        <div className="flex flex-col justify-center items-center gap-8 h-screen">
            <Container width='900px' height='auto' padding='2em' className='flex items-center justify-center border-2 border-dark-grey rounded-lg flex-col'>
                <div className='flex w-full justify-between'>
                    <PageCounter pageNum={currentPage.toString()} totalPages={totalPages.toString()} className='text-heading-3'/>
                    {/* Heading */}
                    <div className='flex flex-col text-center'>
                        <div className='text-heading-3'>Hey, it's time to draw!</div>
                        <div className='text-display-prompt'>{promptToDisplay}</div>
                        {isCanvasLocked && (
                            <p className="text-body text-gray-600 mt-2 max-w-md">
                                Waiting for other players. You&apos;ll continue automatically when everyone is done.
                            </p>
                        )}
                    </div> 
                    <TimerDisplay 
                        minutesLeft={timer.minutes.toString().padStart(2, '0')} 
                        secondsLeft={timer.seconds.toString().padStart(2, '0')} 
                        className='text-heading-3'
                    />
                </div>
                {/* Color buttons */}
                <div
                    className={`flex flex-row gap-6 justify-center items-center relative ${
                        isCanvasLocked ? 'pointer-events-none opacity-70' : ''
                    }`}
                >
                    <div className="flex flex-col gap-4">
                        <ColorButton color='black' size='30' aria-label="select black color" onClick={() => {
                            setPenColor('#000000')
                            canvasRef.current?.eraseMode(false)
                            setSelectedTool('pen')
                        }}/>
                        <ColorButton color='#0088FF' size='30' aria-label="select blue color" onClick={() => {
                            setPenColor('#0088FF')
                            canvasRef.current?.eraseMode(false)
                            setSelectedTool('pen')
                        }}/>
                        <ColorButton color='#FF383C' size='30' aria-label="select red color" onClick={() => {
                            setPenColor('#FF383C')
                            canvasRef.current?.eraseMode(false)
                            setSelectedTool('pen')
                        }}/>
                        <ColorButton color='#FFCC00' size='30' aria-label="select yellow color" onClick={() => {
                            setPenColor('#FFCC00')
                            canvasRef.current?.eraseMode(false)
                            setSelectedTool('pen')
                        }}/>
                        <ColorButton color='#ffffff' size='30' aria-label="select white color" onClick={() => {
                            setPenColor('#ffffff')
                            canvasRef.current?.eraseMode(false)
                            setSelectedTool('pen')
                        }}/>
                    </div>
                    {/* Canvas */}
                    <ReactSketchCanvas
                        style={styles}
                        width="600px"
                        height="360px"
                        strokeWidth={selectedSize}
                        eraserWidth={selectedSize}
                        strokeColor={penColor}
                        ref={canvasRef}
                    />
                    {/* Tools */}
                    <div className="flex flex-col">
                        <ToolButton key='undo' icon={<SlActionUndo size={30} />} aria-label="Undo" onClick={() => {
                            canvasRef.current?.undo()
                            }}/>
                        <ToolButton key='redo' icon={<SlActionRedo size={30} />} aria-label="Redo" onClick={() => {
                            canvasRef.current?.redo()
                            }}/>
                        <ToolButton key='pen' icon={<SlPencil size={30} />} isActive={selectedTool === 'pen'} aria-label="Pen tool" onClick={() => {
                            canvasRef.current?.eraseMode(false)
                            setSelectedTool('pen')
                            }}/>
                        <ToolButton key='eraser' icon={<BsEraser size={30} />} isActive={selectedTool === 'eraser'} aria-label="Eraser tool" onClick={() => {
                            canvasRef.current?.eraseMode(true)
                            setSelectedTool('eraser')
                            }} />
                    </div>
                </div>
            </Container>
            {/* Tool size indicators */}
            <div 
                style={{
                    width: "100%",
                    maxWidth: "900px",
                }}
                className='flex flex-row justify-between items-center'
            >
                <div className="flex flex-row gap-2 bg-mid-grey rounded-lg px-[20px] py-[15px] border border-dark-grey">
                    {sizes.map((size) => (
                        <ToolSizeIndicator 
                            key={size}
                            toolSize={size} 
                            variant={selectedSize === size ? 'active' : 'default'}
                            onClick={() => {
                                setSelectedSize(size);
                            }}
                        />
                    ))}
                </div>
                <div className="flex flex-row items-center gap-3">
                    {hasFinishedSubmit && !allowLocalEdit && (
                        <Button
                            label="Edit drawing"
                            onClick={handleEditDrawing}
                            disabled={isSubmitting}
                        />
                    )}
                    {(!hasFinishedSubmit || allowLocalEdit) && (
                        <Button
                            label={isSubmitting ? 'Submitting...' : 'Done'}
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default DrawingPage;
