"use client";
import React, { useState, useRef } from 'react';
import styles from '@/app/styles/imagePreview.module.scss';

interface ImagePreviewProps {
  src: string;
  fileName: string;
  mimeType: string;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ src, fileName, mimeType }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleImageLoad = () => {
    setLoading(false);
  };

  const handleImageError = () => {
    setLoading(false);
    setError('Failed to load image. The file may be corrupted or in an unsupported format.');
  };

  return (
      <div className={`${styles.imagePreviewWrapper} ${styles.fullscreen}`}>
        {!loading && !error && (
            <h3 className={styles.imageTitle}>
              {fileName}
            </h3>
        )}

        {loading && (
            <div className={styles.loading}>
              <div className={styles.spinner}></div>
              <p>Loading image...</p>
            </div>
        )}

        {error && (
            <div className={styles.error}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1-7v2h2v-2h-2zm0-8v6h2V7h-2z" fill="currentColor"/>
              </svg>
              <p>{error}</p>
              <a href={`${src}&download=true`} download={fileName} className={styles.downloadButton}>
                Download Image
              </a>
            </div>
        )}

        {!error && (
            <img
                ref={imageRef}
                className={styles.imagePreview}
                src={src}
                alt={fileName}
                onLoad={handleImageLoad}
                onError={handleImageError}
                style={{
                  transform: `scale(${zoom})`,
                }}
            />
        )}

        {!loading && !error && (
            <div className={styles.controlsOverlay}>
              <div className={styles.zoomControls}>
                <button onClick={() => setZoom(prev => Math.max(0.25, prev - 0.25))}>-</button>
                <span>{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(prev => Math.min(10, prev + 0.25))}>+</button>
                <button onClick={() => setZoom(1)}>Reset</button>
              </div>

              <a href={`${src}&download=true`} download={fileName} className={styles.downloadButton}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                  <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                </svg>
                Download
              </a>
            </div>
        )}
      </div>
  );
};

export default ImagePreview;