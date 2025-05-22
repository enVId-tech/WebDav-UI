"use client";
import React, { useState, useRef, useEffect } from 'react';
import commonStyles from '@/app/styles/common.module.scss';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  // Format time in mm:ss
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(err => {
          setError('Failed to play audio: ' + err.message);
        });
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      setLoading(false);
    }
  };

  const handleError = () => {
    setLoading(false);
    setError('Failed to load audio file');
  };

  const handleEnded = () => {
    setIsPlaying(false);
    if (audioRef.current) {
      setCurrentTime(0);
      audioRef.current.currentTime = 0;
    }
  };

  return (
      <div className={styles.audioPreview}>
        {loading && (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Loading audio...</p>
            </div>
        )}

        {error && (
            <div className={styles.error}>
              <p>{error}</p>
            </div>
        )}

        <audio
            ref={audioRef}
            src={src}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onError={handleError}
            onEnded={handleEnded}
            style={{ display: 'none' }}
        />

        {!loading && !error && (
            <>
              <div className={styles.audioInfo}>
                <h3>{fileName}</h3>
                <p>{mimeType}</p>
              </div>

              <div className={styles.seekContainer}>
                <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    value={currentTime}
                    onChange={handleSeek}
                    className={styles.seekBar}
                    aria-label="Seek timeline"
                />
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
                    aria-label="Volume control"
                />
                <span>🔊</span>
              </div>

              <div className={styles.downloadContainer}>
                <a
                    href={`${src}&download=true`}
                    download={fileName}
                    className={styles.downloadButton}
                >
                  ⬇️ Download Audio
                </a>
              </div>
            </>
        )}
      </div>
  );
};

export default AudioPreview;