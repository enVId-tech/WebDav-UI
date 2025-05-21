"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import styles from '@/app/fileserver.module.scss';
import VideoPreview from '@/app/components/VideoPreview'; // Ensure this path is correct
import { lookup } from 'mime-types';

const FilePreview = () => {
  const params = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    if (!params.filepath) return;

    try {
      // Convert filepath array to path string
      const filePath = Array.isArray(params.filepath)
          ? params.filepath.join('/')
          : params.filepath;

      // IMPORTANT: Remove any leading "etran/" from the filepath to prevent duplication
      const cleanPath = filePath.replace(/^etran\//, '');

      // Get filename for mime type detection
      const fileNameOnly = cleanPath.split('/').pop() || '';
      setFileName(fileNameOnly);
      const detectedMimeType = lookup(fileNameOnly) || 'application/octet-stream';
      setMimeType(detectedMimeType);

      // Construct WebDAV API URL with proper encoding - use the cleaned path
      const apiUrl = `/api/webdav?path=${encodeURIComponent(cleanPath)}&sharePath=${encodeURIComponent('/etran')}&isFile=true&debug=true`;

      console.log('WebDAV API URL:', apiUrl);
      console.log('File type:', detectedMimeType);

      // Set the file URL for the video player
      setFileUrl(apiUrl);
      setIsLoading(false);

    } catch (err: any) {
      console.error('Error setting up file preview:', err);
      setError(err.message || 'Failed to load file preview');
      setIsLoading(false);
    }
  }, [params.filepath]);

  if (isLoading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
      <div className={styles.previewContainer}>
        {mimeType.startsWith('video/') || mimeType === 'application/mp4' ? (
            <VideoPreview
                src={fileUrl}
                mimeType={mimeType}
                fileName={fileName}
            />
        ) : (
            <div className={styles.unsupportedFile}>
              This file type is not supported for preview.
              <a href={fileUrl + '&download=true'} download>Download instead</a>
            </div>
        )}
      </div>
  );
};

export default FilePreview;