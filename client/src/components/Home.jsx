import React, { useState, useEffect } from 'react';
import '../styles/Home.css';

const Home = () => {
  const [phrase, setPhrase] = useState('');
  const [isVisible, setIsVisible] = useState(false);

  const welcomePhrases = [
    "Welcome to the coolest React app ever! 🚀",
    "Hey there! Ready to build something amazing? ✨",
    "You've arrived at your digital destination! 🌟",
    "Congratulations! You've successfully started your journey! 🎉",
    "Welcome aboard the React express! Next stop: Awesome! 🚂",
    "Houston, we have a successful launch! 🛸",
    "Your React app is alive and kicking! 💫",
    "Welcome to the future of web development! 🌈",
    "Ready to create some magic? You're in the right place! ✨",
    "Look at you, building cool stuff already! 🌟"
  ];

  useEffect(() => {
    // Select random phrase
    const randomPhrase = welcomePhrases[Math.floor(Math.random() * welcomePhrases.length)];
    setPhrase(randomPhrase);
    
    // Trigger animation after a short delay
    setTimeout(() => setIsVisible(true), 500);

    // Optional: Change phrase every 10 seconds
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        const newPhrase = welcomePhrases[Math.floor(Math.random() * welcomePhrases.length)];
        setPhrase(newPhrase);
        setIsVisible(true);
      }, 500);
    }, 10000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="home-container">
      <div className={`welcome-card ${isVisible ? 'visible' : ''}`}>
        <div className="sparkles-container">
          <div className="sparkle s1"></div>
          <div className="sparkle s2"></div>
          <div className="sparkle s3"></div>
        </div>
        <h1 className="welcome-text">{phrase}</h1>
        <div className="pulse-circle"></div>
      </div>
    </div>
  );
};

export default Home;