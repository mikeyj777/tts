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
  const isTransitioning = useRef(false);
  
  // API URLs - make sure these match your Flask server configuration
  const API_BASE_URL = 'http://localhost:5000';
  const TTS_ENDPOINT = `${API_BASE_URL}/api/tts`;
  const VOICES_ENDPOINT = `${API_BASE_URL}/api/tts/voices`;
  const STREAM_ENDPOINT = `${API_BASE_URL}/api/tts/stream`;
  const TEST_AUDIO_ENDPOINT = `${API_BASE_URL}/api/test-audio`;
  
  // Log API config and set up audio helpers
  useEffect(() => {
    // Log API configuration
    console.log('API Configuration:', {
      baseUrl: API_BASE_URL,
      ttsEndpoint: TTS_ENDPOINT,
      voicesEndpoint: VOICES_ENDPOINT,
      streamEndpoint: STREAM_ENDPOINT
    });
    
    // Configure audio elements
    if (audioRef.current) {
      audioRef.current.preload = 'auto';
    }
  }, []);
  
  // Create a function to handle audio loading with better error checking
  const setupAudio = useCallback((url) => {
    if (!audioRef.current) {
      console.error('Audio ref is null');
      return null;
    }
    
    if (!url || url === '') {
      console.error('Empty URL provided to setupAudio');
      setError('Error: No audio data received from server');
      return null;
    }
    
    // Reset previous handlers
    audioRef.current.oncanplaythrough = null;
    audioRef.current.onerror = null;
    
    // Set up new handlers
    audioRef.current.oncanplaythrough = () => {
      console.log('Audio can play through - ready to start');
    };
    
    audioRef.current.onerror = (e) => {
      console.error('Audio element error:', e);
      console.error('Audio error code:', audioRef.current.error ? audioRef.current.error.code : 'unknown');
      console.error('Audio error message:', audioRef.current.error ? audioRef.current.error.message : 'unknown');
      setError(`Audio error: ${audioRef.current.error ? audioRef.current.error.message : 'unknown error'}`);
      isTransitioning.current = false;
    };
    
    try {
      // Set source and load audio
      console.log('Setting audio source to:', url);
      if (url && url.trim() !== '') {
        audioRef.current.src = url;
        audioRef.current.load();
        console.log('Audio setup completed with URL:', url);
        return url;
      } else {
        console.error('Attempted to set empty URL in setupAudio');
        setError('Error: Invalid audio data received');
        return null;
      }
    } catch (err) {
      console.error('Error in setupAudio:', err);
      setError(`Error setting up audio: ${err.message}`);
      return null;
    }
  }, []);
  
  // Fetch available voices on component mount
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const response = await fetch(VOICES_ENDPOINT);
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
      
      const response = await fetch(STREAM_ENDPOINT, {
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
      const response = await fetch(STREAM_ENDPOINT, {
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
        audioChunksRef.current[nextIndex].play()
          .catch(err => {
            console.error(`Error playing chunk ${nextIndex}:`, err);
            setError(`Failed to play chunk ${nextIndex}`);
          });
      } else {
        // Try to load it if not already loaded
        loadChunk(nextIndex).then(url => {
          if (audioChunksRef.current[nextIndex]) {
            audioChunksRef.current[nextIndex].play().catch(err => {
              console.error(`Error playing loaded chunk ${nextIndex}:`, err);
            });
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
      isTransitioning.current = false;
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
    // Prevent rapid consecutive calls
    if (isTransitioning.current) return;
    isTransitioning.current = true;
    
    if (!text.trim()) {
      setError('Please enter some text to speak');
      isTransitioning.current = false;
      return;
    }
    
    // If we're resuming from pause
    if (isPaused) {
      if (isProgressiveLoading && audioChunksRef.current[currentChunkIndex]) {
        audioChunksRef.current[currentChunkIndex].play()
          .then(() => {
            setIsPlaying(true);
            setIsPaused(false);
          })
          .catch(err => {
            console.error('Error resuming audio:', err);
            setError('Failed to resume playback');
          })
          .finally(() => {
            isTransitioning.current = false;
          });
        return;
      } else if (audioRef.current) {
        audioRef.current.play()
          .then(() => {
            setIsPlaying(true);
            setIsPaused(false);
          })
          .catch(err => {
            console.error('Error resuming audio:', err);
            setError('Failed to resume playback');
          })
          .finally(() => {
            isTransitioning.current = false;
          });
        return;
      }
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
          audioChunksRef.current[0].play()
            .then(() => {
              setIsPlaying(true);
              setIsProgressiveLoading(true);
            })
            .catch(err => {
              console.error('Error playing first chunk:', err);
              throw new Error('Failed to play first chunk');
            })
            .finally(() => {
              isTransitioning.current = false;
            });
        } else {
          throw new Error('Failed to initialize progressive playback');
        }
      } catch (err) {
        console.error('Error with progressive playback:', err);
        setError('Progressive playback failed. Falling back to standard mode.');
        // Fall back to standard mode
        setTimeout(() => {
          playStandardMode();
        }, 100);
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
      const response = await fetch(TTS_ENDPOINT, {
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
      
      console.log('Response status:', response.status);
      console.log('Response headers:', [...response.headers.entries()]);
      
      if (!response.ok) {
        console.error('Response not OK:', response.status, response.statusText);
        const errorText = await response.text().catch(e => 'Unable to get error details');
        console.error('Error response body:', errorText);
        throw new Error(`Failed to generate speech: ${response.status} ${response.statusText}`);
      }
      
      // Set progress to 100% when done
      setProgress(100);
      
      const audioBlob = await response.blob();
      console.log('Audio blob received:', {
        type: audioBlob.type,
        size: audioBlob.size,
        lastModified: audioBlob.lastModified
      });
      
      // Check if blob is valid
      if (audioBlob.size === 0) {
        throw new Error('Received empty audio data from server');
      }
      
      // Check content type
      if (!audioBlob.type.includes('audio')) {
        console.warn('Unexpected content type in response:', audioBlob.type);
        // Try to detect if we got an error response instead of audio
        if (audioBlob.type.includes('application/json') || audioBlob.type.includes('text')) {
          const textData = await new Response(audioBlob).text();
          console.error('Received text instead of audio:', textData);
          throw new Error(`Server returned text instead of audio: ${textData.substring(0, 100)}...`);
        }
      }
      
      // Create URL from blob
      const audioUrl = URL.createObjectURL(audioBlob);
      console.log('Created object URL:', audioUrl);
      setAudioUrl(audioUrl);
      
      // Reset to first sentence
      setCurrentSentenceIndex(0);
      setIsProgressiveLoading(false);
      
      if (audioRef.current) {
        // Set up audio with error handling
        const setupResult = setupAudio(audioUrl);
        
        if (!setupResult) {
          throw new Error('Failed to set up audio element');
        }
        
        // Manual check before playing
        if (!audioRef.current.src || audioRef.current.src === '') {
          throw new Error('Audio source is empty after setup');
        }
        
        console.log('Starting playback with src:', audioRef.current.src);
        
        // Play the audio
        try {
          const playPromise = audioRef.current.play();
          
          if (playPromise) {
            playPromise
              .then(() => {
                console.log('Audio playback started successfully');
                setIsPlaying(true);
              })
              .catch(err => {
                console.error('Error during audio playback:', err);
                setError(`Failed to play audio: ${err.message}`);
              })
              .finally(() => {
                isTransitioning.current = false;
              });
          } else {
            console.log('Play did not return a promise - older browser?');
            setIsPlaying(true);
            isTransitioning.current = false;
          }
        } catch (err) {
          console.error('Exception during play():', err);
          setError(`Exception during playback: ${err.message}`);
          isTransitioning.current = false;
        }
      } else {
        console.error('Audio ref is null when trying to play');
        setError('Internal error: Audio player not available');
        isTransitioning.current = false;
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
        if (!isTransitioning.current) {
          isTransitioning.current = false;
        }
      }, 1000); // Keep the 100% progress visible briefly
    }
  };
  
  // Stop playing audio
  const handleStop = () => {
    if (isTransitioning.current) return;
    isTransitioning.current = true;
    
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
    setTimeout(() => {
      isTransitioning.current = false;
    }, 100); // Brief delay to prevent immediate play/pause conflicts
  };
  
  // Pause playing audio
  const handlePause = () => {
    if (isTransitioning.current) return;
    isTransitioning.current = true;
    
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
    
    setTimeout(() => {
      isTransitioning.current = false;
    }, 100); // Brief delay to prevent immediate play/pause conflicts
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
    
    // Hide the message after 3 seconds
    setTimeout(() => {
      setShowPaidMessage(false);
    }, 3000);
  };
  
  // Test audio playback with a simple static audio
  const testAudioPlayback = async () => {
    try {
      setError('');
      console.log('Testing audio playback with test endpoint');
      
      const response = await fetch(TEST_AUDIO_ENDPOINT);
      
      if (!response.ok) {
        throw new Error(`Error fetching test audio: ${response.status} ${response.statusText}`);
      }
      
      const testBlob = await response.blob();
      console.log('Test audio blob:', {
        type: testBlob.type,
        size: testBlob.size
      });
      
      if (testBlob.size === 0) {
        throw new Error('Test audio blob is empty');
      }
      
      const testUrl = URL.createObjectURL(testBlob);
      console.log('Test audio URL:', testUrl);
      
      // Create a temporary audio element
      const tempAudio = new Audio(testUrl);
      
      tempAudio.onerror = (e) => {
        console.error('Test audio error:', e);
        setError('Test audio error: ' + (tempAudio.error?.message || 'unknown error'));
      };
      
      tempAudio.oncanplaythrough = () => {
        console.log('Test audio loaded and can play');
      };
      
      // Play the test audio
      try {
        await tempAudio.play();
        console.log('Test audio playing');
      } catch (err) {
        console.error('Error playing test audio:', err);
        setError(`Test audio play error: ${err.message}`);
      }
    } catch (err) {
      console.error('Test audio error:', err);
      setError(`Test audio error: ${err.message}`);
    }
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
              onLoadedData={() => console.log('Audio loaded')}
              onCanPlayThrough={() => console.log('Audio can play through')}
              onStalled={() => console.log('Audio playback stalled')}
              onSuspend={() => console.log('Audio loading suspended')}
              className="audio-element"
              preload="metadata"
              src={audioUrl || null}
              onError={(e) => {
                // Only log errors if we have a URL set
                if (audioUrl) {
                  console.error('Audio error:', e);
                  console.error('Audio error details:', audioRef.current?.error);
                  setError('Error loading audio. Please try again.');
                }
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
              
              <button
                onClick={testAudioPlayback}
                className="btn test-btn"
              >
                Test Audio
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