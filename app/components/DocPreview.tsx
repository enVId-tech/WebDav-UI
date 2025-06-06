"use client";
import React, { useState } from 'react';
import styles from '@/app/styles/docPreview.module.scss';

interface DocPreviewProps {
  src: string;
  mimeType: string;
  fileName: string;
}

const DocPreview: React.FC<DocPreviewProps> = ({ src, mimeType, fileName }) => {
  const [viewerType, setViewerType] = useState<'microsoft' | 'google'>('microsoft');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get absolute URL for the document (needed for external viewers)
  const getAbsoluteUrl = () => {
    if (typeof window === 'undefined') return src;

    // If src is already absolute, return it
    if (src.startsWith('http')) return src;

    // Otherwise, construct absolute URL
    const baseUrl = window.location.origin;
    return `${baseUrl}${src}`;
  };

  const absoluteUrl = getAbsoluteUrl();

  // Create viewer URLs
  const microsoftViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absoluteUrl)}`;
  const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(absoluteUrl)}&embedded=true`;

  // Current viewer URL based on selection
  const viewerUrl = viewerType === 'microsoft' ? microsoftViewerUrl : googleViewerUrl;

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleIframeError = () => {
    setError('Failed to load document. It may be too large or in an unsupported format.');
    setIsLoading(false);
  };

  return (
    <div className={styles.docPreviewContainer}>
      <div className={styles.docHeader}>
        <h2 className={styles.fileName}>{decodeURIComponent(fileName)}</h2>
      </div>

      <div className={styles.docPreviewHeader}>
        <div className={styles.fileName}>{fileName}</div>
        <div className={styles.viewerControls}>
          <button
            className={`${styles.viewerButton} ${viewerType === 'microsoft' ? styles.active : ''}`}
            onClick={() => setViewerType('microsoft')}
          >
            Microsoft Viewer
          </button>
          <button
            className={`${styles.viewerButton} ${viewerType === 'google' ? styles.active : ''}`}
            onClick={() => setViewerType('google')}
          >
            Google Viewer
          </button>
          <a href={`${src}&download=true`} download className={styles.downloadButton}>
            Download
          </a>
        </div>
      </div>

      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading document...</p>
        </div>
      )}

      {error && (
        <div className={styles.error}>
          <p>{error}</p>
          <a href={`${src}&download=true`} download className={styles.downloadButton}>
            Download Document
          </a>
        </div>
      )}

      <div className={styles.docPreviewFrame}>
        <iframe
          src={viewerUrl}
          title={`${fileName} preview`}
          width="100%"
          height="100%"
          frameBorder="0"
          loading="lazy"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
        />
      </div>

      <div className={styles.docFooter}>
        <a href={`${src}&download=true`} download className={styles.downloadButton}>
          Download Document
        </a>
      </div>
    </div>
  );
};

export default DocPreview;

