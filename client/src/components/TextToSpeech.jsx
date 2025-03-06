import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/TextToSpeech.css';

const TextToSpeech = () => {
  // State variables
  const [text, setText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState('en-US-AriaNeural');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [paidMessage, setPaidMessage] = useState('');
  const [showPaidMessage, setShowPaidMessage] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sentences, setSentences] = useState([]);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  
  // Progressive loading state
  const [chunks, setChunks] = useState([]);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [isProgressiveLoading, setIsProgressiveLoading] = useState(false);
  const [chunkProgress, setChunkProgress] = useState(0);
  const [loadedChunks, setLoadedChunks] = useState({});
  const chunkLoadingRef = useRef(false);
  const audioChunksRef = useRef([]);
  
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
  
  // Split text into sentences
  const splitIntoSentences = (text) => {
    // Regular expression to split by sentence endings (., !, ?) followed by spaces or newlines
    return text.split(/(?<=[.!?])\s+/)
      .filter(sentence => sentence.trim() !== '');
  };
  
  // Handle text change
  const handleTextChange = (e) => {
    const newText = e.target.value;
    setText(newText);
    const newSentences = splitIntoSentences(newText);
    setSentences(newSentences);
  };
  
  // Handle voice selection
  const handleVoiceChange = (e) => {
    setSelectedVoice(e.target.value);
  };
  
  // Load a specific chunk
  const loadChunk = useCallback(async (chunkIndex) => {
    if (loadedChunks[chunkIndex] || chunkLoadingRef.current) return;
    
    try {
      chunkLoadingRef.current = true;
      setChunkProgress((prevProgress) => ({
        ...prevProgress,
        [chunkIndex]: 0
      }));
      
      const response = await fetch('http://localhost:5000/api/tts/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice: selectedVoice,
          chunk_index: chunkIndex
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load chunk ${chunkIndex}`);
      }
      
      // Get total chunks from header
      const totalChunks = parseInt(response.headers.get('X-Total-Chunks') || '1', 10);
      setTotalChunks(totalChunks);
      
      // Get chunk text if available
      const chunkText = response.headers.get('X-Chunk-Text');
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Store the loaded chunk
      setLoadedChunks(prev => ({
        ...prev, 
        [chunkIndex]: { url: audioUrl, text: chunkText }
      }));
      
      // Add to audio chunks array
      const chunkAudio = new Audio(audioUrl);
      
      // Add time update event listener to track sentences
      chunkAudio.addEventListener('timeupdate', handleTimeUpdate);
      
      audioChunksRef.current[chunkIndex] = chunkAudio;
      
      // Start loading next chunk if not already loaded
      if (chunkIndex < totalChunks - 1 && !loadedChunks[chunkIndex + 1]) {
        loadChunk(chunkIndex + 1);
      }
      
      chunkLoadingRef.current = false;
      return audioUrl;
    } catch (err) {
      console.error(`Error loading chunk ${chunkIndex}:`, err);
      chunkLoadingRef.current = false;
      throw err;
    }
  }, [text, selectedVoice, loadedChunks]);
  
  // Initialize progressive loading
  const initializeProgressiveLoading = useCallback(async () => {
    try {
      setIsProgressiveLoading(true);
      
      // First, get chunks info
      const response = await fetch('http://localhost:5000/api/tts/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          voice: selectedVoice,
          get_chunks_info: true
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to initialize progressive loading');
      }
      
      const data = await response.json();
      setTotalChunks(data.total_chunks);
      setChunks(data.chunks_info || []);
      
      // Reset state
      setCurrentChunkIndex(0);
      setLoadedChunks({});
      audioChunksRef.current = [];
      
      // Start loading first chunk
      if (data.total_chunks > 0) {
        await loadChunk(0);
        return true;
      }
      
      return false;
    } catch (err) {
      console.error('Error initializing progressive loading:', err);
      setError('Failed to initialize audio processing. Please try again.');
      setIsProgressiveLoading(false);
      return false;
    }
  }, [text, selectedVoice, loadChunk]);
  
  // Play next chunk
  const playNextChunk = useCallback(() => {
    const nextIndex = currentChunkIndex + 1;
    if (nextIndex < totalChunks) {
      setCurrentChunkIndex(nextIndex);
      if (audioChunksRef.current[nextIndex]) {
        audioChunksRef.current[nextIndex].play();
      } else {
        // Try to load it if not already loaded
        loadChunk(nextIndex).then(url => {
          if (audioChunksRef.current[nextIndex]) {
            audioChunksRef.current[nextIndex].play();
          }
        }).catch(err => {
          setError(`Failed to load next chunk: ${err.message}`);
        });
      }
    } else {
      // All chunks completed
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentChunkIndex(0);
    }
  }, [currentChunkIndex, totalChunks, loadChunk]);
  
  // Set up chunk audio event listeners
  useEffect(() => {
    if (audioChunksRef.current[currentChunkIndex]) {
      const currentAudio = audioChunksRef.current[currentChunkIndex];
      
      const handleChunkEnded = () => {
        playNextChunk();
      };
      
      currentAudio.addEventListener('ended', handleChunkEnded);
      
      return () => {
        currentAudio.removeEventListener('ended', handleChunkEnded);
      };
    }
  }, [currentChunkIndex, playNextChunk]);
  
  // Cleanup all audio elements on unmount
  useEffect(() => {
    return () => {
      // Clean up all chunk audio elements
      audioChunksRef.current.forEach(audio => {
        if (audio) {
          audio.pause();
          audio.src = '';
          audio.removeEventListener('timeupdate', handleTimeUpdate);
        }
      });
      
      // Clean up main audio element
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      
      // Release object URLs
      Object.values(loadedChunks).forEach(chunk => {
        if (chunk && chunk.url) {
          URL.revokeObjectURL(chunk.url);
        }
      });
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [loadedChunks, audioUrl]);

  // Play the text as speech
  const handlePlay = async () => {
    if (!text.trim()) {
      setError('Please enter some text to speak');
      return;
    }
    
    // If we're resuming from pause
    if (isPaused) {
      if (isProgressiveLoading && audioChunksRef.current[currentChunkIndex]) {
        audioChunksRef.current[currentChunkIndex].play();
        setIsPlaying(true);
        setIsPaused(false);
      } else if (audioRef.current) {
        audioRef.current.play();
        setIsPlaying(true);
        setIsPaused(false);
      }
      return;
    }
    
    setIsLoading(true);
    setIsProcessing(true);
    setProgress(0);
    setError('');
    setIsPaused(false);
    
    // Check if text is long enough for progressive loading (over ~500 chars)
    const shouldUseProgressiveLoading = text.length > 500;
    
    if (shouldUseProgressiveLoading) {
      try {
        // Initialize progressive loading
        const success = await initializeProgressiveLoading();
        
        if (success && audioChunksRef.current[0]) {
          // Start playing the first chunk
          audioChunksRef.current[0].play();
          setIsPlaying(true);
          setIsProgressiveLoading(true);
        } else {
          throw new Error('Failed to initialize progressive playback');
        }
      } catch (err) {
        console.error('Error with progressive playback:', err);
        setError('Progressive playback failed. Falling back to standard mode.');
        // Fall back to standard mode
        playStandardMode();
      } finally {
        setIsLoading(false);
        setIsProcessing(false);
      }
    } else {
      // Use standard playback for shorter texts
      playStandardMode();
    }
  };
  
  // Standard non-progressive playback
  const playStandardMode = async () => {
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
      
      // Reset to first sentence
      setCurrentSentenceIndex(0);
      setIsProgressiveLoading(false);
      
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
    if (isProgressiveLoading) {
      // Stop all chunk audios
      audioChunksRef.current.forEach(audio => {
        if (audio) {
          audio.pause();
          audio.currentTime = 0;
        }
      });
      setCurrentChunkIndex(0);
    } else if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentSentenceIndex(0);
  };
  
  // Pause playing audio
  const handlePause = () => {
    if (isProgressiveLoading) {
      // Pause current chunk audio
      if (audioChunksRef.current[currentChunkIndex]) {
        audioChunksRef.current[currentChunkIndex].pause();
        setIsPlaying(false);
        setIsPaused(true);
      }
    } else if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      setIsPaused(true);
    }
  };
  
  // Handle audio time update to track current sentence
  const handleTimeUpdate = () => {
    if (isProgressiveLoading) {
      // For progressive mode, use the chunk text instead
      // If we have current chunk info, use that to determine the current sentence
      const sentencesInChunk = chunks[currentChunkIndex] ? 
        splitIntoSentences(chunks[currentChunkIndex].text || '') : [];
      
      // If there's an audio element for the current chunk, use it to calculate progress
      if (audioChunksRef.current[currentChunkIndex]) {
        const audio = audioChunksRef.current[currentChunkIndex];
        const duration = audio.duration || 1;
        const currentTime = audio.currentTime || 0;
        const progress = currentTime / duration;
        
        // Calculate offset based on previous chunks' sentences
        let sentenceOffset = 0;
        for (let i = 0; i < currentChunkIndex; i++) {
          if (chunks[i] && chunks[i].text) {
            sentenceOffset += splitIntoSentences(chunks[i].text).length;
          }
        }
        
        // Calculate which sentence within the chunk
        const chunkSentenceIndex = Math.min(
          Math.floor(progress * sentencesInChunk.length),
          sentencesInChunk.length - 1
        );
        
        // Set the global sentence index
        const globalSentenceIndex = sentenceOffset + Math.max(0, chunkSentenceIndex);
        if (globalSentenceIndex !== currentSentenceIndex) {
          setCurrentSentenceIndex(globalSentenceIndex);
        }
      }
    } else if (audioRef.current && sentences.length > 0) {
      // Standard mode - calculate based on time
      const duration = audioRef.current.duration;
      const currentTime = audioRef.current.currentTime;
      const progress = currentTime / duration;
      
      // Estimate which sentence we're on based on overall progress
      const estimatedIndex = Math.min(
        Math.floor(progress * sentences.length),
        sentences.length - 1
      );
      
      if (estimatedIndex !== currentSentenceIndex) {
        setCurrentSentenceIndex(estimatedIndex);
      }
    }
  };
  
  // Handle audio end event
  const handleAudioEnd = () => {
    setIsPlaying(false);
    setIsPaused(false);
  };

  // Handle download functionality
  const handleDownload = async () => {
    if (isProgressiveLoading && totalChunks > 0) {
      // For progressive mode, we need to combine all chunks
      setIsLoading(true);
      setError('');
      
      try {
        // Make sure all chunks are loaded
        const missingChunks = [];
        for (let i = 0; i < totalChunks; i++) {
          if (!loadedChunks[i]) {
            missingChunks.push(i);
          }
        }
        
        // Load any missing chunks
        if (missingChunks.length > 0) {
          await Promise.all(missingChunks.map(i => loadChunk(i)));
        }
        
        // Combine all chunks into one blob
        const combinedBlobs = [];
        for (let i = 0; i < totalChunks; i++) {
          if (loadedChunks[i] && loadedChunks[i].url) {
            const response = await fetch(loadedChunks[i].url);
            const blob = await response.blob();
            combinedBlobs.push(blob);
          }
        }
        
        const combinedBlob = new Blob(combinedBlobs, { type: 'audio/mp3' });
        const combinedUrl = URL.createObjectURL(combinedBlob);
        
        // Create download link
        const a = document.createElement('a');
        a.href = combinedUrl;
        a.download = 'speech.mp3';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // Clean up
        URL.revokeObjectURL(combinedUrl);
      } catch (err) {
        console.error('Error combining audio chunks for download:', err);
        setError('Failed to create downloadable file. Please try again.');
      } finally {
        setIsLoading(false);
      }
    } else if (audioUrl) {
      // Standard mode - just download the single file
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = 'speech.mp3';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
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
                <>
                  <div className="current-sentence">
                    {sentences[currentSentenceIndex] || ''}
                  </div>
                  <div className="audio-waves">
                    <div className={`wave ${isPaused ? 'paused' : ''}`}></div>
                    <div className={`wave ${isPaused ? 'paused' : ''}`}></div>
                    <div className={`wave ${isPaused ? 'paused' : ''}`}></div>
                    <div className={`wave ${isPaused ? 'paused' : ''}`}></div>
                    <div className={`wave ${isPaused ? 'paused' : ''}`}></div>
                  </div>
                </>
              ) : isPaused ? (
                <>
                  <div className="current-sentence">
                    {sentences[currentSentenceIndex] || ''}
                  </div>
                  <div className="audio-paused">
                    <i className="audio-icon">⏸️</i>
                    <p>Paused - press Resume to continue</p>
                  </div>
                </>
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
              onTimeUpdate={handleTimeUpdate}
              className="audio-element"
              preload="auto"
              onError={(e) => {
                console.error('Audio error:', e);
                setError('Error loading audio. Please try again.');
              }}
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
                disabled={isLoading || (!isPaused && !text.trim())}
                className={`btn play-btn ${isLoading ? 'loading' : ''}`}
              >
                {isLoading ? 'Loading...' : isPaused ? 'Resume' : 'Play'}
              </button>
              
              <button
                onClick={handlePause}
                disabled={!isPlaying}
                className="btn pause-btn"
              >
                Pause
              </button>
              
              <button
                onClick={handleStop}
                disabled={!isPlaying && !isPaused}
                className="btn stop-btn"
              >
                Stop
              </button>
              
              <button
                onClick={handleDownload}
                disabled={!audioUrl && (!isProgressiveLoading || Object.keys(loadedChunks).length === 0)}
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
            
            {isProgressiveLoading && (
              <div className="chunk-info">
                <div className="chunk-progress">
                  <div className="chunk-label">Progressive loading: Chunk {currentChunkIndex + 1} of {totalChunks}</div>
                  <div className="chunk-progress-container">
                    {Array.from({ length: totalChunks }).map((_, i) => (
                      <div 
                        key={i}
                        className={`chunk-indicator ${i < currentChunkIndex ? 'complete' : i === currentChunkIndex ? 'current' : 'pending'} ${loadedChunks[i] ? 'loaded' : ''}`}
                      ></div>
                    ))}
                  </div>
                </div>
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