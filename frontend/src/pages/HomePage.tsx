import React, { useState } from 'react';
import Container from '../components/Container';
import TutorialSlideshow from '../components/TutorialSlideshow';
import { PiNumberCircleOne, PiNumberCircleTwo } from "react-icons/pi";
import Button from '../components/Button';
import { useNavigate } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import { createLobby, joinLobby } from '../services/api/lobbyApi';

const HomePage: React.FC = () => {
    const navigate = useNavigate();
    const [isLoggedIn, setLoggedIn] = useState<boolean>(false);
    const [roomCodeInput, setRoomCodeInput] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isJoining, setIsJoining] = useState(false);

    const handleCreateLobby = async () => {
        let userId = localStorage.getItem('userId');

        if (!userId) {
            // Generate a temporary user ID if not logged in
            userId = `temp-${Date.now()}`;
            localStorage.setItem('userId', userId);
        }

        try {
            setIsCreating(true);
            setError(null);
            
            const lobby = await createLobby(userId);
            navigate(`/lobby/${lobby.roomCode}`);
        } catch (err: any) {
            console.error("Create Error:", err);
            setError(err.message || 'Failed to create lobby');
        } finally {
            setIsCreating(false);
        }
    };

    const handleJoinLobby = async () => {
        if (!roomCodeInput.trim()) {
            setError('Please enter a room code');
            return;
        }

        let userId = localStorage.getItem('userId');

        if (!userId) {
            // Generate a temporary user ID if not logged in
            userId = `temp-${Date.now()}`;
            localStorage.setItem('userId', userId);
        }

        try {
            setIsJoining(true);
            setError(null);
            
            await joinLobby(roomCodeInput.trim().toUpperCase(), userId);
            navigate(`/lobby/${roomCodeInput.trim().toUpperCase()}`);
        } catch (err: any) {
            console.error("Join Error:", err);
            setError(err.message || 'Failed to join lobby');
        } finally {
            setIsJoining(false);
        }
    };

    return (
        <div className="flex flex-col justify-center items-center h-screen">
            {/* Home content container */}
            <Container width='900px' height='500px' padding='4em' className='flex items-center justify-center gap-8 flex-col border-2 border-dark-grey rounded-lg'>
                {/* Heading */}
                <div className="w-full flex align-left items-center justify-between">
                    <h1 className="text-heading-1 text-left">New Game</h1>
                    <div className='flex flex-row items-center gap-4'>
                        <div className='text-heading-3'>or</div>
                        <Button
                            className='h-fit flex'
                            label="Sign in"
                        />
                    </div>
                </div>
                {/* Main content */}
                <div className="flex flex-row items-center justify-center w-full h-full gap-8">
                    {/* Join a room option */}
                    <div className='flex flex-col justify-between items-center h-full text-center'>
                        <PiNumberCircleOne size={33}/>
                        <div className="flex flex-col gap-2">
                            <input
                                type="text"
                                placeholder="Enter room code"
                                value={roomCodeInput}
                                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                                className="border border-gray-300 rounded px-3 py-2 text-center"
                                maxLength={6}
                            />
                            <Button 
                                label={isJoining ? "Joining..." : "Join a room"}
                                disabled={!roomCodeInput.trim() || isJoining}
                                onClick={handleJoinLobby}
                            />
                        </div>
                        <div>{!isLoggedIn ? (
                            <Alert severity='info'>Playing as guest</Alert>
                        ): (
                            <div></div>
                        )}</div>
                        <div>Join a room using the code provided by whoever is hosting!</div>
                    </div>
                    {/* How to Play slideshow */}
                    <TutorialSlideshow className='w-hug'/>
                    {/* Start a new room option */}
                    <div className='flex flex-col justify-between items-center w-hug h-full text-center gap-auto'>
                        <PiNumberCircleTwo size={33} />
                        <Button 
                            label={isCreating ? "Creating..." : "Start a new room"}
                            disabled={isCreating}
                            onClick={handleCreateLobby}
                        />
                        <div>{!isLoggedIn ? (
                            <Alert severity='info'>Playing as guest</Alert>
                        ): (
                            <div></div>
                        )}</div>
                        <div>Start a room of your own and invite your friends to join!</div>
                    </div>
                </div>
                {error && (
                    <Alert severity='error' className='w-full'>{error}</Alert>
                )}
            </Container>
        </div>
    );
}

export default HomePage;