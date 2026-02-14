import './App.css'
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";

//import PageName from './pages/PageName';
import Home from './pages/home';
import LoginPage from './pages/LoginPage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  return (
    <Router>
      <div className="p-4">
        <Routes>
          <Route path="/" element={<Home />} />
          {/*<Route path="/explore" element={<Explore />} /> */}
        </Routes>
      </div>

      <div className="w-full">
        <LoginPage />
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
