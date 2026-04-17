import './App.css'
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from './contexts/AuthContext';
import { useTokenRefresh } from './hooks/useTokenRefresh';

// Pages
import HomePage from './features/home/HomePage';
import LoginPage from './features/auth/LoginPage';
import SignupPage from './features/auth/SignupPage';
import LobbyPage from './features/lobby/LobbyPage';
import DrawingPage from './features/game/drawing/DrawingPage';
import WritingPage from './features/game/writing/WritingPage';
import WaitingPage from './features/game/waiting/WaitingPage';
import GameCountdownPage from './features/game/countdown/GameCountdownPage';
import RecapPage from './features/game/recap/RecapPage';
import VotingPage from './features/game/voting/VotingPage';
import ResultsPage from './features/game/results/ResultsPage';
import AccountPage from './features/account/AccountPage';
import { ProtectedRoute } from './components/ProtectedRoute';

// Debug page (development only)
import Home from './pages/home';

function AppContent() {
  // Auto refresh tokens
  useTokenRefresh();

  return (
    <div>
      <Routes>
        {/* Main Flow */}
        <Route path="/" element={<HomePage />} />
        <Route
          path="/account"
          element={
            <ProtectedRoute>
              <AccountPage />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        
        {/* Lobby */}
        <Route path="/lobby/:roomCode" element={<LobbyPage />} />
        
        {/* Game Routes */}
        <Route path="/game/:roomCode/countdown" element={<GameCountdownPage />} />
        <Route path="/game/:roomCode/draw" element={<DrawingPage />} />
        <Route path="/game/:roomCode/guess" element={<WritingPage />} />
        <Route path="/game/:roomCode/waiting" element={<WaitingPage />} />
        <Route path="/game/:roomCode/recap" element={<RecapPage />} />
        <Route path="/game/:roomCode/vote" element={<VotingPage />} />
        <Route path="/game/:roomCode/results" element={<ResultsPage />} />
        
        {/* Legacy/Debug Routes */}
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="/drawing" element={<Navigate to="/" replace />} />
        <Route path="/writing" element={<Navigate to="/" replace />} />
        <Route path="/debug" element={<Home />} />
        
        {/* 404 Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  )
}

export default App
