import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Container from '../../../components/common/Container';
import Button from '../../../components/common/Button';
import { AnimatedSketchDisplay } from '../../../components/game/AnimatedSketchDisplay';
import { useAuth } from '../../../contexts/AuthContext';
import { getGameState, endLobby } from '../../../services/api/lobbyApi';
import { useTheme } from '../../../contexts/ThemeContext';

import lightBg from '../../../assets/lightmode.jpg';
import darkBg from '../../../assets/darkmode.jpg';
import ColorModeButton from '../../../components/common/ColorModeButton';

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
    const { theme } = useTheme();
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
        <div
            className="box-border flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-gray-50 px-3 py-20 sm:px-5 sm:py-16"
            style={{ backgroundImage: `url(${theme === 'dark' ? darkBg : lightBg})` }}
        >
            {/* Toggle Button */}
            <ColorModeButton />
            <Container
                width="960px"
                height="auto"
                padding="2em"
                className="flex flex-col gap-6 border-2 border-dark-grey shadow-xl"
            >
                <h1 className="text-heading-1 text-light-mode-text-1 dark:text-dark-mode-text-1">Results</h1>
                <p className="text-body text-gray-600 dark:text-dark-mode-text-2">
                    Here are the winning flipbooks! Votes are saved to each author&apos;s account
                    stats.
                </p>
                {loadError && <p className="text-body text-red-600">{loadError}</p>}
                <div className="flex flex-col gap-6">
                    {rows.length === 0 && !loadError && (
                        <p className="text-heading-3 text-gray-600 dark:text-dark-mode-text-2">Loading results…</p>
                    )}
                    {rows.map((r) => (
                        <div
                            key={`${r.flipbookId}-${r.rank}`}
                            className="flex flex-col gap-3 rounded-lg border-2 border-dark-grey p-4 md:flex-row md:items-start"
                        >
                            <div className="shrink-0 text-heading-1 text-brand-charcoal dark:text-dark-mode-text-1 md:w-28">
                                {ordinal(r.rank)}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col gap-3">
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <span className="text-heading-3 dark:text-dark-mode-text-1">{r.authorUsername}</span>
                                    <span className="text-body text-gray-600 dark:text-dark-mode-text-1">{r.voteCount} {r.voteCount > 1 ? 'votes' : 'vote'}</span>
                                </div>
                                <div className="rounded-md border border-dark-grey bg-sky-50 dark:bg-dark-mode-input-background/20 p-3">
                                    <div className="text-xs uppercase text-gray-500 dark:text-dark-mode-text-2">Prompt</div>
                                    <div className="text-body font-medium text-brand-charcoal dark:text-dark-mode-text-1">
                                        {r.prompt}
                                    </div>
                                </div>
                                <div className="rounded-md border border-dark-grey bg-sky-50 dark:bg-dark-mode-input-background/20 p-2">
                                    <div className="text-xs uppercase text-gray-500 dark:text-dark-mode-text-2">Final drawing</div>
                                    <div className="mt-2 flex justify-center">
                                        {r.finalDrawingData ? (
                                            <AnimatedSketchDisplay
                                                drawingData={r.finalDrawingData}
                                                width="100%"
                                                strokeDelayMs={40}
                                                className="max-w-full sm:max-w-[440px]"
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
