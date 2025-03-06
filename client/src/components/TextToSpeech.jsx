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
    setError('');
    
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
      
      if (!response.ok) {
        throw new Error('Failed to generate speech');
      }
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('Error playing speech:', err);
      setError('Failed to play speech. Please try again.');
    } finally {
      setIsLoading(false);
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
            </div>
            
            {error && <div className="error-message">{error}</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TextToSpeech;