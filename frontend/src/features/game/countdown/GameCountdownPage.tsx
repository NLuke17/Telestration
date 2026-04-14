import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
// @ts-ignore - framer-motion is installed but TS server may not detect it immediately
import { motion, AnimatePresence } from 'framer-motion';
import Container from '../../../components/common/Container';
import { getGameState } from '../../../services/api/lobbyApi';
import { useAuth } from '../../../contexts/AuthContext';
import { useLobby, useGameState } from '../../../hooks/useGameState';

const PROMPT_WAIT_FLAG = 'telestration.expectDrawAfterPromptWait';

function readPhaseFromLocation(): 'DRAWING' | 'GUESSING' | 'VOTING' | null {
    const p = new URLSearchParams(window.location.search).get('phase');
    if (p === 'DRAWING' || p === 'GUESSING' || p === 'VOTING') return p;
    return null;
}

const GameCountdownPage: React.FC = () => {
    const { roomCode } = useParams<{ roomCode: string }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const userId = user?.id || localStorage.getItem('userId') || '';

    const { lobby, error: lobbyError } = useLobby(roomCode || '', userId);
    const sync = roomCode && userId ? { roomCode, userId } : undefined;
    const gameState = useGameState(lobby?.id, sync);
    const wsPhaseRef = useRef(gameState.phase);
    wsPhaseRef.current = gameState.phase;

    useEffect(() => {
        if (lobbyError?.toLowerCase().includes('delete')) {
            navigate('/', { replace: true });
        }
    }, [lobbyError, navigate]);

    const [countdown, setCountdown] = useState(3);
    const [showMessage, setShowMessage] = useState(false);

    const phaseParam = searchParams.get('phase');
    const urlPhase: 'DRAWING' | 'GUESSING' | 'VOTING' =
        phaseParam === 'DRAWING' || phaseParam === 'GUESSING' || phaseParam === 'VOTING'
            ? phaseParam
            : 'GUESSING';

    /** Prefer live WS / server phase over ?phase= (URL can stay GUESSING after everyone submitted prompts). */
    const displayPhase: 'DRAWING' | 'GUESSING' | 'VOTING' =
        gameState.phase === 'DRAWING' || gameState.phase === 'GUESSING' || gameState.phase === 'VOTING'
            ? gameState.phase
            : urlPhase;

    // Align ?phase= with WebSocket when server advances (e.g. GUESSING → DRAWING after initial prompts).
    useEffect(() => {
        if (!roomCode || !gameState.phase) return;
        if (gameState.phase !== 'DRAWING' && gameState.phase !== 'GUESSING' && gameState.phase !== 'VOTING')
            return;
        const curr = searchParams.get('phase');
        if (curr !== gameState.phase) {
            navigate(`/game/${roomCode}/countdown?phase=${gameState.phase}`, { replace: true });
        }
    }, [gameState.phase, roomCode, navigate, searchParams]);

    // Poll server: URL can be stale GUESSING while flipbooks are already DRAWING (hydrate effect used to skip this).
    useEffect(() => {
        if (!roomCode || !userId) return;

        let cancelled = false;
        const tick = async () => {
            try {
                const s = await getGameState(roomCode, userId);
                if (cancelled) return;
                if (s.phase !== 'DRAWING' && s.phase !== 'GUESSING' && s.phase !== 'VOTING') return;
                const curr = new URLSearchParams(window.location.search).get('phase');
                if (curr !== s.phase) {
                    navigate(`/game/${roomCode}/countdown?phase=${s.phase}`, { replace: true });
                }
            } catch {
                /* ignore */
            }
        };

        void tick();
        const id = setInterval(tick, 1000);
        return () => {
            cancelled = true;
            clearInterval(id);
        };
    }, [roomCode, userId, navigate]);

    // If ?phase= is missing entirely, fix once from server.
    useEffect(() => {
        if (phaseParam === 'DRAWING' || phaseParam === 'GUESSING' || phaseParam === 'VOTING') return;
        if (!roomCode || !userId) return;

        let cancelled = false;
        (async () => {
            try {
                const s = await getGameState(roomCode, userId);
                if (cancelled) return;
                if (s.phase === 'DRAWING' || s.phase === 'GUESSING' || s.phase === 'VOTING') {
                    navigate(`/game/${roomCode}/countdown?phase=${s.phase}`, { replace: true });
                }
            } catch {
                /* ignore */
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [roomCode, userId, phaseParam, navigate]);

    // Restart countdown when URL phase or live phase changes.
    useEffect(() => {
        setCountdown(3);
        setShowMessage(false);
    }, [phaseParam, gameState.phase]);

    useEffect(() => {
        const messageTimer = setTimeout(() => {
            setShowMessage(true);
        }, 500);

        if (countdown > 0) {
            const timer = setTimeout(() => {
                setCountdown((c) => c - 1);
            }, 1000);
            return () => {
                clearTimeout(timer);
                clearTimeout(messageTimer);
            };
        }

        const navTimer = setTimeout(() => {
            // Prefer live server phase (ref) over ?phase= URL. Reading the URL first caused a bug:
            // URL stayed ?phase=GUESSING while the server was already DRAWING, so "GUESSING" was treated
            // as valid and we never consulted wsPhaseRef — users were sent back to the writing page.
            let p = wsPhaseRef.current;
            if (p !== 'DRAWING' && p !== 'GUESSING' && p !== 'VOTING') {
                p = readPhaseFromLocation();
            }
            if (
                p !== 'DRAWING' &&
                p !== 'GUESSING' &&
                sessionStorage.getItem(PROMPT_WAIT_FLAG) === '1'
            ) {
                p = 'DRAWING';
                sessionStorage.removeItem(PROMPT_WAIT_FLAG);
            }
            if (p !== 'DRAWING' && p !== 'GUESSING' && p !== 'VOTING') {
                p = 'GUESSING';
            }
            if (p === 'VOTING') {
                navigate(`/game/${roomCode}/recap`, { replace: true });
            } else if (p === 'DRAWING') {
                navigate(`/game/${roomCode}/draw`, { replace: true });
            } else {
                navigate(`/game/${roomCode}/guess`, { replace: true });
            }
        }, 500);

        return () => {
            clearTimeout(messageTimer);
            clearTimeout(navTimer);
        };
    }, [countdown, navigate, roomCode]);

    const getMessage = () => {
        if (displayPhase === 'DRAWING') {
            return 'Time to draw!';
        }
        if (displayPhase === 'GUESSING') {
            return 'Time to write!';
        }
        if (displayPhase === 'VOTING') {
            return 'Time to see every flipbook!';
        }
        return 'Get ready!';
    };

    return (
        <div className="flex flex-col justify-center items-center h-screen bg-gradient-to-br from-blue-50 to-purple-50">
            <Container
                width="600px"
                height="400px"
                padding="3em"
                className="flex flex-col justify-center items-center gap-8 border-2 border-dark-grey rounded-lg bg-white shadow-2xl"
            >
                <AnimatePresence mode="wait">
                    {showMessage && (
                        <motion.div
                            initial={{ opacity: 0, y: -20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            transition={{ duration: 0.5 }}
                            className="text-heading-1 text-center"
                        >
                            {getMessage()}
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence mode="wait">
                    {countdown > 0 ? (
                        <motion.div
                            key={countdown}
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{
                                scale: [0.5, 1.2, 1],
                                opacity: 1,
                            }}
                            exit={{
                                scale: 1.5,
                                opacity: 0,
                            }}
                            transition={{
                                duration: 0.8,
                                ease: 'easeOut',
                            }}
                            className="text-9xl font-bold text-brand-charcoal"
                        >
                            {countdown}
                        </motion.div>
                    ) : (
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.3 }}
                            className="text-6xl font-bold text-green-600"
                        >
                            GO!
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 3.5, ease: 'linear' }}
                    className="h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                />
            </Container>
        </div>
    );
};

export default GameCountdownPage;
