import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Home from './components/Home';
import TextToSpeech from './components/TextToSpeech';
import './App.css';
import './styles/global.css';

const App = () => {
  return (
    <Router>
      <div>
        <nav className="app-navigation">
          <Link to="/" className="nav-link">Home</Link>
          <Link to="/text-to-speech" className="nav-link">Text to Speech</Link>
        </nav>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/text-to-speech" element={<TextToSpeech />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;