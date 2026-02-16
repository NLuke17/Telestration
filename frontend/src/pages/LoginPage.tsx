import React from 'react';
import AuthForm from '../components/AuthForm';
import Container from '../components/Container';
import InitialAvatar from '../components/Avatar';

const LoginPage: React.FC = () => {
    return (
        <Container width='900'>
            <InitialAvatar name='Firestone'/>
            <AuthForm />
        </Container>
    );
}

export default LoginPage;