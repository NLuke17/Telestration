import React, { useState, useEffect, useRef } from 'react';
import Container from '../../../components/common/Container';
import InputField from '../../../components/common/InputField';
import Button from '../../../components/common/Button';
import PageCounter from '../../../components/game/PageCounter';
import TimerDisplay from '../../../components/game/TimerDisplay';
import { useParams, useNavigate } from 'react-router-dom';
import { useGameState, usePhaseTimer, useLobby } from '../../../hooks/useGameState';
import {
    getAssignedFlipbook,
    getFlipbookPresentation,
    submitGuess as submitGuessViaHttp,
} from '../../../services/api/gameApi';
import { getGameState } from '../../../services/api/lobbyApi';
import { getWSClient } from '../../../services/ws/wsClient';
import { useAuth } from '../../../contexts/AuthContext';
import { AnimatedSketchDisplay } from '../../../components/game/AnimatedSketchDisplay';
import { useTheme } from '../../../contexts/ThemeContext';

import lightBg from '../../../assets/lightmode.jpg';
import darkBg from '../../../assets/darkmode.jpg';
import ColorModeButton from '../../../components/common/ColorModeButton';

const WritingPage: React.FC = () => {
    const { theme, toggleTheme } = useTheme();
    const { roomCode } = useParams<{ roomCode: string }>();
    const navigate = useNavigate();
    const [sentence, setSentence] = useState('');
    const { user } = useAuth();

    // Get userId from auth context or localStorage for guest users
    const userId = user?.id || localStorage.getItem('userId') || '';

    // First, get lobby to get lobbyId
    const { lobby, error: lobbyError, isConnected } = useLobby(roomCode || '', userId);
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
    const [hasFinishedSubmit, setHasFinishedSubmit] = useState(false);
    const [allowLocalEdit, setAllowLocalEdit] = useState(false);
    const pendingFlipbookIdRef = useRef<string | null>(null);
    const submitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const optimisticRevokeRef = useRef(false);
    const handleSubmitRef = useRef<(opts?: { fromTimer?: boolean }) => Promise<void>>(async () => { });
    const timeUpAutoSubmitRef = useRef(false);

    useEffect(() => {
        if (gameState.phase === 'DRAWING' && roomCode) {
            navigate(`/game/${roomCode}/countdown?phase=DRAWING`, { replace: true });
        }
        if (gameState.phase === 'RECAP' && roomCode) {
            navigate(`/game/${roomCode}/countdown?phase=RECAP`, { replace: true });
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
        const unsubGuess = client.subscribe<{
            type: 'game:guess_submitted';
            flipbookId: string;
            userId: string;
        }>('game:guess_submitted', (msg) => {
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
                if (
                    (msg.error !== 'GUESS_SUBMISSION_FAILED' &&
                        msg.error !== 'INITIAL_PROMPT_ALREADY_SUBMITTED') ||
                    !pendingFlipbookIdRef.current
                ) {
                    return;
                }
                if (submitTimeoutRef.current) {
                    clearTimeout(submitTimeoutRef.current);
                    submitTimeoutRef.current = null;
                }
                pendingFlipbookIdRef.current = null;
                setIsSubmitting(false);
                setError(msg.message || 'Could not submit');
            }
        );
        return () => {
            unsubGuess();
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
                const result = await getAssignedFlipbook(gameState.roundId, userId, 'GUESSING');

                if (result.assigned && result.flipbook) {
                    setAssignment(result.flipbook);
                    const hasEmptyPrompt = !result.flipbook.prompt || result.flipbook.prompt.trim().length === 0;
                    setIsInitialPrompt(hasEmptyPrompt);
                } else {
                    const state = await getGameState(roomCode, userId);
                    if (state.phase !== 'GUESSING') {
                        if (roomCode) {
                            if (state.phase === 'DRAWING') {
                                navigate(`/game/${roomCode}/countdown?phase=DRAWING`, { replace: true });
                            } else if (state.phase === 'RECAP') {
                                navigate(`/game/${roomCode}/countdown?phase=RECAP`, { replace: true });
                            } else if (state.phase === 'VOTING') {
                                navigate(`/game/${roomCode}/countdown?phase=VOTING`, { replace: true });
                            }
                        }
                        return;
                    }
                    const mine = state.flipbooks?.find((f) => f.authorId === userId);
                    if (mine?.prompt?.trim()) {
                        setIsInitialPrompt(true);
                        setAssignment({
                            id: mine.id,
                            prompt: mine.prompt || '',
                            isOwn: true,
                        });
                        setSentence(mine.prompt.trim());
                        setHasFinishedSubmit(true);
                        setAllowLocalEdit(false);
                        return;
                    }
                    if (state.hasSubmitted && state.workFlipbookId) {
                        let latestDrawingData: string | null = null;
                        const cw = state.chainWave ?? 0;
                        if (cw > 0) {
                            try {
                                const pres = await getFlipbookPresentation(state.workFlipbookId, userId);
                                const last = [...pres.timeline].reverse().find((e) => e.kind === 'drawing');
                                latestDrawingData =
                                    last?.kind === 'drawing' ? last.drawingData : null;
                            } catch {
                                latestDrawingData = null;
                            }
                        }
                        setAssignment({
                            id: state.workFlipbookId,
                            prompt: state.assignedPrompt || '',
                            latestDrawingData,
                        });
                        setIsInitialPrompt(false);
                        setHasFinishedSubmit(true);
                        setAllowLocalEdit(false);
                        setSentence('');
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
                }
            } catch (err: any) {
                console.error('Failed to fetch assignment:', err);
                setError(err.message || 'Failed to load assignment');
            } finally {
                setIsLoading(false);
            }
        };

        if (gameState.roundId && gameState.phase === 'GUESSING') {
            void fetchAssignment();
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

    const handleSubmit = async (opts?: { fromTimer?: boolean }) => {
        if (!assignment || !userId || !sentence.trim()) {
            console.error('Missing required data for submission');
            return;
        }
        if (!assignment.id) {
            setError('Missing flipbook; please refresh the page.');
            return;
        }
        if (!opts?.fromTimer && !isConnected) {
            setError('Not connected — please wait a moment and try again.');
            return;
        }

        const text = sentence.trim();

        if (opts?.fromTimer) {
            timeUpAutoSubmitRef.current = true;
        }

        if (opts?.fromTimer && !isConnected) {
            try {
                setError(null);
                setIsSubmitting(true);
                await submitGuessViaHttp(assignment.id, userId, text);
                if (isInitialPrompt) {
                    sessionStorage.setItem('telestration.expectDrawAfterPromptWait', '1');
                }
                setHasFinishedSubmit(true);
                setAllowLocalEdit(false);
            } catch (err: any) {
                timeUpAutoSubmitRef.current = false;
                console.error('Failed to submit guess (HTTP):', err);
                setError(err.message || 'Failed to submit guess');
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        try {
            setError(null);
            if (submitTimeoutRef.current) {
                clearTimeout(submitTimeoutRef.current);
            }
            pendingFlipbookIdRef.current = assignment.id;
            setIsSubmitting(true);

            gameState.submitGuess(assignment.id, text);

            if (isInitialPrompt) {
                sessionStorage.setItem('telestration.expectDrawAfterPromptWait', '1');
            }

            submitTimeoutRef.current = window.setTimeout(() => {
                submitTimeoutRef.current = null;
                if (pendingFlipbookIdRef.current === assignment.id) {
                    pendingFlipbookIdRef.current = null;
                    setIsSubmitting(false);
                    setError('No confirmation from server. Check your connection and try again.');
                }
            }, 20000);
        } catch (err: any) {
            console.error('Failed to submit guess:', err);
            pendingFlipbookIdRef.current = null;
            if (opts?.fromTimer) {
                timeUpAutoSubmitRef.current = false;
            }
            setError(err.message || 'Failed to submit guess');
            setIsSubmitting(false);
        }
    };

    useEffect(() => {
        handleSubmitRef.current = handleSubmit;
    });

    useEffect(() => {
        if (!gameState.phaseEndsAt || !timer.isExpired || gameState.phase !== 'GUESSING') {
            return;
        }
        if (!assignment || hasFinishedSubmit || isSubmitting) {
            return;
        }
        if (timeUpAutoSubmitRef.current) {
            return;
        }
        if (!sentence.trim()) {
            timeUpAutoSubmitRef.current = true;
            return;
        }
        void handleSubmitRef.current({ fromTimer: true });
    }, [
        timer.isExpired,
        gameState.phaseEndsAt,
        gameState.phase,
        assignment,
        hasFinishedSubmit,
        isSubmitting,
        sentence,
    ]);

    const handleEditWriting = () => {
        if (isInitialPrompt) {
            setAllowLocalEdit(true);
            return;
        }
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

    const currentPage =
        gameState.chainWave != null && gameState.maxChainWave != null && gameState.maxChainWave > 0
            ? Math.min(gameState.chainWave, gameState.maxChainWave)
            : gameState.roundNumber || 1;
    const totalPages =
        gameState.maxChainWave != null && gameState.maxChainWave > 0 ? gameState.maxChainWave : 4;

    const latestDrawing = !isInitialPrompt ? assignment.latestDrawingData : null;
    const isInputLocked = hasFinishedSubmit && !allowLocalEdit;

    return (
        <div
            className="box-border flex min-h-screen w-full items-center justify-center px-3 py-20 sm:px-5 sm:py-16"
            style={{ backgroundImage: `url(${theme === 'dark' ? darkBg : lightBg})` }}
        >
            <ColorModeButton />
            <Container
                width="920px"
                height="auto"
                padding="3em"
                className="flex min-h-0 flex-col justify-between gap-6 rounded-lg border-2 border-dark-grey sm:min-h-[420px] lg:min-h-[500px]"
            >
                <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <PageCounter
                        pageNum={currentPage.toString()}
                        totalPages={totalPages.toString()}
                        className="text-heading-3 dark:text-dark-mode-text-1"
                    />
                    <TimerDisplay
                        minutesLeft={timer.minutes.toString().padStart(2, '0')}
                        secondsLeft={timer.seconds.toString().padStart(2, '0')}
                        className="text-heading-3 dark:text-dark-mode-text-1"
                    />
                </div>
                <div className="flex flex-col items-center">
                    <div className="text-heading-1 text-light-mode-text-1 dark:text-dark-mode-text-1 text-center">
                        {isInitialPrompt ? 'Write your prompt!' : 'What did you see?'}
                    </div>

                    {isInputLocked && (
                        <p className="text-body text-center text-gray-600">
                            Waiting for other players. You&apos;ll continue automatically when everyone is done.
                        </p>
                    )}
                </div>

                {!isInitialPrompt && latestDrawing && (
                    <div className="flex flex-col gap-2 w-full">
                        <div className="text-xs uppercase text-gray-500">Drawing to describe</div>
                        <AnimatedSketchDisplay
                            drawingData={latestDrawing}
                            width="100%"
                            strokeDelayMs={85}
                        />
                    </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-center w-full gap-4">
                    <InputField
                        id="sentence"
                        label=""
                        placeholder={
                            isInitialPrompt
                                ? "e.g., 'A cat riding a skateboard'"
                                : 'Type your guess here!'
                        }
                        value={sentence}
                        onChange={setSentence}
                        disabled={isInputLocked}
                        className="w-full flex-1"
                    />
                    <div className="flex flex-row items-center gap-3 shrink-0">
                        {hasFinishedSubmit && !allowLocalEdit && (
                            <Button
                                label="Edit"
                                onClick={handleEditWriting}
                                disabled={isSubmitting}
                            />
                        )}
                        {(!hasFinishedSubmit || allowLocalEdit) && (
                            <Button
                                label={'Done'}
                                disabled={!(sentence.length > 0) || isSubmitting}
                                onClick={handleSubmit}
                            />
                        )}
                    </div>
                </div>
            </Container>
        </div>
    );
}

export default WritingPage;
