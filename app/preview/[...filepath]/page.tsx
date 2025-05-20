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
    const init = async () => {
      try {
        setLoading(true);
        const segments = Array.isArray(params.filepath) ? params.filepath : [];
        if (segments.length < 2) throw new Error('Invalid file path');

        const shareId = segments[0];
        const filePath = '/' + segments.slice(1).join('/');
        const name = filePath.split('/').pop()!;
        setFileName(name);
        const mime = lookup(name) || 'application/octet-stream';
        setMimeType(mime);

        const url = `${window.location.origin}/api/webdav?` +
            `path=${encodeURIComponent(filePath)}` +
            `&sharePath=${encodeURIComponent('/' + shareId)}` +
            `&isFile=true`;
        setFileUrl(url);
        setError(null);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    init();
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

  const commonProps = { crossOrigin: 'anonymous' as const };
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
                    <img src={fileUrl} alt={fileName} {...commonProps} className={styles.imagePreview} />
                )}
                {(mimeType.startsWith('video/') || mimeType === 'application/mp4') && (
                    <video controls {...commonProps} className={styles.videoPreview}>
                      <source src={fileUrl} type={mimeType} />
                    </video>
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