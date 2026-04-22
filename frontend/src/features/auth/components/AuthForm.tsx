import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import InputField from '../../../components/common/InputField';
import Button from '../../../components/common/Button';
import { useAuth } from '../../../contexts/AuthContext';

interface AuthFormProps {
    mode?: 'login' | 'signup';
}

const AuthForm: React.FC<AuthFormProps> = ({ mode = 'login' }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    
    const { login, signup } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        
        // Validate inputs before submitting
        if (!username.trim()) {
            setError('Username is required');
            return;
        }
        
        if (!password.trim()) {
            setError('Password is required');
            return;
        }
        
        setIsLoading(true);

        try {
            if (mode === 'signup') {
                await signup({ username, password });
            } else {
                await login({ username, password });
            }
            // Navigate to home page after successful auth
            navigate('/');
        } catch (err: any) {
            let errorMessage = 'Authentication failed';
            
            // Handle validation errors from backend
            if (err?.data?.error === 'Validation failed' && err?.data?.details) {
                const details = err.data.details.map((d: any) => d.message).join(', ');
                errorMessage = `Validation error: ${details}`;
            } else if (err?.data?.message) {
                errorMessage = err.data.message;
            } else if (err?.message) {
                errorMessage = err.message;
            }
            
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <form className='w-full' onSubmit={handleSubmit}>
            <div className='flex flex-col gap-6'>
                {error && (
                    <div className="text-red-500 text-sm p-2 bg-red-50 rounded">
                        {error}
                    </div>
                )}
                <div className="flex flex-col">
                    <InputField 
                        id='username'
                        label="Username"
                        placeholder="Enter your username"
                        value={username}
                        onChange={setUsername}
                        disabled={isLoading}
                        required={true}
                    />
                </div>
                <div className='flex flex-col'>
                    <InputField
                        id='password'
                        label="Password"
                        placeholder="Enter your password"
                        value={password}
                        type='password'
                        onChange={setPassword}
                        disabled={isLoading}
                        required={true}
                    />
                </div>
                <Button
                    label={isLoading ? 'Please wait...' : (mode === 'signup' ? 'Sign Up' : 'Login')}
                    type="submit"
                    disabled={isLoading}
                />
            </div>
        </form>
    );
}

export default AuthForm;
