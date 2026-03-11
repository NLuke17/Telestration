import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
// @ts-ignore - framer-motion is installed but TS server may not detect it immediately
import { motion, AnimatePresence } from 'framer-motion';
import Container from '../../../components/common/Container';

const GameCountdownPage: React.FC = () => {
    const { roomCode } = useParams<{ roomCode: string }>();
    const navigate = useNavigate();
    const [countdown, setCountdown] = useState(3);
    const [showMessage, setShowMessage] = useState(false);
    
    // Get phase from URL search params
    const searchParams = new URLSearchParams(window.location.search);
    const targetPhase = (searchParams.get('phase') as 'DRAWING' | 'GUESSING') || 'GUESSING';
    
    console.log('[GameCountdownPage] Target phase from URL:', targetPhase);

    useEffect(() => {
        // Show initial message
        const messageTimer = setTimeout(() => {
            setShowMessage(true);
        }, 500);

        // Countdown logic
        if (countdown > 0) {
            const timer = setTimeout(() => {
                setCountdown(countdown - 1);
            }, 1000);
            return () => {
                clearTimeout(timer);
                clearTimeout(messageTimer);
            };
        } else {
            // Countdown finished, navigate to the appropriate page
            const navTimer = setTimeout(() => {
                if (targetPhase === 'GUESSING') {
                    navigate(`/game/${roomCode}/guess`);
                } else if (targetPhase === 'DRAWING') {
                    navigate(`/game/${roomCode}/draw`);
                } else {
                    // Default to guess page for initial prompt writing
                    navigate(`/game/${roomCode}/guess`);
                }
            }, 500);
            return () => clearTimeout(navTimer);
        }
    }, [countdown, navigate, roomCode, targetPhase]);

    const getMessage = () => {
        if (targetPhase === 'DRAWING') {
            return "Time to draw!";
        } else if (targetPhase === 'GUESSING') {
            return "Time to write!";
        }
        return "Get ready!";
    };

    return (
        <div className="flex flex-col justify-center items-center h-screen bg-gradient-to-br from-blue-50 to-purple-50">
            <Container 
                width='600px' 
                height='400px' 
                padding='3em' 
                className='flex flex-col justify-center items-center gap-8 border-2 border-dark-grey rounded-lg bg-white shadow-2xl'
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
                                opacity: 1
                            }}
                            exit={{ 
                                scale: 1.5,
                                opacity: 0
                            }}
                            transition={{ 
                                duration: 0.8,
                                ease: "easeOut"
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
                    transition={{ duration: 3.5, ease: "linear" }}
                    className="h-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                />
            </Container>
        </div>
    );
};

export default GameCountdownPage;
