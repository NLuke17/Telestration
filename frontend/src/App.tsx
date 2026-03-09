import './App.css'
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

// Pages
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import LobbyPage from './pages/LobbyPage';
import DrawingPage from './pages/DrawingPage';
import WritingPage from './pages/WritingPage';
import WaitingPage from './pages/WaitingPage';

// Debug page (development only)
import Home from './pages/home';

function App() {
  return (
    <Router>
      <div>
        <Routes>
          {/* Main Flow */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          
          {/* Lobby */}
          <Route path="/lobby/:roomCode" element={<LobbyPage />} />
          
          {/* Game Routes */}
          <Route path="/game/:roomCode/draw" element={<DrawingPage />} />
          <Route path="/game/:roomCode/guess" element={<WritingPage />} />
          <Route path="/game/:roomCode/waiting" element={<WaitingPage />} />
          
          {/* Legacy/Debug Routes */}
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/drawing" element={<Navigate to="/" replace />} />
          <Route path="/writing" element={<Navigate to="/" replace />} />
          <Route path="/debug" element={<Home />} />
          
          {/* 404 Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
