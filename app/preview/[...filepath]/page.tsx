// app/preview/[...filepath]/page.tsx
"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import styles from '@/app/fileserver.module.scss';
import VideoPreview from '@/app/components/VideoPreview';
import ImagePreview from '@/app/components/ImagePreview';
import AudioPreview from '@/app/components/AudioPreview';
import { lookup } from 'mime-types';

const FilePreview = () => {
  const params = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<'video' | 'image' | 'audio' | 'other'>('other');

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

      // Determine file type
      if (detectedMimeType.startsWith('video/') || detectedMimeType === 'application/mp4') {
        setFileType('video');
      } else if (detectedMimeType.startsWith('image/')) {
        setFileType('image');
      } else if (detectedMimeType.startsWith('audio/')) {
        setFileType('audio');
      } else {
        setFileType('other');
      }

      // Construct WebDAV API URL with proper encoding - use the cleaned path
      const apiUrl = `/api/webdav?path=${encodeURIComponent(cleanPath)}&sharePath=${encodeURIComponent('/etran')}&isFile=true&debug=true`;

      console.log('WebDAV API URL:', apiUrl);
      console.log('File type:', detectedMimeType);

      // Set the file URL for the player
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
        {fileType === 'video' && (
            <VideoPreview
                src={fileUrl}
                mimeType={mimeType}
                fileName={fileName}
            />
        )}

        {fileType === 'image' && (
            <ImagePreview
                src={fileUrl}
                mimeType={mimeType}
                fileName={fileName}
            />
        )}

        {fileType === 'audio' && (
            <AudioPreview
                src={fileUrl}
                mimeType={mimeType}
                fileName={fileName}
            />
        )}

        {fileType === 'other' && (
            <div className={styles.unsupportedFile}>
              This file type ({mimeType}) is not supported for preview.
              <a href={fileUrl + '&download=true'} download className={styles.downloadLink}>
                Download instead
              </a>
            </div>
        )}
      </div>
  );
};

export default FilePreview;