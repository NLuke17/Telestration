import React from 'react';
import Container from '../components/Container';
import TutorialSlideshow from '../components/TutorialSlideshow';
import { PiNumberCircleOne, PiNumberCircleTwo } from "react-icons/pi";
import Button from '../components/Button';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

const HomePage: React.FC = () => {
    const navigate = useNavigate();

    const handleCreateLobby = async () => {
        let userId = localStorage.getItem('telestrations_user_id');

        if (!userId) {
            userId = uuidv4();
            localStorage.setItem('telestrations_user_id', userId);
        }

        try {
            const baseUrl = import.meta.env.VITE_API_BASE_URL;
            const response = await fetch(`${baseUrl}/lobby`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ hostId: userId })
            })
            if (!response.ok) throw new Error("Failed to create");

            const lobby = await response.json();

            navigate(`/lobby/${lobby.roomCode}`);
        } catch (err) {
            console.error("Create Error: ", err);
        }
    };

    return (
        <div className="flex flex-col justify-center items-center h-screen">
            {/* Home content container */}
            <Container width='900px' height='500px' padding='4em' className='gap-8 flex-col border-2 border-dark-grey rounded-lg'>
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
                        <Button label="Join a room"/>
                        <div>Join a room using the code provided by whoever is hosting!</div>
                    </div>
                    {/* How to Play slideshow */}
                    <TutorialSlideshow className='w-hug'/>
                    {/* Start a new room option */}
                    <div className='flex flex-col justify-between items-center w-hug h-full text-center gap-auto'>
                        <PiNumberCircleTwo size={33} />
                        <Button 
                            label="Start a new room"
                            onClick={handleCreateLobby}
                        />
                        <div>Start a room of your own and invite your friends to join!</div>
                    </div>
                </div>
            </Container>
        </div>
    );
}

export default HomePage;