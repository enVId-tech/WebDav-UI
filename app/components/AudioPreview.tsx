"use client";
import React, { useState, useRef, useEffect } from 'react';
import styles from '@/app/styles/audioPreview.module.scss';

interface AudioPreviewProps {
  src: string;
  fileName: string;
  mimeType: string;
}

const AudioPreview: React.FC<AudioPreviewProps> = ({ src, fileName, mimeType }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [albumArt, setAlbumArt] = useState<string | null>(null);
  const [audioFrequencyData, setAudioFrequencyData] = useState<Uint8Array | null>(null);
  const [skipDuration, setSkipDuration] = useState<number>(10);
  const [showSkipOptions, setShowSkipOptions] = useState<boolean>(false);

  const skipDurationOptions = [5, 10, 15, 30, 60]; // Skip options in seconds

  const audioRef = useRef<HTMLAudioElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const prevVolumeRef = useRef<number>(volume);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement>(null);

  // Format time in mm:ss
  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Clean up audio context when component unmounts
  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Initialize Web Audio API when audio is loaded
  useEffect(() => {
    if (!audioRef.current || loading || error) return;

    // Create audio context if it doesn't exist
    if (!audioContextRef.current) {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      audioContextRef.current = new AudioContext();
    }

    // Connect audio element to analyzer
    if (audioContextRef.current && !analyserRef.current) {
      // Create analyzer
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      analyserRef.current.smoothingTimeConstant = 0.8;

      // Connect audio element to analyzer
      sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);

      // Create data array to hold frequency data
      const bufferLength = analyserRef.current.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      setAudioFrequencyData(dataArray);
    }

    return () => {
      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }
      if (analyserRef.current) {
        analyserRef.current.disconnect();
      }
    };
  }, [loading, error]);

  // Draw the frequency visualization
  const drawFrequencyVisualization = () => {
    if (!analyserRef.current || !visualizerCanvasRef.current || !audioFrequencyData) return;

    const canvas = visualizerCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match its displayed size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Get frequency data
    analyserRef.current.getByteFrequencyData(audioFrequencyData);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw frequency bars
    const barWidth = canvas.width / audioFrequencyData.length * 2;
    let x = 0;

    // Get computed primary color for bars
    const computedStyle = getComputedStyle(document.documentElement);
    const primaryColor = computedStyle.getPropertyValue('--audio-primary-color') || '#3498db';
    const secondaryColor = computedStyle.getPropertyValue('--audio-secondary-color') || '#2980b9';

    // Create gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, primaryColor);
    gradient.addColorStop(1, secondaryColor);

    for (let i = 0; i < audioFrequencyData.length; i++) {
      // Calculate bar height based on frequency value (0-255)
      const barHeight = (audioFrequencyData[i] / 255) * canvas.height * 0.8;

      // Skip very low values
      if (barHeight < 3) {
        x += barWidth + 1;
        continue;
      }

      // Draw bar
      ctx.fillStyle = gradient;
      ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);

      // Add glow effect for louder frequencies
      if (barHeight > canvas.height * 0.25) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = primaryColor;
      } else {
        ctx.shadowBlur = 0;
      }

      x += barWidth + 1;
    }

    // Request next frame if still playing
    if (isPlaying) {
      animationRef.current = requestAnimationFrame(drawFrequencyVisualization);
    }
  };

  // Update visualization on play/pause
  useEffect(() => {
    if (isPlaying) {
      // Resume audio context if it was suspended
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      // Start animation
      animationRef.current = requestAnimationFrame(drawFrequencyVisualization);
    } else {
      // Stop animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  // Play/Pause toggle
  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => {
        console.error("Audio playback error:", err);
        setError('Failed to play audio: ' + err.message);
      });
    }
  };

  // Skip forward/backward
  const skipTime = (seconds: number) => {
    if (!audioRef.current) return;

    const newTime = Math.min(Math.max(audioRef.current.currentTime + seconds, 0), duration);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Handle time updates during playback
  const handleTimeUpdate = () => {
    if (!audioRef.current || isDragging) return;

    const newTime = audioRef.current.currentTime;
    setCurrentTime(newTime);
    const progressPercent = (newTime / duration) * 100;
    setProgress(isNaN(progressPercent) ? 0 : progressPercent);
  };

  // Handle seeking when user changes input range
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;

    const seekTime = parseFloat(e.target.value);
    setCurrentTime(seekTime);
    setProgress((seekTime / duration) * 100);

    // Update audio time immediately
    audioRef.current.currentTime = seekTime;
  };

  // Handle drag start for the seek bar
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    setIsDragging(true);

    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    document.addEventListener('touchmove', handleDragMove);
    document.addEventListener('touchend', handleDragEnd);
  };

  // Handle drag movement
  const handleDragMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging || !audioRef.current || !seekBarRef.current) return;

    // Calculate position
    let clientX: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
    } else {
      clientX = e.clientX;
    }

    const rect = seekBarRef.current.getBoundingClientRect();
    const position = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
    const newTime = position * duration;

    // Update UI immediately
    setCurrentTime(newTime);
    setProgress(position * 100);

    // Update audio time immediately while dragging for better feedback
    audioRef.current.currentTime = newTime;
  };

  // Handle drag end
  const handleDragEnd = () => {
    if (!audioRef.current) return;

    setIsDragging(false);

    // Remove event listeners
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('touchend', handleDragEnd);
  };

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;

    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    audioRef.current.volume = newVolume;

    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }

    prevVolumeRef.current = newVolume > 0 ? newVolume : prevVolumeRef.current;
  };

  // Toggle mute
  const toggleMute = () => {
    if (!audioRef.current) return;

    if (isMuted) {
      audioRef.current.volume = prevVolumeRef.current;
      setVolume(prevVolumeRef.current);
      setIsMuted(false);
    } else {
      prevVolumeRef.current = audioRef.current.volume > 0 ? audioRef.current.volume : prevVolumeRef.current;
      audioRef.current.volume = 0;
      setVolume(0);
      setIsMuted(true);
    }
  };

  // Update progress bar style with CSS variable for gradient fill
  useEffect(() => {
    document.documentElement.style.setProperty('--progress', `${progress}%`);
  }, [progress]);

  // Update volume bar style with CSS variable
  useEffect(() => {
    document.documentElement.style.setProperty('--volume-percentage', `${volume * 100}%`);
  }, [volume]);

  // Audio element event handlers
  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;

    setDuration(audioRef.current.duration);
    setLoading(false);
  };

  const handlePlayStateChange = () => {
    setIsPlaying(!audioRef.current?.paused);
  };

  const handleError = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    console.error("Audio error:", e);
    setLoading(false);
    setError('Failed to load audio file. The file might be corrupted or in an unsupported format.');
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (audioRef.current) {
      setCurrentTime(0);
      setProgress(0);
      audioRef.current.currentTime = 0;
    }
  };

  // Generate a simple visualization placeholder based on filename
  useEffect(() => {
    // Simple color generation based on filename for the visual element
    const generateColor = () => {
      let hash = 0;
      for (let i = 0; i < fileName.length; i++) {
        hash = fileName.charCodeAt(i) + ((hash << 5) - hash);
      }
      const hue = hash % 360;
      return `hsl(${hue}, 80%, 65%)`;
    };

    document.documentElement.style.setProperty('--audio-primary-color', generateColor());
  }, [fileName]);

  return (
      <div className={styles.audioPreview}>
        <div className={styles.audioHeader}>
          <h2 className={styles.fileName}>{decodeURIComponent(fileName)}</h2>
        </div>

        {loading && (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Loading audio...</p>
            </div>
        )}

        {error && (
            <div className={styles.error}>
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="currentColor" viewBox="0 0 16 16">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
              </svg>
              <h3>Error Playing Audio</h3>
              <p>{error}</p>
              <div className={styles.downloadContainer}>
                <a href={`${src}&download=true`} download={fileName} className={styles.downloadButton}>
              <span className={styles.downloadIcon}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                  <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                </svg>
              </span>
                  Download Audio File
                </a>
              </div>
            </div>
        )}

        <audio
            ref={audioRef}
            src={src}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onError={handleError}
            onEnded={handleEnded}
            onPlay={handlePlayStateChange}
            onPause={handlePlayStateChange}
            style={{ display: 'none' }}
        />

        {!loading && !error && (
            <>
              <div className={styles.audioInfo}>
                <h3>{fileName}</h3>
                <p>{mimeType.split('/')[1].toUpperCase()} audio file</p>
              </div>

              <div className={styles.visualizerContainer}>
                <div className={styles.visualizerControls}>
                  <div className={styles.skipButtonWrapper}>
                    <button
                        className={`${styles.controlButton} ${styles.skipButton}`}
                        onClick={() => skipTime(-skipDuration)}
                        aria-label={`Rewind ${skipDuration}s`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 1-.5.5H3.707l2.147 2.146a.5.5 0 0 1-.708.708l-3-3a.5.5 0 0 1 0-.708l3-3a.5.5 0 1 1 .708.708L3.707 8.5H6.5a.5.5 0 0 0 .5-.5V3.5z"/>
                      </svg>
                    </button>
                  </div>

                  <button
                      className={`${styles.controlButton} ${styles.playButton}`}
                      onClick={togglePlay}
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                          <path d="m11.596 8.697-6.363 3.692c-.54.313-1.233-.066-1.233-.697V4.308c0-.63.692-1.01 1.233-.696l6.363 3.692a.802.802 0 0 1 0 1.393z"/>
                        </svg>
                    )}
                  </button>

                  <div className={styles.skipButtonWrapper}>
                    <button
                        className={`${styles.controlButton} ${styles.skipButton}`}
                        onClick={() => skipTime(skipDuration)}
                        aria-label={`Forward ${skipDuration}s`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M8 3.5a.5.5 0 0 1 1 0V9a.5.5 0 0 0 .5.5h2.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 1 0-.708.708L12.293 8.5H9.5a.5.5 0 0 1-.5-.5V3.5z"/>
                      </svg>
                    </button>
                  </div>
                </div>

                <canvas
                    ref={visualizerCanvasRef}
                    className={styles.visualizerCanvas}
                    height={180}
                    width={700}
                />
              </div>

              <div className={styles.seekContainer}>
                <div className={styles.seekBarBackground} ref={seekBarRef}>
                  <div
                      className={styles.seekBarProgress}
                      style={{ width: `${progress}%` }}
                  ></div>
                </div>

                <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    step={0.01}
                    value={currentTime}
                    onChange={handleSeek}
                    onMouseDown={handleDragStart}
                    onTouchStart={handleDragStart}
                    className={styles.seekBar}
                    aria-label="Seek timeline"
                />

                <div className={styles.seekTimeMarkers}>
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className={styles.fullWidthVolumeContainer}>
                <div
                    className={`${styles.volumeIcon} ${isMuted ? styles.muted : ''}`}
                    onClick={toggleMute}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                    {isMuted ? (
                        <path d="M6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06zm7.137 2.096a.5.5 0 0 1 0 .708L12.207 8l1.647 1.646a.5.5 0 0 1-.708.708L11.5 8.707l-1.646 1.647a.5.5 0 0 1-.708-.708L10.793 8 9.146 6.354a.5.5 0 1 1 .708-.708L11.5 7.293l1.646-1.647a.5.5 0 0 1 .708 0z"/>
                    ) : (
                        <path d="M11.536 14.01A8.473 8.473 0 0 0 14.026 8a8.473 8.473 0 0 0-2.49-6.01l-.708.707A7.476 7.476 0 0 1 13.025 8c0 2.071-.84 3.946-2.197 5.303l.708.707z"/>
                    )}
                    <path d="M10.121 12.596A6.48 6.48 0 0 0 12.025 8a6.48 6.48 0 0 0-1.904-4.596l-.707.707A5.483 5.483 0 0 1 11.025 8a5.483 5.483 0 0 1-1.61 3.89l.706.706z"/>
                    <path d="M8.707 11.182A4.486 4.486 0 0 0 10.025 8a4.486 4.486 0 0 0-1.318-3.182L8 5.525A3.489 3.489 0 0 1 9.025 8 3.49 3.49 0 0 1 8 10.475l.707.707zM6.717 3.55A.5.5 0 0 1 7 4v8a.5.5 0 0 1-.812.39L3.825 10.5H1.5A.5.5 0 0 1 1 10V6a.5.5 0 0 1 .5-.5h2.325l2.363-1.89a.5.5 0 0 1 .529-.06z"/>
                  </svg>
                </div>

                <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={volume}
                    onChange={handleVolumeChange}
                    className={styles.volumeSlider}
                    aria-label="Volume control"
                />

                <div className={styles.volumeLevel}>
                  {Math.round(volume * 100)}%
                </div>
              </div>

              <div className={styles.downloadContainer}>
                <a
                    href={`${src}&download=true`}
                    download={fileName}
                    className={styles.downloadButton}
                >
              <span className={styles.downloadIcon}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                  <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                </svg>
              </span>
                  Download Audio File
                </a>
              </div>
            </>
        )}
      </div>
  );
};

export default AudioPreview;

