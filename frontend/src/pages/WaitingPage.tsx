import React from 'react';
import Container from '../components/Container';
import { useParams } from 'react-router-dom';
import { useGameState } from '../hooks/useGameState';

const WaitingPage: React.FC = () => {
    const { roomCode } = useParams<{ roomCode: string }>();
    const gameState = useGameState();

    return (
        <div className="flex flex-col justify-center items-center h-screen bg-gray-50">
            <Container 
                width='900px' 
                height='500px' 
                padding='5em' 
                className='flex flex-col justify-center items-center border-2 border-dark-grey rounded-lg bg-white shadow-xl gap-8'
            >
                <h1 className="text-heading-1">Waiting for other players...</h1>
                
                {gameState.phase && (
                    <p className="text-heading-3 text-gray-600">
                        Current Phase: {gameState.phase}
                    </p>
                )}
                
                {gameState.roundNumber > 0 && (
                    <p className="text-body">
                        Round {gameState.roundNumber}
                    </p>
                )}
                
                <div className="flex items-center justify-center gap-2">
                    <div className="animate-bounce w-3 h-3 bg-blue-500 rounded-full"></div>
                    <div className="animate-bounce w-3 h-3 bg-blue-500 rounded-full" style={{ animationDelay: '0.1s' }}></div>
                    <div className="animate-bounce w-3 h-3 bg-blue-500 rounded-full" style={{ animationDelay: '0.2s' }}></div>
                </div>
                
                <p className="text-body text-center max-w-md">
                    Please wait while other players complete their submissions.
                    You'll be redirected automatically when everyone is ready.
                </p>
            </Container>
        </div>
    );
};

export default WaitingPage;
