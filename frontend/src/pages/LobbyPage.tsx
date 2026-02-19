import React from 'react';
import Container from '../components/Container';
import Button from '../components/Button';

 const LobbyPage: React.FC = () => {

    return (
        <div className="flex flex-col justify-center items-center h-screen bg-gray-50">
            <Container 
                width='900' 
                height='500' 
                margin='0' 
                className='gap-2 flex-col border-2 border-dark-grey rounded-lg bg-white shadow-xl p-12'
            >
                {/* Header */}
                <h1 className="text-heading-1 w-full text-left mb-0">Join Room</h1>
                
                {/* Left: players */}
                    <div className="flex flex-col gap-6 w-1/2">
                        <Container
                            width='150'
                            height='auto'
                            margin='0'
                            className='flex flex-col items-start border-2 border-light-grey rounded-lg bg-white shadow-xl p-2'>                          
                            <h2 className="text-lg font-bold text-left w-full">Players</h2>
                        </Container>
                        <p>Player 1</p>
                        <p>Player 2</p>
                        <p>Player 3</p>
                    </div>

            </Container>
        </div>
    );
}

 export default LobbyPage