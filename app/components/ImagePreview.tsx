"use client";
import React, { useState, useEffect } from 'react';
import styles from '@/app/fileserver.module.scss';

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
      document.body.classList.add(styles.fullscreenActive);
    } else {
      document.body.classList.remove(styles.fullscreenActive);
      // Reset zoom when exiting fullscreen
      setZoom(1);
    }
    return () => {
      document.body.classList.remove(styles.fullscreenActive);
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
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 1,
              transition: 'opacity 0.3s ease',
              opacity: loading ? 1 : 0
            }}>
              <div style={{
                width: '50px',
                height: '50px',
                border: '3px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '50%',
                borderTopColor: 'var(--primary)',
                animation: 'spin 1s linear infinite',
              }} />
            </div>
        )}

        {error && <div>{error}</div>}

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
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 5h5V3H3v7h2V5zm5 14H5v-5H3v7h7v-2zm9-14h-5V3h7v7h-2V5zm-5 14h5v-5h2v7h-7v-2z" />
                </svg>
              </button>

              <div
                  className={styles.zoomControls || "zoomControls"}
                  onClick={e => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    bottom: '20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.6)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    display: 'flex',
                    gap: '10px',
                    color: 'white'
                  }}>
                <button onClick={() => setZoom(prev => Math.max(1, prev - 0.5))}>-</button>
                <span>{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(prev => Math.min(3, prev + 0.5))}>+</button>
                <button onClick={() => setZoom(1)}>Reset</button>
              </div>
            </>
        )}

        {!fullScreen && !loading && !error && (
            <div style={{
              position: 'absolute',
              bottom: '10px',
              left: '0',
              right: '0',
              display: 'flex',
              justifyContent: 'center',
              gap: '10px',
              padding: '10px'
            }}>
              <button onClick={toggleFullScreen}>Full Screen</button>
              <a href={`${src}&download=true`} download={fileName}>Download</a>
            </div>
        )}
      </div>
  );
};

export default ImagePreview;