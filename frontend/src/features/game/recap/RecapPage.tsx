import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Container from '../../../components/common/Container';
import Button from '../../../components/common/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { getGameState } from '../../../services/api/lobbyApi';
import {
    getFlipbookPresentation,
    listSavedFlipbooks,
    saveFlipbookToLibrary,
    type FlipbookPresentationResponse,
    type SavedFlipbookSummary,
} from '../../../services/api/gameApi';
import { HttpError } from '../../../services/api/httpClient';
import { AnimatedSketchDisplay } from '../../../components/game/AnimatedSketchDisplay';
import { useGameState, useLobby, useWebSocket } from '../../../hooks/useGameState';
import { getWSClient } from '../../../services/ws/wsClient';
import { useTheme } from '../../../contexts/ThemeContext';

import lightBg from '../../../assets/lightmode.jpg';
import darkBg from '../../../assets/darkmode.jpg';
import ColorModeButton from '../../../components/common/ColorModeButton';

const RecapPage: React.FC = () => {
    const { theme, toggleTheme } = useTheme();
    const { roomCode } = useParams<{ roomCode: string }>();
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const userId = user?.id || localStorage.getItem('userId') || '';

    const { lobby } = useLobby(roomCode || '', userId);
    const sync = roomCode && userId ? { roomCode, userId } : undefined;
    const gameState = useGameState(lobby?.id, sync);
    const ws = useWebSocket();

    const isHost = Boolean(userId && lobby?.host?.id && userId === lobby.host.id);

    const [flipbookIds, setFlipbookIds] = useState<string[]>([]);
    const [flipbookIndex, setFlipbookIndex] = useState(0);
    const [entryCount, setEntryCount] = useState(0);
    const [isComplete, setIsComplete] = useState(false);
    const [presentation, setPresentation] = useState<FlipbookPresentationResponse | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [savedLibrary, setSavedLibrary] = useState<SavedFlipbookSummary[]>([]);
    const [maxSaved, setMaxSaved] = useState(10);
    const [saveTitle, setSaveTitle] = useState('');
    const [saveBusy, setSaveBusy] = useState(false);
    const [saveMessage, setSaveMessage] = useState<string | null>(null);

    const timelineScrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isAuthenticated) {
            setSavedLibrary([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await listSavedFlipbooks();
                if (!cancelled) {
                    setSavedLibrary(res.savedFlipbooks);
                    setMaxSaved(res.maxSaved);
                }
            } catch {
                if (!cancelled) {
                    setSavedLibrary([]);
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated]);

    useEffect(() => {
        if (presentation?.flipbook?.author?.username) {
            setSaveTitle(`${presentation.flipbook.author.username}'s flipbook`);
        } else {
            setSaveTitle('');
        }
    }, [presentation?.flipbook?.id]);

    useEffect(() => {
        if (!roomCode || !userId) return;

        let cancelled = false;

        const loadOrder = async () => {
            try {
                const s = await getGameState(roomCode, userId);
                if (cancelled) return;
                if (s.state === 'FINISHED') {
                    navigate(`/game/${roomCode}/results`, { replace: true });
                    return;
                }
                if (s.state === 'IN_PROGRESS' && s.phase === 'VOTING') {
                    navigate(`/game/${roomCode}/vote`, { replace: true });
                    return;
                }
                if (s.state === 'IN_PROGRESS' && s.phase !== 'RECAP') {
                    navigate(`/game/${roomCode}/waiting`, { replace: true });
                    return;
                }
                const players = s.players || [];
                const order = players.map((p) => p.id);
                const fbs = s.flipbooks || [];
                const sorted = [...fbs].sort((a, b) => {
                    const ai = order.indexOf(a.authorId);
                    const bi = order.indexOf(b.authorId);
                    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
                });
                setFlipbookIds(sorted.map((f) => f.id));
            } catch (e) {
                console.error('[RecapPage] loadOrder', e);
                setLoadError('Could not load recap order.');
            }
        };

        void loadOrder();
        return () => {
            cancelled = true;
        };
    }, [roomCode, userId, navigate, gameState.phase, ws.isConnected]);

    useEffect(() => {
        if (gameState.phase === 'VOTING' && roomCode) {
            navigate(`/game/${roomCode}/vote`, { replace: true });
        }
    }, [gameState.phase, roomCode, navigate]);

    useEffect(() => {
        if (!ws.isConnected || !roomCode) return;
        getWSClient().send('recap:request_sync');
    }, [ws.isConnected, roomCode]);

    useEffect(() => {
        if (!ws.isConnected) return;

        const client = getWSClient();
        const unsub = client.subscribe<{
            type: 'recap:sync';
            flipbookIds: string[];
            flipbookIndex: number;
            entryCount: number;
            isComplete: boolean;
        }>('recap:sync', (msg) => {
            setFlipbookIds((prev) =>
                msg.flipbookIds.length > 0 ? msg.flipbookIds : prev
            );
            setFlipbookIndex(msg.flipbookIndex);
            setEntryCount(msg.entryCount);
            setIsComplete(msg.isComplete);
        });

        return () => unsub();
    }, [ws.isConnected]);

    const currentId = flipbookIds[flipbookIndex] ?? null;

    useEffect(() => {
        setSaveMessage(null);
    }, [currentId]);

    useEffect(() => {
        if (!currentId || !userId) {
            setPresentation(null);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const data = await getFlipbookPresentation(currentId, userId);
                if (!cancelled) {
                    setPresentation(data);
                    setLoadError(null);
                }
            } catch (e) {
                console.error('[RecapPage] presentation', e);
                if (!cancelled) {
                    setPresentation(null);
                    setLoadError('Failed to load this flipbook.');
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [currentId, userId]);

    const visibleTimeline = useMemo(() => {
        if (!presentation?.timeline?.length || entryCount <= 0) {
            return [];
        }
        return presentation.timeline.slice(0, entryCount);
    }, [presentation, entryCount]);

    const title = useMemo(() => {
        if (!presentation) return 'Recap';
        return `${presentation.flipbook.author.username}'s flipbook`;
    }, [presentation]);

    const timelineLen = presentation?.timeline.length ?? 0;
    const currentFlipbookFullyRevealed =
        Boolean(presentation) && timelineLen > 0 && entryCount >= timelineLen;

    useLayoutEffect(() => {
        if (visibleTimeline.length === 0) return;
        const el = timelineScrollRef.current;
        if (!el) return;
        requestAnimationFrame(() => {
            el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        });
    }, [entryCount, flipbookIndex, visibleTimeline.length, currentFlipbookFullyRevealed]);

    const revealButtonLabel = useMemo(() => {
        if (isComplete) return 'All revealed';
        if (!presentation || timelineLen === 0) return 'Reveal next';
        if (entryCount < timelineLen) return 'Reveal next';
        if (flipbookIndex < flipbookIds.length - 1) return 'Next flipbook';
        return 'Finish recap';
    }, [isComplete, presentation, timelineLen, entryCount, flipbookIndex, flipbookIds.length]);

    const onRevealNext = useCallback(() => {
        getWSClient().send('recap:reveal_next');
    }, []);

    const alreadySavedThis =
        Boolean(currentId) && savedLibrary.some((s) => s.sourceFlipbookId === currentId);
    const atLibraryLimit = savedLibrary.length >= maxSaved;

    const onSaveFlipbook = useCallback(async () => {
        if (!currentId || !isAuthenticated) return;
        setSaveBusy(true);
        setSaveMessage(null);
        try {
            await saveFlipbookToLibrary(currentId, {
                title: saveTitle.trim() || undefined,
            });
            setSaveMessage('Saved to your library.');
            const res = await listSavedFlipbooks();
            setSavedLibrary(res.savedFlipbooks);
            setMaxSaved(res.maxSaved);
        } catch (e: unknown) {
            if (e instanceof HttpError && e.data && typeof e.data === 'object' && 'message' in e.data) {
                setSaveMessage(String((e.data as { message?: string }).message || e.message));
            } else if (e instanceof HttpError) {
                setSaveMessage(e.message);
            } else {
                setSaveMessage(e instanceof Error ? e.message : 'Could not save');
            }
        } finally {
            setSaveBusy(false);
        }
    }, [currentId, isAuthenticated, saveTitle]);

    if (!roomCode) {
        return null;
    }

    const progressLabel =
        flipbookIds.length > 0
            ? `Flipbook ${flipbookIndex + 1} / ${flipbookIds.length}${presentation && entryCount > 0
                ? ` · ${entryCount} / ${presentation.timeline.length} cards`
                : ''
            }`
            : '—';

    const saveBarBottomClass = 'pb-[clamp(4.25rem,10vh,6rem)]';

    return (
        <>
            <div
                className={`flex flex-col justify-center items-center min-h-screen bg-gray-50 gap-6 p-4 ${currentFlipbookFullyRevealed ? saveBarBottomClass : ''
                    }`}
                style={{ backgroundImage: `url(${theme === 'dark' ? darkBg : lightBg})` }}
            >
                {/* Toggle Button */}
                <ColorModeButton className="absolute top-8 right-8" />
                <Container
                    width="900px"
                    height="auto"
                    padding="2em"
                    className="flex flex-col gap-6 border-2 border-dark-grey rounded-lg bg-white shadow-xl min-h-[480px]"
                >
                    <div className="flex justify-between items-center gap-4 flex-wrap">
                        <h1 className="text-heading-1 text-light-mode-text-1 dark:text-dark-mode-text-1">Flipbook recap</h1>
                        <span className="text-body text-gray-600 dark:text-dark-mode-text-2">{progressLabel}</span>
                    </div>

                    {loadError && <p className="text-red-600 text-body">{loadError}</p>}

                    <h2 className="text-heading-2 text-light-mode-text-1 dark:text-dark-mode-text-2">{title}</h2>

                    {!isHost && (
                        <p className="text-body text-gray-600 bg-gray-50 border border-dark-grey rounded-lg px-4 py-2">
                            The host controls this recap. Everyone sees the same cards at the same time.
                        </p>
                    )}

                    {entryCount === 0 && !isComplete && (
                        <p className="text-heading-3 text-center text-gray-600 dark:text-dark-mode-text-2">
                            {isHost
                                ? `Press “${revealButtonLabel}” to show the first card.`
                                : 'Waiting for the host to reveal the first card…'}
                        </p>
                    )}

                    {isComplete && (
                        <p className="text-heading-3 text-center text-emerald-700 dark:text-dark-mode-text-2">
                            Recap complete — heading to voting…
                        </p>
                    )}

                    <div
                        ref={timelineScrollRef}
                        className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-2 scroll-smooth"
                    >
                        {visibleTimeline.map((entry, i) => {
                            if (entry.kind === 'prompt') {
                                return (
                                    <div key={`p-${i}`} className="rounded-lg border border-dark-grey p-4 bg-indigo-50">
                                        <div className="text-xs uppercase text-gray-500">Prompt</div>
                                        <div className="text-heading-3">{entry.text}</div>
                                    </div>
                                );
                            }
                            if (entry.kind === 'guess') {
                                return (
                                    <div key={entry.id} className="rounded-lg border border-dark-grey p-4 bg-sky-50 dark:bg-indigo-50">
                                        <div className="text-xs uppercase text-gray-500">
                                            Guess — {entry.authorUsername}
                                        </div>
                                        <div className="text-body">{entry.text}</div>
                                    </div>
                                );
                            }
                            return (
                                <div key={`${entry.id}-${flipbookIndex}-${entryCount}`} className="rounded-lg border border-dark-grey p-4 bg-sky-50 dark:bg-indigo-50">
                                    <div className="text-xs uppercase text-gray-500">
                                        Drawing — {entry.authorUsername}
                                    </div>
                                    <div className="mt-3 flex justify-center">
                                        <AnimatedSketchDisplay
                                            drawingData={entry.drawingData}
                                            width="560px"
                                            height="320px"
                                            strokeDelayMs={75}
                                            className="max-w-full"
                                            replayNonce={entryCount + flipbookIndex + i}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex gap-4 flex-wrap justify-between items-center">
                        {isHost ? (
                            <Button
                                label={revealButtonLabel}
                                onClick={onRevealNext}
                                disabled={isComplete}
                            />
                        ) : (
                            <span className="text-body text-gray-500" />
                        )}
                    </div>
                </Container>
            </div>

            {currentFlipbookFullyRevealed && (
                <div
                    className="fixed bottom-0 left-0 right-0 z-50 border-t border-dark-grey bg-slate-50 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
                    style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
                >
                    <div className="mx-auto flex w-full max-w-[900px] items-center gap-2 overflow-x-auto px-3 py-2">
                        {!isAuthenticated ? (
                            <p className="min-w-0 flex-1 text-xs leading-snug text-gray-600">
                                <span className="font-semibold text-gray-800">Save to library</span>
                                <span className="text-gray-400"> · </span>
                                Sign in to keep a copy (up to {maxSaved}).
                            </p>
                        ) : (
                            <>
                                <span className="shrink-0 text-xs text-gray-600">
                                    <span className="font-semibold text-gray-800">Save to library</span>
                                    <span className="text-gray-400"> · </span>
                                    {savedLibrary.length}/{maxSaved} used
                                    {alreadySavedThis
                                        ? ' · Already saved'
                                        : atLibraryLimit
                                            ? ' · Full'
                                            : ''}
                                </span>
                                {!alreadySavedThis && !atLibraryLimit && (
                                    <>
                                        <input
                                            id="save-flipbook-title"
                                            type="text"
                                            value={saveTitle}
                                            onChange={(e) => setSaveTitle(e.target.value)}
                                            placeholder="Optional title"
                                            aria-label="Optional title for saved flipbook"
                                            disabled={saveBusy}
                                            className="min-w-[6rem] flex-1 border-2 border-light-grey rounded-md px-2 py-1.5 text-sm outline-none transition-colors focus:border-charcoal disabled:cursor-not-allowed disabled:opacity-50 sm:max-w-[min(20rem,40vw)]"
                                        />
                                        <Button
                                            label={saveBusy ? 'Saving…' : 'Save'}
                                            onClick={() => void onSaveFlipbook()}
                                            disabled={saveBusy || !currentId}
                                            className="shrink-0 px-4 py-1.5 text-sm"
                                        />
                                    </>
                                )}
                                {atLibraryLimit && !alreadySavedThis && (
                                    <span
                                        className="min-w-0 max-w-[min(16rem,42vw)] truncate text-xs text-gray-500"
                                        title="Remove a save in your account to add this one."
                                    >
                                        Remove a save in your account to add this one.
                                    </span>
                                )}
                                {saveMessage && (
                                    <span
                                        className={`max-w-[min(14rem,38vw)] shrink-0 truncate text-xs ${saveMessage.startsWith('Saved') ? 'text-emerald-700' : 'text-red-600'
                                            }`}
                                        title={saveMessage}
                                    >
                                        {saveMessage}
                                    </span>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};

export default RecapPage;
