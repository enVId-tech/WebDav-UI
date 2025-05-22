"use client";
import React, { useState, useRef } from 'react';
import styles from '@/app/fileserver.module.scss';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  // Format time in mm:ss
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle play/pause
  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Handle time update
  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  // Handle seeking
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  // Handle audio loaded metadata
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setLoading(false);
    }
  };

  // Handle audio error
  const handleError = () => {
    setLoading(false);
    setError('Failed to load audio file');
  };

  return (
    <div className={styles.audioPreview}>
      {loading && <div className={styles.loading}>Loading audio...</div>}
      {error && <div className={styles.error}>{error}</div>}

      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onError={handleError}
        onEnded={() => setIsPlaying(false)}
        style={{ display: 'none' }}
      />

      {!loading && !error && (
        <>
          <div className={styles.audioInfo}>
            <h3>{fileName}</h3>
            <p>{mimeType}</p>
          </div>

          <div className={styles.audioControls}>
            <button
              className={styles.playButton}
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>

            <div className={styles.timeDisplay}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>

          <div className={styles.seekContainer}>
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className={styles.seekBar}
            />
          </div>

          <div className={styles.volumeContainer}>
            <span>🔈</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={handleVolumeChange}
              className={styles.volumeSlider}
            />
            <span>🔊</span>
          </div>

          <div className={styles.downloadContainer}>
            <a href={`${src}&download=true`} download={fileName} className={styles.downloadButton}>
              Download Audio
            </a>
          </div>
        </>
      )}
    </div>
  );
};

export default AudioPreview;