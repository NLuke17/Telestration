import React from 'react';
import AuthForm from '../components/AuthForm';
import Container from '../components/Container';
import InitialAvatar from '../components/Avatar';
import TutorialSlideshow from '../components/TutorialSlideshow';

const LoginPage: React.FC = () => {
    return (
        <div className="flex flex-col justify-center items-center h-screen">
            <Container width='900' height='500' padding='5' className='gap-8 flex-col border-2 border-dark-grey rounded-lg'>
                <h1 className="text-heading-1 w-full text-left">Login</h1>
                <div className="flex flex-row items-center justify-center w-full gap-8">
                    <InitialAvatar size='100' name='Firestone'/>
                    <AuthForm />
                    <TutorialSlideshow />
                </div>
            </Container>
        </div>
    );
}

export default LoginPage;