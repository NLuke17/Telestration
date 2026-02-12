import { useState } from 'react';
import InputField from './InputField';

const AuthForm = () => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

    function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        console.log("Logging in with: ", username, password);
    }

    return (
        <form onSubmit={handleLogin}>
            <div className="flex flex-col">
                <InputField 
                    label="Username"
                    placeholder="Enter your username"
                    value={username}
                    onChange={setUsername}
                />
            </div>
            <div className='flex flex-col'>
                <InputField
                    label="Password"
                    placeholder="Enter your password"
                    value={password}
                    type='password'
                    onChange={setPassword}
                />
            </div>
            <button type="submit">Login</button>
        </form>
    );
}

export default AuthForm;