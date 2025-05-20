'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { lookup } from 'mime-types';
import styles from '@/app/fileserver.module.scss';

export default function FilePreview() {
  const params = useParams();
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const fetchFile = async () => {
      try {
        setLoading(true);

        // Extract filepath from URL params
        const pathSegments = Array.isArray(params.filepath)
            ? params.filepath
            : [];

        if (pathSegments.length < 2) {
          throw new Error('Invalid file path');
        }

        // First segment is the share ID
        const shareId = pathSegments[0];

        // Remaining segments form the file path
        const filePath = `/${pathSegments.slice(1).join('/')}`;

        // Get filename from the path
        const pathParts = filePath.split('/');
        const filename = pathParts[pathParts.length - 1];
        setFileName(filename);

        // Determine mime type
        const mime = lookup(filename) || 'application/octet-stream';
        setMimeType(mime);

        // Create a direct URL to the file instead of fetching and creating a blob
        // This will stream the file directly from your API endpoint
        const directUrl = `/api/webdav?path=${encodeURIComponent(filePath)}&sharePath=${encodeURIComponent(`/${shareId}`)}&isFile=true`;

        setFileUrl(directUrl);
        setError(null);
      } catch (err: any) {
        console.error('Error setting up file preview:', err);
        setError(err.message || 'Failed to load file');
      } finally {
        setLoading(false);
      }
    };

    fetchFile();

    // Clean up object URL on unmount
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [params.filepath]);

  const handleDownload = () => {
    if (fileUrl) {
      const a = document.createElement('a');
      a.href = fileUrl;
      a.download = fileName;
      a.setAttribute('target', '_blank'); // This helps with large files
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading file preview...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorContent}>
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={() => window.close()}>Close</button>
        </div>
      </div>
    );
  }

  return (
      <div className={styles.previewContainer}>
        <div className={`${styles.previewHeader} ${isMobile ? styles.mobileHeader : ''}`}>
          <h2>{fileName}</h2>
          <button className={styles.modernButton} onClick={handleDownload}>
            Download
          </button>
        </div>

        <div className={`${styles.previewContent} ${isMobile ? styles.mobileContent : ''}`}>
          {fileUrl && (
              <>
                {mimeType.startsWith('image/') && (
                    <img src={fileUrl} alt={fileName} className={styles.imagePreview} />
                )}

                {(mimeType.startsWith('video/') || mimeType === 'application/mp4') && (
                    <div className={styles.videoContainer}>
                      <video controls className={styles.videoPreview}>
                        <source src={fileUrl} type={mimeType} />
                        Your browser does not support video playback.
                      </video>
                      <p className={styles.fallbackMessage}>
                        If video doesn't play, you can <a href={fileUrl} download={fileName}>download it</a> to view.
                      </p>
                    </div>
                )}

              {mimeType.startsWith('audio/') && (
                <audio controls className={styles.audioPreview}>
                  <source src={fileUrl} type={mimeType} />
                  Your browser does not support audio playback.
                </audio>
              )}

              {mimeType === 'application/pdf' && (
                <iframe
                  src={fileUrl}
                  className={styles.pdfPreview}
                  title={fileName}
                />
              )}

              {!mimeType.startsWith('image/') &&
                  !(mimeType.startsWith('video/') || mimeType === 'application/mp4') &&
                  !mimeType.startsWith('audio/') &&
                  mimeType !== 'application/pdf' && (
                      <div className={styles.genericPreview}>
                        <p>Preview not available for this file type ({mimeType}).</p>
                        <button className={styles.modernButton} onClick={handleDownload}>
                          Download to view
                        </button>
                      </div>
                  )}
            </>
          )}
        </div>

        {isMobile && (
            <div className={styles.mobileActions}>
              <button className={styles.backButton} onClick={() => window.history.back()}>
                Back
              </button>
              <button className={styles.downloadButton} onClick={handleDownload}>
                Download
              </button>
            </div>
        )}
    </div>
  );
}