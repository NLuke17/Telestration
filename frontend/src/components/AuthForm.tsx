import { useState } from 'react';

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
                <label>Username</label>
                <input
                    type="text"
                    placeholder='Enter your username'
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className='border'
                    />
            </div>
            <div>
                <label>Password</label>
                <input
                    type="text"
                    placeholder='Enter your password'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
            </div>
            <button type="submit">Login</button>
        </form>
    );
}

export default AuthForm;