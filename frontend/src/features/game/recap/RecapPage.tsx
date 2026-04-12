import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Container from '../../../components/common/Container';
import Button from '../../../components/common/Button';
import { useAuth } from '../../../contexts/AuthContext';
import { endLobby, getGameState } from '../../../services/api/lobbyApi';
import { getFlipbookPresentation, type FlipbookPresentationResponse } from '../../../services/api/gameApi';
import { AnimatedSketchDisplay, parseCanvasPathsJson } from '../../../components/game/AnimatedSketchDisplay';

const RECAP_MS = 14000;

const RecapPage: React.FC = () => {
    const { roomCode } = useParams<{ roomCode: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const userId = user?.id || localStorage.getItem('userId') || '';

    const [flipbookIds, setFlipbookIds] = useState<string[]>([]);
    const [index, setIndex] = useState(0);
    const [presentation, setPresentation] = useState<FlipbookPresentationResponse | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    useEffect(() => {
        if (!roomCode || !userId) return;

        let cancelled = false;

        const loadOrder = async () => {
            try {
                const s = await getGameState(roomCode, userId);
                if (cancelled) return;
                if (s.phase !== 'VOTING' && s.state === 'IN_PROGRESS') {
                    navigate(`/game/${roomCode}/waiting`, { replace: true });
                    return;
                }
                if (s.state === 'FINISHED') {
                    navigate(`/lobby/${roomCode}`, { replace: true });
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
    }, [roomCode, userId, navigate]);

    const currentId = flipbookIds[index] ?? null;

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

    useEffect(() => {
        if (flipbookIds.length === 0) return;
        const t = window.setInterval(() => {
            setIndex((i) => (i + 1 >= flipbookIds.length ? i : i + 1));
        }, RECAP_MS);
        return () => window.clearInterval(t);
    }, [flipbookIds.length]);

    const title = useMemo(() => {
        if (!presentation) return 'Recap';
        return `${presentation.flipbook.author.username}'s flipbook`;
    }, [presentation]);

    const goLobby = useCallback(async () => {
        if (!roomCode) return;
        try {
            await endLobby(roomCode);
        } catch {
            /* still navigate */
        }
        navigate(`/lobby/${roomCode}`, { replace: true });
    }, [navigate, roomCode]);

    if (!roomCode) {
        return null;
    }

    return (
        <div className="flex flex-col justify-center items-center min-h-screen bg-gray-50 gap-6 p-4">
            <Container
                width="900px"
                height="auto"
                padding="2em"
                className="flex flex-col gap-6 border-2 border-dark-grey rounded-lg bg-white shadow-xl min-h-[480px]"
            >
                <div className="flex justify-between items-center gap-4 flex-wrap">
                    <h1 className="text-heading-1">Flipbook recap</h1>
                    <span className="text-body text-gray-600">
                        {flipbookIds.length > 0 ? `${index + 1} / ${flipbookIds.length}` : '—'}
                    </span>
                </div>

                {loadError && <p className="text-red-600 text-body">{loadError}</p>}

                <h2 className="text-heading-2">{title}</h2>

                <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-2">
                    {presentation?.timeline.map((entry, i) => {
                        if (entry.kind === 'prompt') {
                            return (
                                <div key={`p-${i}`} className="rounded-lg border border-dark-grey p-4 bg-blue-50">
                                    <div className="text-xs uppercase text-gray-500">Prompt</div>
                                    <div className="text-heading-3">{entry.text}</div>
                                </div>
                            );
                        }
                        if (entry.kind === 'guess') {
                            return (
                                <div key={entry.id} className="rounded-lg border border-dark-grey p-4 bg-amber-50">
                                    <div className="text-xs uppercase text-gray-500">
                                        Guess — {entry.authorUsername}
                                    </div>
                                    <div className="text-body">{entry.text}</div>
                                </div>
                            );
                        }
                        const sketch = parseCanvasPathsJson(entry.drawingData);
                        return (
                            <div key={entry.id} className="rounded-lg border border-dark-grey p-4 bg-green-50">
                                <div className="text-xs uppercase text-gray-500">
                                    Drawing — {entry.authorUsername}
                                </div>
                                <div className="mt-3 flex justify-center">
                                    {sketch ? (
                                        <AnimatedSketchDisplay
                                            drawingData={entry.drawingData}
                                            width="560px"
                                            height="320px"
                                            strokeDelayMs={75}
                                            className="max-w-full"
                                        />
                                    ) : (
                                        <p className="text-body text-gray-600">
                                            No stroke data for this drawing (older or invalid save).
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="flex gap-4 flex-wrap justify-between">
                    <Button
                        label="Previous"
                        onClick={() => setIndex((i) => Math.max(0, i - 1))}
                        disabled={index <= 0}
                    />
                    <Button
                        label="Next"
                        onClick={() => setIndex((i) => Math.min(flipbookIds.length - 1, i + 1))}
                        disabled={index >= flipbookIds.length - 1 || flipbookIds.length === 0}
                    />
                    <Button label="Finish & return to lobby" onClick={() => void goLobby()} />
                </div>
            </Container>
        </div>
    );
};

export default RecapPage;
