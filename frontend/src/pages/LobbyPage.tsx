import React from 'react';
import Container from '../components/Container';
import Button from '../components/Button';
import { useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import type { LobbySnapshot } from '../../../backend/src/types/dto';

 const LobbyPage: React.FC = () => {
    const { roomCode } = useParams<{ roomCode: string }> ();
    const [lobby, setLobby] = useState<LobbySnapshot | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        // fetch function

        const fetchLobby = async () => {
            setIsLoading(true);
            try {
                const baseUrl = import.meta.env.VITE_API_BASE_URL;
                const response = await fetch(`${baseUrl}/api/lobby/${roomCode}`);

                if (!response.ok) {
                    throw new Error("Lobby not found");
                }

                const data = await response.json();
                setLobby(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };

        // execute if given a room code
        if (roomCode) {
            fetchLobby();
        }
    }, [roomCode]); // run every time room code changes

    return (
        <div className="flex flex-col justify-center items-center h-screen bg-gray-50">
            <Container 
                width='900px' 
                height='500px' 
                padding='5em' 
                className='gap-2 flex-col border-2 border-dark-grey rounded-lg bg-white shadow-xl p-12'
            >
                {/* Header */}
                <h1 className="text-heading-1 w-full text-left mb-0">Join Room</h1>
                <div className='flex flex-row gap-12'>
                
                {/* Left: players */}
                    <div className="flex flex-col gap-6 w-auto">
                        <Container
                            width='200px'
                            height='auto'
                            padding='0'
                            className='flex flex-col items-start border-2 border-light-grey rounded-lg bg-white shadow-xl p-2'>                          
                            <h2 className="text-lg font-bold text-left w-full">Players</h2>
                        </Container>
                        <p>Player 1</p>
                        <p>Player 2</p>
                        <p>Player 3</p>
                    </div>

                {/* Middle: invite and start */}
                    <div className="flex flex-col gap-6 w-full">
                        <h2 className="text-lg font-bold pb-2 text-center">Room code:</h2>
                        {/* Displaying the Room Code numbers */}
                        <p className="text-heading-1 font-bold text-center">
                            {roomCode}
                        </p>
                        <Button 
                            label="Share" 
                            className="w-fit py-3 mt-2 self-center" 
                            onClick={() => console.log("Sharing...")}
                        />
                        <Button 
                            label="Start" 
                            className="w-fit py-3 mt-2 self-center" 
                            onClick={() => console.log("Starting...")}
                        />
                    </div>

                {/* Right: how to play */}
                    <div className="flex flex-col justify-center items-center gap-6 w-auto">
                        <h2 className="text-lg font-bold pb-2 text-center">How to play</h2>
                        <Container
                            width='200px'
                            height='250px'
                            padding='0'
                            className='gap-2 flex-col border-2 border-light-grey rounded-lg bg-white shadow-xl p-12'>
                              <p className="text-center">Slideshow here</p>
                        </Container>
                    </div>
                </div>

            </Container>
        </div>
    );
}

 export default LobbyPage