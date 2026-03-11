import React from 'react';
import { Link } from 'react-router-dom';
import AuthForm from './components/AuthForm';
import Container from '../../components/common/Container';
import InitialAvatar from '../../components/common/Avatar';
import Tutorial from '../../components/common/Tutorial';

const LoginPage: React.FC = () => {
    return (
        <div className="flex flex-col justify-center items-center h-screen">
            <Container width='900px' height='500px' padding='5em' className='flex items-center justify-center gap-2 flex-col border-2 border-dark-grey rounded-lg'>
                <h1 className="text-heading-1 w-full text-left">Login</h1>
                <div className="flex flex-row items-center justify-center w-full gap-8">
                    <InitialAvatar size='100' name='Firestone'/>
                    <AuthForm mode="login" />
                    <Tutorial/>
                </div>
                <div className="text-sm text-center">
                    Don't have an account? <Link to="/signup" className="text-brand-charcoal font-semibold hover:underline">Sign up here</Link>
                </div>
            </Container>
        </div>
    );
}

export default LoginPage;
