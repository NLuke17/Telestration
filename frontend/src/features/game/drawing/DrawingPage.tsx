import { ReactSketchCanvas } from 'react-sketch-canvas';
import type { ReactSketchCanvasRef } from 'react-sketch-canvas';
import { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Container from '../../../components/common/Container';
import ToolButton from '../../../components/game/ToolButton';
import { SlActionUndo, SlActionRedo, SlPencil } from 'react-icons/sl';
import { BsEraser } from 'react-icons/bs';
import { PiPalette } from 'react-icons/pi';
import PageCounter from '../../../components/game/PageCounter';
import TimerDisplay from '../../../components/game/TimerDisplay';
import ToolSizeIndicator from '../../../components/game/ToolSizeIndicator';
import Button from '../../../components/common/Button';
import { useGameState, usePhaseTimer, useLobby } from '../../../hooks/useGameState';
import { getAssignedFlipbook } from '../../../services/api/gameApi';
import { getGameState } from '../../../services/api/lobbyApi';
import { getWSClient } from '../../../services/ws/wsClient';
import { useAuth } from '../../../contexts/AuthContext';
import { useTheme } from '../../../contexts/ThemeContext';
import { DRAWING_CANVAS_HEIGHT, DRAWING_CANVAS_WIDTH } from '../../../constants/drawingCanvas';

import lightBg from '../../../assets/lightmode.jpg';
import darkBg from '../../../assets/darkmode.jpg';
import ColorModeButton from '../../../components/common/ColorModeButton';

const styles = {
    border: '0.0625rem solid #9c9c9c',
    borderRadius: '0.25rem',
};

/** Black, white, art primaries (RYB), green / orange / purple — order matches 5×2 / 2×5 grid flow. */
const HOT_BAR_COLORS = [
    { label: 'Black', hex: '#000000' },
    { label: 'White', hex: '#FFFFFF' },
    { label: 'Red', hex: '#E53935' },
    { label: 'Yellow', hex: '#FDD835' },
    { label: 'Blue', hex: '#1E88E5' },
    { label: 'Green', hex: '#43A047' },
    { label: 'Orange', hex: '#FB8C00' },
    { label: 'Purple', hex: '#8E24AA' },
] as const;

function toPickerHex(c: string): string {
    const s = c.trim();
    if (/^#[0-9a-fA-F]{6}$/i.test(s)) return s.toUpperCase();
    if (/^#[0-9a-fA-F]{3}$/i.test(s)) {
        const r = s[1];
        const g = s[2];
        const b = s[3];
        return (`#${r}${r}${g}${g}${b}${b}`).toUpperCase();
    }
    return '#000000';
}

const DrawingPage: React.FC = () => {
    const { theme } = useTheme();
    const { roomCode } = useParams<{ roomCode: string }>();
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
    const [penColor, setPenColor] = useState<string>('#000000');
    const customColorInputRef = useRef<HTMLInputElement>(null);

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
    const handleSubmitRef = useRef<(opts?: { fromTimer?: boolean }) => Promise<void>>(async () => { });
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
                setHasFinishedSubmit(false);
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

            const sent = gameState.submitDrawing(assignment.id, drawingData);
            if (!sent) {
                pendingFlipbookIdRef.current = null;
                setIsSubmitting(false);
                setError('Not connected — could not send drawing.');
                return;
            }

            // Treat send as success for UI; server ack/error still clears pending and rolls back on failure.
            setHasFinishedSubmit(true);
            setAllowLocalEdit(false);
            setIsSubmitting(false);

            submitTimeoutRef.current = window.setTimeout(() => {
                submitTimeoutRef.current = null;
                if (pendingFlipbookIdRef.current === assignment.id) {
                    pendingFlipbookIdRef.current = null;
                    setHasFinishedSubmit(false);
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
    const playerTotal = lobby?.players.length ?? 0;
    const pp = gameState.phaseProgress;
    const counterPageNum = pp
        ? String(pp.submitted)
        : String(
            gameState.chainWave != null && playerTotal > 0
                ? Math.min(gameState.chainWave + 1, playerTotal)
                : gameState.roundNumber || 1
        );
    const counterTotal = pp
        ? String(pp.expected)
        : String(
            playerTotal > 0
                ? playerTotal
                : gameState.maxChainWave != null && gameState.maxChainWave > 0
                    ? gameState.maxChainWave + 1
                    : 4
        );
    const counterCaption = pp ? 'Submitted' : undefined;

    const isCanvasLocked = hasFinishedSubmit && !allowLocalEdit;

    const penNorm = toPickerHex(penColor);
    const usesCustomColor = !HOT_BAR_COLORS.some((c) => toPickerHex(c.hex) === penNorm);

    return (
        <div
            className="box-border flex min-h-screen w-full flex-col items-center justify-center gap-6 px-3 py-20 sm:gap-8 sm:px-5 sm:py-16"
            style={{ backgroundImage: `url(${theme === 'dark' ? darkBg : lightBg})` }}
        >
            <ColorModeButton />
            <Container
                width="900px"
                height="auto"
                padding="2em"
                className="flex flex-col items-center justify-center rounded-lg border-2 border-dark-grey"
            >
                <div className="flex w-full flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <PageCounter
                        pageNum={counterPageNum}
                        totalPages={counterTotal}
                        caption={counterCaption}
                        className="dark:text-dark-mode-text-1 whitespace-nowrap text-heading-3"
                    />
                    {/* Heading */}
                    <div className='flex flex-col flex-1 items-center text-center'>
                        <div className='dark:text-dark-mode-text-1 text-heading-3'>Hey, it's time to draw!</div>
                        <div className='dark:text-dark-mode-text-1 text-display-prompt'>{promptToDisplay}</div>
                        {isCanvasLocked && (
                            <p className="text-body mt-2 max-w-md text-gray-600 dark:text-dark-mode-text-2">
                                Waiting for other players. You&apos;ll continue automatically when everyone is done.
                            </p>
                        )}
                    </div>
                    <TimerDisplay
                        minutesLeft={timer.minutes.toString().padStart(2, '0')}
                        secondsLeft={timer.seconds.toString().padStart(2, '0')}
                        className='whitespace-nowrap dark:text-dark-mode-text-1 text-heading-3'
                    />
                </div>
                {/* Color buttons */}
                <div
                    className={`relative flex w-full max-w-full flex-col items-center justify-center gap-4 lg:flex-row lg:gap-4 ${isCanvasLocked ? 'pointer-events-none opacity-70' : ''}`}
                >
                    <div className="grid w-full max-w-[min(100%,32rem)] grid-cols-5 grid-rows-2 gap-1.5 justify-items-stretch sm:gap-2 md:max-w-[11rem] md:grid-cols-2 md:grid-rows-5 md:gap-x-1 md:gap-y-2 lg:w-full lg:max-w-[11rem]">
                        <input
                            ref={customColorInputRef}
                            type="color"
                            className="sr-only"
                            value={penNorm}
                            aria-label="Custom pen color"
                            onChange={(e) => {
                                setPenColor(toPickerHex(e.target.value));
                                canvasRef.current?.eraseMode(false);
                                setSelectedTool('pen');
                            }}
                        />
                        {HOT_BAR_COLORS.map(({ label, hex }) => {
                            const active = penNorm === toPickerHex(hex);
                            const isWhite = toPickerHex(hex) === '#FFFFFF';
                            return (
                            
                                <button
                                    key={hex}
                                    type="button"
                                    aria-pressed={active}
                                    aria-label={`${label} (${hex})`}
                                    onClick={() => {
                                        setPenColor(toPickerHex(hex));
                                        canvasRef.current?.eraseMode(false);
                                        setSelectedTool('pen');
                                    }}
                                    className={`flex aspect-square w-full max-w-[2.75rem] justify-self-center rounded-md border-2 p-0.5 transition-shadow md:max-w-[2.85rem] ${active
                                        ? 'border-indigo-500 ring-2 ring-indigo-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-950'
                                        : `border-dark-grey ${isWhite ? 'ring-1 ring-gray-300 dark:ring-gray-500' : ''}`
                                        }`}
                                >
                                    <span
                                        className={`block h-full min-h-0 w-full rounded-sm border shadow-inner ${isWhite ? 'border-gray-300' : 'border-black/25'}`}
                                        style={{ backgroundColor: hex }}
                                    />
                                </button>
                            );
                        })}
                        <div
                            className="flex aspect-square w-full max-w-[2.75rem] flex-col justify-self-center overflow-hidden rounded-md border-2 border-indigo-500 bg-gray-100 shadow-inner dark:border-indigo-400 dark:bg-gray-800 md:max-w-[2.85rem]"
                            title={`Current pen color ${penNorm}`}
                            aria-label={`Current pen color ${penNorm}`}
                        >
                            <span className="shrink-0 bg-indigo-500/90 px-1 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-white dark:bg-indigo-600/90">
                                Now
                            </span>
                            <div className="min-h-0 w-full flex-1" style={{ backgroundColor: penColor }} />
                        </div>
                        <button
                            type="button"
                            aria-pressed={usesCustomColor}
                            aria-label="Custom color"
                            title="Custom color"
                            onClick={() => customColorInputRef.current?.click()}
                            className={`flex aspect-square w-full max-w-[2.75rem] items-center justify-center justify-self-center rounded-md border-2 border-dark-grey bg-white text-brand-charcoal hover:bg-slate-50 dark:bg-gray-900 dark:text-dark-mode-text-1 dark:hover:bg-gray-800 md:max-w-[2.85rem] ${usesCustomColor
                                ? 'border-indigo-500 ring-2 ring-indigo-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-950'
                                : ''
                                }`}
                        >
                            <PiPalette size={22} aria-hidden />
                        </button>
                    </div>
                    {/* Canvas */}
                    <ReactSketchCanvas
                        style={styles}
                        width={`${DRAWING_CANVAS_WIDTH}px`}
                        height={`${DRAWING_CANVAS_HEIGHT}px`}
                        strokeWidth={selectedSize}
                        eraserWidth={selectedSize}
                        strokeColor={penColor}
                        ref={canvasRef}
                    />
                    {/* Tools */}
                    <div className="flex flex-row flex-wrap justify-center gap-2 lg:flex-col lg:flex-nowrap lg:gap-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-dark-mode-text-2 ml-1">Drawing Tools</span>
                        <ToolButton key='undo' icon={<SlActionUndo size={30} />} aria-label="Undo" onClick={() => {
                            canvasRef.current?.undo()
                        }} />
                        <ToolButton key='redo' icon={<SlActionRedo size={30} />} aria-label="Redo" onClick={() => {
                            canvasRef.current?.redo()
                        }} />
                        <ToolButton key='pen' icon={<SlPencil size={30} />} isActive={selectedTool === 'pen'} aria-label="Pen tool" onClick={() => {
                            canvasRef.current?.eraseMode(false)
                            setSelectedTool('pen')
                        }} />
                        <ToolButton key='eraser' icon={<BsEraser size={30} />} isActive={selectedTool === 'eraser'} aria-label="Eraser tool" onClick={() => {
                            canvasRef.current?.eraseMode(true)
                            setSelectedTool('eraser')
                        }} />
                    </div>
                </div>
            </Container>
            {/* Tool size indicators */}
            <div className="flex w-full max-w-[900px] flex-col items-stretch justify-between gap-4 px-1 sm:flex-row sm:items-center sm:px-2">
                    <div className="flex flex-row gap-2 rounded-lg border border-dark-grey bg-mid-grey px-[20px] py-[15px] dark:border-dark-mode-border dark:bg-dark-mode-input-background/20">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-dark-mode-text-2 ml-1">Brush Size</span>
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
