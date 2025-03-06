import React, { useState, useEffect, useRef } from 'react';
import '../styles/TextToSpeech.css';

const TextToSpeech = () => {
  // State variables
  const [text, setText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState('en-US-AriaNeural');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [paidMessage, setPaidMessage] = useState('');
  const [showPaidMessage, setShowPaidMessage] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Refs
  const audioRef = useRef(null);
  
  // Fetch available voices on component mount
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const response = await fetch('http://localhost:5000/api/tts/voices');
        if (!response.ok) {
          throw new Error('Failed to fetch voices');
        }
        const data = await response.json();
        setVoices(data.voices || []);
      } catch (err) {
        console.error('Error fetching voices:', err);
        setError('Failed to load voice options. Using default voice.');
      }
    };
    
    fetchVoices();
  }, []);
  
  // Handle text change
  const handleTextChange = (e) => {
    setText(e.target.value);
  };
  
  // Handle voice selection
  const handleVoiceChange = (e) => {
    setSelectedVoice(e.target.value);
  };
  
  // Play the text as speech
  const handlePlay = async () => {
    if (!text.trim()) {
      setError('Please enter some text to speak');
      return;
    }
    
    setIsLoading(true);
    setIsProcessing(true);
    setProgress(0);
    setError('');
    
    // Estimate processing time based on text length
    const estimatedTimePerChar = 0.01; // seconds per character
    const totalTime = Math.max(5, text.length * estimatedTimePerChar); // at least 5 seconds
    
    // Start progress simulation
    let startTime = Date.now();
    const progressInterval = setInterval(() => {
      const elapsedTime = (Date.now() - startTime) / 1000;
      const newProgress = Math.min((elapsedTime / totalTime) * 100, 95);
      setProgress(newProgress);
    }, 200);
    
    try {
      const response = await fetch('http://localhost:5000/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice: selectedVoice
        }),
      });
      
      // Clear the progress simulation
      clearInterval(progressInterval);
      
      if (!response.ok) {
        throw new Error('Failed to generate speech');
      }
      
      // Set progress to 100% when done
      setProgress(100);
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      setAudioUrl(audioUrl);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      clearInterval(progressInterval);
      console.error('Error playing speech:', err);
      setError('Failed to play speech. Please try again.');
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        setIsProcessing(false);
        setProgress(0);
      }, 1000); // Keep the 100% progress visible briefly
    }
  };
  
  // Stop playing audio
  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };
  
  // Handle audio end event
  const handleAudioEnd = () => {
    setIsPlaying(false);
  };

  // Handle download functionality
  const handleDownload = () => {
    if (!audioUrl) return;
    
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = 'speech.mp3';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  
  // Array of humorous messages for the paid version popup
  const paidVersionMessages = [
    "Paid version? Are you crazy? This took all of 5 minutes to make!",
    "Do you think I'm greedy or something?",
    "Sorry, the paid version is still in development... and will be forever.",
    "The paid version includes exactly zero extra features.",
    "The paid version is identical, but costs money. Still interested?",
    "If you like this free tool, consider not paying for it!",
    "Paid version temporarily unavailable... permanently."
  ];
  
  // Handle paid version button click
  const handlePaidVersion = () => {
    // Select a random message from the array
    const randomIndex = Math.floor(Math.random() * paidVersionMessages.length);
    setPaidMessage(paidVersionMessages[randomIndex]);
    setShowPaidMessage(true);
    
    // Hide the message after 5 seconds
    setTimeout(() => {
      setShowPaidMessage(false);
    }, 5000);
  };
  
  return (
    <div className="tts-container">
      <div className="tts-content">
        <div className="visualization-container">
          <div className="visualization-panel">
            <h2>Text to Speech</h2>
            <div className="audio-visualization">
              {isPlaying ? (
                <div className="audio-waves">
                  <div className="wave"></div>
                  <div className="wave"></div>
                  <div className="wave"></div>
                  <div className="wave"></div>
                  <div className="wave"></div>
                </div>
              ) : (
                <div className="audio-placeholder">
                  <i className="audio-icon">🔊</i>
                  <p>Enter text and click play</p>
                </div>
              )}
            </div>
            <audio 
              ref={audioRef} 
              onEnded={handleAudioEnd} 
              className="audio-element"
            />
          </div>
        </div>
        
        <div className="parameters-container">
          <div className="parameters-panel">
            <div className="form-group">
              <label htmlFor="text-input">Text to speak:</label>
              <textarea
                id="text-input"
                value={text}
                onChange={handleTextChange}
                placeholder="Enter text to convert to speech..."
                rows="6"
                className="text-input"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="voice-select">Select voice:</label>
              <select
                id="voice-select"
                value={selectedVoice}
                onChange={handleVoiceChange}
                className="voice-select"
              >
                {voices.length === 0 ? (
                  <option value="en-US-AriaNeural">Default - Aria (English US)</option>
                ) : (
                  voices.map((voice) => (
                    <option key={voice.ShortName} value={voice.ShortName}>
                      {voice.FriendlyName}
                    </option>
                  ))
                )}
              </select>
            </div>
            
            <div className="controls">
              <button
                onClick={handlePlay}
                disabled={isLoading || !text.trim()}
                className={`btn play-btn ${isLoading ? 'loading' : ''}`}
              >
                {isLoading ? 'Loading...' : 'Play'}
              </button>
              
              <button
                onClick={handleStop}
                disabled={!isPlaying}
                className="btn stop-btn"
              >
                Stop
              </button>
              
              <button
                onClick={handleDownload}
                disabled={!audioUrl}
                className="btn download-btn"
              >
                Download MP3
              </button>
              
              <button
                onClick={handlePaidVersion}
                className="btn paid-btn"
              >
                Paid Version
              </button>
            </div>
            
            {error && <div className="error-message">{error}</div>}
            
            {isProcessing && (
              <div className="progress-container">
                <div className="progress-bar" style={{ width: `${progress}%` }}></div>
                <div className="progress-text">{Math.round(progress)}%</div>
              </div>
            )}
            
            {showPaidMessage && (
              <div className="paid-message-popup">
                <p>{paidMessage}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextToSpeech;