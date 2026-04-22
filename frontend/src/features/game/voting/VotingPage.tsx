import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Container from '../../../components/common/Container';
import Button from '../../../components/common/Button';
import TimerDisplay from '../../../components/game/TimerDisplay';
import { AnimatedSketchDisplay } from '../../../components/game/AnimatedSketchDisplay';
import { useAuth } from '../../../contexts/AuthContext';
import { useGameState, useLobby, usePhaseTimer, useWebSocket } from '../../../hooks/useGameState';
import { getGameState } from '../../../services/api/lobbyApi';
import { getWSClient } from '../../../services/ws/wsClient';
import type { VoteFlipbookCard } from '../../../types/dto';
import { useTheme } from '../../../contexts/ThemeContext';

import lightBg from '../../../assets/lightmode.jpg';
import darkBg from '../../../assets/darkmode.jpg';
import ColorModeButton from '../../../components/common/ColorModeButton';

const VotingPage: React.FC = () => {
    const { theme } = useTheme();
    const { roomCode } = useParams<{ roomCode: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const userId = user?.id || localStorage.getItem('userId') || '';

    const { lobby, error: lobbyError, isConnected } = useLobby(roomCode || '', userId);
    const sync = roomCode && userId ? { roomCode, userId } : undefined;
    const gameState = useGameState(lobby?.id, sync);
    const timer = usePhaseTimer(gameState.phaseEndsAt);
    const ws = useWebSocket();

    const [cards, setCards] = useState<VoteFlipbookCard[]>([]);
    const [myFlipbookId, setMyFlipbookId] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [hasFinishedSubmit, setHasFinishedSubmit] = useState(false);
    const [allowLocalEdit, setAllowLocalEdit] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const timeUpAutoSubmitRef = useRef(false);
    const pendingVoteRef = useRef<string | null>(null);

    useEffect(() => {
        if (lobbyError?.toLowerCase().includes('delete')) {
            navigate('/', { replace: true });
        }
    }, [lobbyError, navigate]);

    const hydrate = useCallback(async () => {
        if (!roomCode || !userId) return;
        try {
            const s = await getGameState(roomCode, userId);
            if (s.state === 'FINISHED') {
                navigate(`/game/${roomCode}/results`, { replace: true });
                return;
            }
            if (s.state === 'IN_PROGRESS' && s.phase === 'RECAP') {
                navigate(`/game/${roomCode}/recap`, { replace: true });
                return;
            }
            if (s.state === 'IN_PROGRESS' && s.phase !== 'VOTING') {
                navigate(`/game/${roomCode}/waiting`, { replace: true });
                return;
            }
            setMyFlipbookId(s.myFlipbookId ?? null);
            setCards(s.voteFlipbooks ?? []);
            setHasFinishedSubmit(Boolean(s.hasSubmitted));
            if (s.hasSubmitted) {
                setAllowLocalEdit(false);
            }
        } catch (e) {
            console.error('[VotingPage] hydrate', e);
        }
    }, [roomCode, userId, navigate]);

    useEffect(() => {
        void hydrate();
        const id = window.setInterval(() => void hydrate(), 1500);
        return () => clearInterval(id);
    }, [hydrate]);

    useEffect(() => {
        if (!ws.isConnected) return;
        const client = getWSClient();
        const u1 = client.subscribe<{ type: 'game:voting_finished'; results: unknown }>(
            'game:voting_finished',
            () => {
                if (roomCode) {
                    navigate(`/game/${roomCode}/results`, { replace: true });
                }
            }
        );
        const u2 = client.subscribe<{ type: 'game:vote_submitted'; flipbookId: string; userId: string }>(
            'game:vote_submitted',
            (msg) => {
                if (msg.userId === userId) {
                    setIsSubmitting(false);
                    pendingVoteRef.current = null;
                    setHasFinishedSubmit(true);
                    setAllowLocalEdit(false);
                }
            }
        );
        const u3 = client.subscribe<{ type: 'game:vote_revoked'; userId: string }>(
            'game:vote_revoked',
            (msg) => {
                if (msg.userId === userId) {
                    setHasFinishedSubmit(false);
                }
            }
        );
        const u4 = client.subscribe<{ type: 'error'; error: string; message?: string }>(
            'error',
            (msg) => {
                if (msg.error !== 'VOTE_FAILED' || !pendingVoteRef.current) {
                    return;
                }
                pendingVoteRef.current = null;
                setIsSubmitting(false);
                setError(msg.message || 'Could not submit vote');
            }
        );
        return () => {
            u1();
            u2();
            u3();
            u4();
        };
    }, [ws.isConnected, roomCode, navigate, userId]);

    useEffect(() => {
        if (gameState.phase === 'RECAP' && roomCode) {
            navigate(`/game/${roomCode}/recap`, { replace: true });
        }
    }, [gameState.phase, roomCode, navigate]);

    const submitVote = useCallback(
        async (opts?: { fromTimer?: boolean }) => {
            if (!selectedId || !userId || !roomCode) {
                return;
            }
            if (selectedId === myFlipbookId) {
                return;
            }
            if (!opts?.fromTimer && !isConnected) {
                setError('Not connected — please wait a moment and try again.');
                return;
            }
            if (opts?.fromTimer && !isConnected) {
                return;
            }
            setError(null);
            setIsSubmitting(true);
            pendingVoteRef.current = selectedId;
            getWSClient().send('game:submit_vote', { flipbookId: selectedId });
        },
        [selectedId, userId, roomCode, isConnected, myFlipbookId]
    );

    useEffect(() => {
        if (!gameState.phaseEndsAt || !timer.isExpired || gameState.phase !== 'VOTING') {
            return;
        }
        if (hasFinishedSubmit || isSubmitting) {
            return;
        }
        if (timeUpAutoSubmitRef.current) {
            return;
        }
        timeUpAutoSubmitRef.current = true;
        if (selectedId && selectedId !== myFlipbookId) {
            void submitVote({ fromTimer: true });
        }
    }, [
        timer.isExpired,
        gameState.phaseEndsAt,
        gameState.phase,
        hasFinishedSubmit,
        isSubmitting,
        selectedId,
        myFlipbookId,
        submitVote,
    ]);

    const handleEdit = () => {
        if (!isConnected) {
            setError('Not connected — cannot change vote yet.');
            return;
        }
        setError(null);
        getWSClient().send('game:revoke_vote');
        setAllowLocalEdit(true);
        setHasFinishedSubmit(false);
    };

    if (!roomCode) {
        return null;
    }

    const isLocked = hasFinishedSubmit && !allowLocalEdit;

    return (
        <div
            className="box-border flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-gray-50 px-3 py-20 sm:px-5 sm:py-16"
            style={{ backgroundImage: `url(${theme === 'dark' ? darkBg : lightBg})` }}
        >
            {/* Toggle Button */}
            <ColorModeButton />
            <Container
                width="900px"
                height="auto"
                padding="1.5em"
                className="flex max-h-[92vh] min-h-[380px] flex-col gap-5 overflow-y-auto border-2 border-dark-grey bg-white shadow-xl"
            >
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <h1 className="text-heading-1 text-light-mode-text-1 dark:text-dark-mode-text-1">Favorite flipbook</h1>
                    <TimerDisplay
                        minutesLeft={timer.minutes.toString().padStart(2, '0')}
                        secondsLeft={timer.seconds.toString().padStart(2, '0')}
                        className="text-heading-3 text-light-mode-text-1 dark:text-dark-mode-text-1"
                    />
                </div>
                <p className="text-sm leading-relaxed text-light-mode-text-1 dark:text-dark-mode-text-1">
                    Pick someone else&apos;s flipbook — initial prompt and final drawing below. Tap{' '}
                    <span className="font-semibold">Done</span> when you&apos;re set. You can unlock and
                    change your vote until the timer ends.
                </p>
                {error && <p className="text-body text-red-600">{error}</p>}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {cards.map((c) => {
                        const isMine = c.authorId === userId;
                        const isSelected = c.id === selectedId;
                        return (
                            <button
                                key={c.id}
                                type="button"
                                disabled={isLocked || isMine}
                                onClick={() => {
                                    if (isLocked || isMine) return;
                                    setSelectedId(c.id);
                                }}
                                className={`flex flex-col gap-2 rounded-lg border-2 p-3 text-left transition-colors ${
                                    isMine
                                        ? 'cursor-not-allowed border-gray-200 bg-gray-100 opacity-70'
                                        : isSelected
                                          ? 'border-charcoal bg-blue-50 dark:border-dark-mode-border dark:bg-indigo-50'
                                          : 'border-dark-grey bg-white hover:border-charcoal dark:hover:border-dark-mode-border'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-base font-semibold text-brand-charcoal">
                                        {c.authorUsername}
                                    </span>
                                    <span className="shrink-0 text-xs text-gray-500">{c.votes} votes</span>
                                </div>
                                <div className="rounded-md border border-dark-grey/80 bg-sky-50/90 dark:bg-indigo-50/90 dark:border-dark-mode-border px-2.5 py-2">
                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                        Prompt
                                    </div>
                                    <div className="mt-0.5 line-clamp-4 text-sm font-medium leading-snug text-brand-charcoal">
                                        {c.prompt}
                                    </div>
                                </div>
                                <div className="rounded-md border border-dark-grey/80 bg-sky-50/60 dark:bg-indigo-50/60 px-2 py-1.5">
                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                                        Final drawing
                                    </div>
                                    <div className="mt-1 flex justify-center">
                                        {c.finalDrawingData ? (
                                            <AnimatedSketchDisplay
                                                drawingData={c.finalDrawingData}
                                                width="100%"
                                                strokeDelayMs={40}
                                                className="max-w-full sm:max-w-[260px]"
                                                replayNonce={c.id.length}
                                            />
                                        ) : (
                                            <span className="py-4 text-xs text-gray-500">No drawing</span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-end gap-3 border-t border-dark-grey pt-4">
                    {hasFinishedSubmit && !allowLocalEdit && (
                        <Button label="Edit vote" onClick={handleEdit} disabled={isSubmitting} />
                    )}
                    {(!hasFinishedSubmit || allowLocalEdit) && (
                        <Button
                            label={isSubmitting ? 'Submitting…' : 'Done'}
                            onClick={() => void submitVote()}
                            disabled={
                                isSubmitting ||
                                !selectedId ||
                                selectedId === myFlipbookId ||
                                !isConnected
                            }
                        />
                    )}
                </div>
            </Container>
        </div>
    );
};

export default VotingPage;
