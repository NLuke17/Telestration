import React from 'react';
import AuthForm from '../components/AuthForm';
import Container from '../components/Container';

const LoginPage: React.FC = () => {
    return (
        <Container>
            <AuthForm />
        </Container>
    );
}

export default LoginPage;