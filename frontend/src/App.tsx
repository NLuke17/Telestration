import './App.css'
import { useEffect, useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const [backendMessage, setBackendMessage] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBackend = async () => {
    try {
      const response = await fetch(`${API_URL}`);
      const data = await response.json();
      setBackendMessage(data);
    } catch (error) {
      console.error('Failed to fetch:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBackend();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-slate-800 mb-2">Telestration</h1>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm max-w-sm w-full">
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-400' : backendMessage ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-slate-600 text-sm">
            {isLoading ? 'Connecting...' : backendMessage ? 'Connected' : 'Disconnected'}
          </span>
        </div>

        {backendMessage?.message && (
          <p className="text-slate-700 bg-slate-100 rounded p-3 text-sm">{backendMessage.message}</p>
        )}

        <button 
          onClick={fetchBackend}
          className="mt-4 w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>
  )
}

export default App
