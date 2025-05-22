"use client";
import React, { useState, useEffect } from 'react';
import commonStyles from '@/app/styles/common.module.scss';
import styles from '@/app/styles/imagePreview.module.scss';

interface ImagePreviewProps {
  src: string;
  fileName: string;
  mimeType: string;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ src, fileName, mimeType }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fullScreen, setFullScreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [imageVisible, setImageVisible] = useState(false);

  // Handle body overflow when in fullscreen
  useEffect(() => {
    if (fullScreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      // Reset zoom when exiting fullscreen
      setZoom(1);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [fullScreen]);

  const handleImageLoad = () => {
    setLoading(false);
    // Add a small delay before showing the image for smoother transition
    setTimeout(() => setImageVisible(true), 50);
  };

  const handleImageError = () => {
    setLoading(false);
    setError('Failed to load image');
  };

  // Toggle fullscreen view
  const toggleFullScreen = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFullScreen(!fullScreen);
  };

  // Handle zoom functionality on image click when in fullscreen
  const handleImageClick = () => {
    if (fullScreen) {
      // Cycle through zoom levels
      setZoom(prev => prev >= 2.5 ? 1 : prev + 0.5);
    } else {
      toggleFullScreen();
    }
  };

  return (
      <div className={`${styles.imagePreviewWrapper} ${fullScreen ? styles.fullscreen : ''}`}>
        {loading && (
            <div className={commonStyles.loading}>
              <div className={commonStyles.spinner}></div>
            </div>
        )}

        {error && <div className={commonStyles.error}>{error}</div>}

        <img
            src={src}
            alt={fileName}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className={styles.imagePreview}
            style={{
              transform: `scale(${zoom})`,
              transition: 'transform 0.3s ease, opacity 0.4s ease',
              cursor: fullScreen ? 'zoom-in' : 'pointer',
              opacity: imageVisible ? 1 : 0
            }}
            onClick={handleImageClick}
        />

        {fullScreen && (
            <>
              <button
                  className={styles.fullscreenButton}
                  onClick={toggleFullScreen}
                  aria-label="Exit fullscreen"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 5h5V3H3v7h2V5zm5 14H5v-5H3v7h7v-2zm9-14h-5V3h7v7h-2V5zm-5 14h5v-5h2v7h-7v-2z" />
                </svg>
              </button>

              <div
                  className={styles.zoomControls}
                  onClick={e => e.stopPropagation()}
              >
                <button onClick={() => setZoom(prev => Math.max(1, prev - 0.5))}>-</button>
                <span>{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(prev => Math.min(3, prev + 0.5))}>+</button>
                <button onClick={() => setZoom(1)}>Reset</button>
              </div>
            </>
        )}

        {!fullScreen && !loading && !error && (
            <div className={styles.controlsContainer}>
              <button onClick={toggleFullScreen}>Full Screen</button>
              <a href={`${src}&download=true`} download={fileName}>Download</a>
            </div>
        )}
      </div>
  );
};

export default ImagePreview;