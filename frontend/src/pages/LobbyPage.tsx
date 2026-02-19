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
                
                
            </Container>
        </div>
    );
}

 export default LobbyPage