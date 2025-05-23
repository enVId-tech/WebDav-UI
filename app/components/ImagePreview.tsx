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
    setError('Failed to load image');
  };

  const zoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 5));
  };

  const zoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.1));
  };

  const resetZoom = () => {
    setZoom(1);
  };

  return (
    <div className={styles.imagePreviewContainer}>
      <div className={styles.imageHeader}>
        <h2 className={styles.fileName}>{decodeURIComponent(fileName)}</h2>
      </div>

      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading image...</p>
        </div>
      )}

      {error && (
        <div className={styles.error}>
          <p>{error}</p>
          <a href={`${src}&download=true`} download className={styles.downloadButton}>
            Download Image
          </a>
        </div>
      )}

      <div className={styles.imageViewportContainer}>
        <div
          className={styles.imageViewport}
          style={{
            transform: `scale(${zoom})`,
            cursor: zoom > 1 ? 'zoom-out' : 'zoom-in'
          }}
          onClick={() => zoom > 1 ? resetZoom() : zoomIn()}
        >
          <img
            ref={imageRef}
            src={src}
            alt={decodeURIComponent(fileName)}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className={`${styles.imageContent} ${loading ? styles.hidden : ''}`}
          />
        </div>
      </div>

      <div className={styles.controls}>
        <button onClick={zoomOut} className={styles.controlButton} disabled={zoom <= 0.1}>
          -
        </button>
        <button onClick={resetZoom} className={styles.controlButton}>
          100%
        </button>
        <button onClick={zoomIn} className={styles.controlButton} disabled={zoom >= 5}>
          +
        </button>
        <a href={`${src}&download=true`} download className={styles.downloadButton}>
          Download Image
        </a>
      </div>
    </div>
  );
};

export default ImagePreview;

