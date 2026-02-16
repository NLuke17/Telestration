import './App.css'
import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";

//import PageName from './pages/PageName';
import Home from './pages/home';
import LoginPage from './pages/LoginPage';
import DrawingPage from './pages/DrawingPage';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<Home />} />
          {/*<Route path="/explore" element={<Explore />} /> */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/drawing" element={<DrawingPage />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App
