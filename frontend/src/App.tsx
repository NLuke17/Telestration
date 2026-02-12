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
    </Router>
  )
}

export default App
