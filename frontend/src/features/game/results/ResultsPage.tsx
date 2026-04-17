import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Container from '../../../components/common/Container';
import Button from '../../../components/common/Button';
import { AnimatedSketchDisplay } from '../../../components/game/AnimatedSketchDisplay';
import { useAuth } from '../../../contexts/AuthContext';
import { getGameState, endLobby } from '../../../services/api/lobbyApi';

type RankingRow = {
    rank: number;
    flipbookId: string;
    authorId: string;
    authorUsername: string;
    voteCount: number;
    prompt: string;
    finalDrawingData: string | null;
};

function parseResults(raw: unknown): RankingRow[] {
    if (!raw || typeof raw !== 'object') return [];
    const r = raw as { rankings?: RankingRow[] };
    return Array.isArray(r.rankings) ? r.rankings : [];
}

const ResultsPage: React.FC = () => {
    const { roomCode } = useParams<{ roomCode: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const userId = user?.id || localStorage.getItem('userId') || '';

    const [rows, setRows] = useState<RankingRow[]>([]);
    const [loadError, setLoadError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!roomCode || !userId) return;
        try {
            const s = await getGameState(roomCode, userId);
            if (s.state === 'IN_PROGRESS') {
                if (s.phase === 'VOTING') {
                    navigate(`/game/${roomCode}/vote`, { replace: true });
                    return;
                }
                if (s.phase === 'RECAP') {
                    navigate(`/game/${roomCode}/recap`, { replace: true });
                    return;
                }
                navigate(`/game/${roomCode}/waiting`, { replace: true });
                return;
            }
            if (s.state !== 'FINISHED') {
                navigate(`/lobby/${roomCode}`, { replace: true });
                return;
            }
            const all = parseResults(s.votingResults);
            setRows(all.filter((r) => r.rank <= 3));
            setLoadError(null);
        } catch (e) {
            console.error('[ResultsPage]', e);
            setLoadError('Could not load results.');
        }
    }, [roomCode, userId, navigate]);

    useEffect(() => {
        void load();
    }, [load]);

    const returnToLobby = useCallback(async () => {
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

    const ordinal = (n: number) => {
        if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
        switch (n % 10) {
            case 1:
                return `${n}st`;
            case 2:
                return `${n}nd`;
            case 3:
                return `${n}rd`;
            default:
                return `${n}th`;
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-gray-50 p-4">
            <Container
                width="960px"
                height="auto"
                padding="2em"
                className="flex flex-col gap-6 border-2 border-dark-grey bg-white shadow-xl"
            >
                <h1 className="text-heading-1">Results</h1>
                <p className="text-body text-gray-600">
                    Top placements (ties share the same spot). Votes are saved to each author&apos;s account
                    stats.
                </p>
                {loadError && <p className="text-body text-red-600">{loadError}</p>}
                <div className="flex flex-col gap-6">
                    {rows.length === 0 && !loadError && (
                        <p className="text-heading-3 text-gray-600">Loading results…</p>
                    )}
                    {rows.map((r) => (
                        <div
                            key={`${r.flipbookId}-${r.rank}`}
                            className="flex flex-col gap-3 rounded-lg border-2 border-dark-grey p-4 md:flex-row md:items-start"
                        >
                            <div className="shrink-0 text-heading-2 text-brand-charcoal md:w-28">
                                {ordinal(r.rank)}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col gap-3">
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <span className="text-heading-3">{r.authorUsername}</span>
                                    <span className="text-body text-gray-600">{r.voteCount} votes</span>
                                </div>
                                <div className="rounded-md border border-dark-grey bg-blue-50 p-3">
                                    <div className="text-xs uppercase text-gray-500">Prompt</div>
                                    <div className="text-body font-medium">{r.prompt}</div>
                                </div>
                                <div className="rounded-md border border-dark-grey bg-green-50 p-2">
                                    <div className="text-xs uppercase text-gray-500">Final drawing</div>
                                    <div className="mt-2 flex justify-center">
                                        {r.finalDrawingData ? (
                                            <AnimatedSketchDisplay
                                                drawingData={r.finalDrawingData}
                                                width="440px"
                                                height="260px"
                                                strokeDelayMs={40}
                                                className="max-w-full"
                                                replayNonce={r.flipbookId.length + r.rank}
                                            />
                                        ) : (
                                            <span className="text-sm text-gray-500">No drawing</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex justify-end border-t border-dark-grey pt-4">
                    <Button label="Return to lobby" onClick={() => void returnToLobby()} />
                </div>
            </Container>
        </div>
    );
};

export default ResultsPage;
