"use client";
import React, { useState, useRef, useEffect } from 'react';
import styles from '@/app/styles/audioPreview.module.scss';
// Import React Icons
import { FaPlay, FaPause } from 'react-icons/fa';
import { BiSkipPrevious, BiSkipNext, BiErrorCircle } from 'react-icons/bi';
import { IoVolumeMedium, IoVolumeMute } from 'react-icons/io5'; // Removed IoMdDownload from here
import { MdDownload } from 'react-icons/md'; // Added MdDownload
import ThemeToggle from './ThemeToggle'; // Added ThemeToggle import

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
  // const [albumArt, setAlbumArt] = useState<string | null>(null); // Album art not currently used
  const [audioFrequencyData, setAudioFrequencyData] = useState<Uint8Array<ArrayBufferLike> | Uint8Array | null>(null);
  const [skipDuration, setSkipDuration] = useState<number>(10);
  // const [showSkipOptions, setShowSkipOptions] = useState<boolean>(false); // Skip options UI not fully implemented

  // const skipDurationOptions = [5, 10, 15, 30, 60]; // Skip options in seconds

  const audioRef = useRef<HTMLAudioElement>(null);
  const seekBarRef = useRef<HTMLDivElement>(null);
  const prevVolumeRef = useRef<number>(volume);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement>(null);

  // HSL to RGB conversion function
  const hslToRgbString = (h: number, s: number, l: number): string => {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) =>
      l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const r = Math.round(255 * f(0));
    const g = Math.round(255 * f(8));
    const b = Math.round(255 * f(4));
    return `${r}, ${g}, ${b}`;
  };

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

  // Draw the synthwave-style frequency visualization
  const drawFrequencyVisualization = () => {
    if (!analyserRef.current || !visualizerCanvasRef.current || !audioFrequencyData) return;

    const canvas = visualizerCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions to match its displayed size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const body = new Uint8Array(audioFrequencyData);

    // Get frequency data (accept any Uint8Array-like buffer)
    analyserRef.current.getByteFrequencyData(body);

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get theme colors
    const computedStyle = getComputedStyle(document.documentElement);
    const primaryColor = computedStyle.getPropertyValue('--audio-primary-color')?.trim() || '#ff6ec7';
    const secondaryColor = computedStyle.getPropertyValue('--audio-secondary-color')?.trim() || '#7367ff';

    // Draw subtle synthwave background gradient
    const bgGradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
    bgGradient.addColorStop(0, 'rgba(3, 7, 18, 0.95)');
    bgGradient.addColorStop(1, 'rgba(15, 23, 42, 0.9)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw horizon glow
    const horizonGradient = ctx.createLinearGradient(0, canvas.height - 10, 0, canvas.height - 80);
    horizonGradient.addColorStop(0, 'rgba(0,0,0,0)');
    ctx.fillStyle = horizonGradient;
    ctx.fillRect(0, canvas.height - 80, canvas.width, 80);

    // Define channel bands once: ignore extreme lows/highs, focus on useful range
    const totalBins = body.length;
    // Focus even more on the musical mids; cut more lows/highs
    const lowCut = Math.floor(totalBins * 0.1);   // drop more sub-bass
    const highCut = Math.floor(totalBins * 0.7);  // drop more very high hiss

    const usableBins = Math.max(1, highCut - lowCut);

    // Fixed number of visual channels spanning the full canvas width
    const barCount = Math.min(64, usableBins); // never create more bars than bins
    const barWidth = canvas.width / barCount;

    // Precompute band boundaries so channels are evenly spaced across the useful range
    const bandEdges: number[] = [];
    for (let i = 0; i <= barCount; i++) {
      const t = i / barCount;
      // Slightly bias towards mids with a gentle curve
      const curved = t ** 1.05;
      bandEdges.push(Math.floor(lowCut + curved * usableBins));
    }

    // Vertical gradient for bars
    const barGradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
    barGradient.addColorStop(0, secondaryColor);
    barGradient.addColorStop(0.4, primaryColor);
    barGradient.addColorStop(1, '#ffffff');

    ctx.lineWidth = 2;
    ctx.shadowBlur = 0;

    for (let i = 0; i < barCount; i++) {
      const start = bandEdges[i];
      const end = Math.max(start + 1, bandEdges[i + 1]);

      // Average magnitude over this band so no single spike dominates
      let sum = 0;
      for (let bin = start; bin < end && bin < totalBins; bin++) {
        sum += body[bin];
      }
      const bandSize = Math.max(1, end - start);
      const avg = sum / bandSize;

      // Normalize and ease height for smoother movement
      const normalized = avg / 230;
      const eased = Math.pow(normalized, 2.5); // ease out cubic
      const maxBarHeight = canvas.height * 0.95;
      const barHeight = eased * maxBarHeight;

      if (barHeight < 2) continue;

      const x = i * barWidth + barWidth / 2;
      const y = canvas.height;

      // Set bar style
      ctx.strokeStyle = barGradient;
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 10 * eased;

      // Draw vertical line from bottom upwards
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - barHeight);
      ctx.stroke();
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
        hash = hash & hash; // Ensure hash is a 32-bit integer
      }

      // Constrain hue to a range of blues (e.g., 190-250 degrees)
      const baseBlueHue = 190; // Starting hue for blues
      const hueRange = 60;     // Spread of blue hues (190 to 190+60-1 = 249)
      const hue = baseBlueHue + (Math.abs(hash) % hueRange);

      return {
        primaryHsl: `hsl(${hue}, 80%, 65%)`,
        primaryRgbString: hslToRgbString(hue, 80, 65), // Calculate RGB string
        secondaryHsl: `hsl(${(hue - 30 + 360) % 360}, 70%, 55%)` // Ensure hue wraps correctly
      };
    };

    const colors = generateColor();

    document.documentElement.style.setProperty('--audio-primary-color', colors.primaryHsl);
    document.documentElement.style.setProperty('--audio-primary-color-rgb', colors.primaryRgbString); // Set RGB string variable
    document.documentElement.style.setProperty('--audio-secondary-color', colors.secondaryHsl);
  }, [fileName]);

  // Fallback for styles.audioControlSizeDefault if styles object doesn't have it or it's not a number string
  let controlSize = 50;
  if (styles && typeof styles.audioControlSizeDefault === 'string' && !isNaN(parseFloat(styles.audioControlSizeDefault))) {
    controlSize = parseFloat(styles.audioControlSizeDefault);
  }
  const playIconSize = Math.floor(controlSize * 0.45);
  const skipIconSize = 20; // Adjusted for 40px skip buttons
  const volumeIconSize = 18;
  const utilityIconSize = 16;
  const errorIconSize = 48;


  return (
      <div className={styles.audioPreview}>
        <div className={styles.previewHeader}>
          <h2 className={styles.fileName}>{decodeURIComponent(fileName)}</h2>
          <ThemeToggle />
        </div>

        {loading && (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Loading audio...</p>
            </div>
        )}

        {error && (
            <div className={styles.error}>
              <BiErrorCircle size={errorIconSize} />
              <h3>Error Playing Audio</h3>
              <p>{error}</p>
              <div className={styles.downloadContainer}>
                <a href={`${src}&download=true`} download={fileName} className={styles.downloadButton}>
                  <span className={styles.downloadIcon}>
                    <MdDownload size={utilityIconSize} /> {/* Changed to MdDownload */}
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
                <h3>{decodeURIComponent(fileName)}</h3>
                <p>{mimeType?.split('/')[1]?.toUpperCase()} AUDIO FILE</p>
              </div>

              <div className={styles.visualizerContainer}>
                <div className={styles.visualizerControls}>
                  <div className={styles.skipButtonWrapper}>
                    <button
                        className={`${styles.controlButton} ${styles.skipButton}`}
                        onClick={() => skipTime(-skipDuration)}
                        aria-label={`Rewind ${skipDuration}s`}
                    >
                      <BiSkipPrevious size={skipIconSize} />
                    </button>
                  </div>

                  <button
                      className={`${styles.controlButton} ${styles.playButton}`}
                      onClick={togglePlay}
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                        <FaPause size={playIconSize} />
                    ) : (
                        <FaPlay size={playIconSize} className={styles.playIcon} />
                    )}
                  </button>

                  <div className={styles.skipButtonWrapper}>
                    <button
                        className={`${styles.controlButton} ${styles.skipButton}`}
                        onClick={() => skipTime(skipDuration)}
                        aria-label={`Forward ${skipDuration}s`}
                    >
                      <BiSkipNext size={skipIconSize} />
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
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? (
                      <IoVolumeMute size={volumeIconSize} />
                  ) : (
                      <IoVolumeMedium size={volumeIconSize} />
                  )}
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
                    <MdDownload size={utilityIconSize} /> {/* Changed to MdDownload */}
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

