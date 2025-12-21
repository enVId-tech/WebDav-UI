"use client";
import React, { useState, useRef } from 'react';
import styles from '@/app/styles/imagePreview.module.scss';
import { geistMono } from '../types/font';

interface ImagePreviewProps {
  src: string;
  fileName: string;
  mimeType: string;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ src, fileName, mimeType }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [zoomInput, setZoomInput] = useState('100');
  const imageRef = useRef<HTMLImageElement>(null);

  const handleImageLoad = () => {
    setLoading(false);
  };

  const handleImageError = () => {
    setLoading(false);
    setError('Failed to load image');
  };

  const handleZoomInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^\d]/g, ''); // Only allow digits
    setZoomInput(value);
  };

  const handleZoomInputBlur = () => {
    const numValue = parseInt(zoomInput, 10);
    if (!isNaN(numValue) && numValue > 0) {
      // Convert percentage to zoom level (10% to 2000% maps to 0.1 to 20)
      const newZoom = Math.min(Math.max(numValue / 100, 0.1), 20);
      setZoom(newZoom);
      setZoomInput(Math.round(newZoom * 100).toString());
    } else {
      setZoomInput(Math.round(zoom * 100).toString());
    }
  };

  const handleZoomInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const zoomIn = () => {
    const newZoom = Math.min(zoom * 1.2, 20);
    setZoom(newZoom);
    setZoomInput(Math.round(newZoom * 100).toString());
  };

  const zoomOut = () => {
    const newZoom = Math.max(zoom / 1.2, 0.1);
    setZoom(newZoom);
    setZoomInput(Math.round(newZoom * 100).toString());
  };

  const resetZoom = () => {
    setZoom(1);
    setZoomInput('100');
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newZoom = parseFloat(e.target.value);
    setZoom(newZoom);
    setZoomInput(Math.round(newZoom * 100).toString());
  };

  return (
    <div className={`${styles.imagePreviewContainer}  ${geistMono.className}`}>
      <div className={styles.imageHeader}>
        <h2 className={styles.fileName}>{decodeURIComponent(fileName)}</h2>
      </div>

      {loading && (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p className={`${geistMono.className}`}>Loading image...</p>
        </div>
      )}

      {error && (
        <div className={styles.error}>
          <p>{error}</p>
          <a href={`${src}&download=true`} download className={`${styles.downloadButton} ${geistMono.className}`}>
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
        <div className={styles.zoomLabel}>
          Zoom: 
          <input 
            type="text" 
            value={zoomInput} 
            onChange={handleZoomInputChange}
            onBlur={handleZoomInputBlur}
            onKeyDown={handleZoomInputKeyDown}
            className={styles.zoomInput}
          />%
        </div>
        <input
          type="range"
          min="0.1"
          max="20"
          step="0.1"
          value={zoom}
          onChange={handleSliderChange}
          className={styles.zoomSlider}
        />
        <button onClick={zoomOut} className={styles.controlButton} disabled={zoom <= 0.1}>
          -
        </button>
        <button onClick={resetZoom} className={styles.controlButton}>
          100%
        </button>
        <button onClick={zoomIn} className={styles.controlButton} disabled={zoom >= 20}>
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