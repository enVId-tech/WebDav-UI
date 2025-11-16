"use client";
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import styles from '@/app/styles/preview.module.scss';
import VideoPreview from '@/app/components/VideoPreview';
import ImagePreview from '@/app/components/ImagePreview';
import AudioPreview from '@/app/components/AudioPreview';
import TextPreview from '@/app/components/TextPreview';
import PDFPreview from '@/app/components/PDFPreview';
import DocPreview from '@/app/components/DocPreview';
import OfficePreview from '@/app/components/OfficePreview';
import { lookup } from 'mime-types';
import { geistSans } from '@/app/types/font';

const FilePreview = () => {
  const params = useParams();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<'video' | 'image' | 'audio' | 'text' | 'pdf' | 'office' | 'document' | 'other'>('other');

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

      // Get file extension
      const fileExt = fileNameOnly.split('.').pop()?.toLowerCase() || '';

      // Determine file type with expanded types including Office files
      if (detectedMimeType.startsWith('video/') || detectedMimeType === 'application/mp4') {
        setFileType('video');
      } else if (detectedMimeType.startsWith('image/')) {
        setFileType('image');
      } else if (detectedMimeType.startsWith('audio/')) {
        setFileType('audio');
      } else if (detectedMimeType.startsWith('text/') ||
          ['json', 'xml', 'md', 'js', 'jsx', 'ts', 'tsx', 'css', 'yaml', 'yml'].includes(fileExt)) {
        setFileType('text');
      } else if (detectedMimeType === 'application/pdf' || fileExt === 'pdf') {
        setFileType('pdf');
      } else if ([
        // Microsoft Office formats
        'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx',
        // Legacy Office formats
        'rtf', 'dot', 'dotx', 'xlt', 'xltx', 'pot', 'potx',
        // OpenDocument formats
        'odt', 'ods', 'odp'
      ].includes(fileExt)) {
        // New specific type for Office documents to use with OfficePreview
        if (['doc', 'docx', 'dot', 'dotx', 'rtf', 'odt'].includes(fileExt) ||
            detectedMimeType.includes('wordprocessing')) {
          console.log('Detected Word document:', fileExt);
          setFileType('office');
        } else if (['xls', 'xlsx', 'xlt', 'xltx', 'ods'].includes(fileExt) ||
                  detectedMimeType.includes('spreadsheet')) {
          console.log('Detected Excel document:', fileExt);
          setFileType('office');
        } else if (['ppt', 'pptx', 'pot', 'potx', 'odp'].includes(fileExt) ||
                  detectedMimeType.includes('presentation')) {
          console.log('Detected PowerPoint document:', fileExt);
          setFileType('office');
        } else {
          setFileType('office');
        }
      } else {
        setFileType('other');
      }

      // Construct WebDAV API URL with proper encoding - use the cleaned path
      const apiUrl = `/api/webdav?path=${encodeURIComponent(cleanPath)}&sharePath=${encodeURIComponent('/etran')}&isFile=true&debug=true`;

      console.log('WebDAV API URL:', apiUrl);
      console.log('File type:', detectedMimeType);
      console.log('Detected file type category:', fileType);

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
    return <div className={`${styles.loading} ${geistSans.className}`}>Loading...</div>;
  }

  if (error) {
    return <div className={`${styles.error} ${geistSans.className}`}>{error}</div>;
  }

  return (
      <div className={`${styles.previewContainer} ${geistSans.className}`}>
        <header className={styles.previewHeader}>
          <button
            type="button"
            className={styles.backButton}
            onClick={() => router.back()}
          >
            ← Back
          </button>
          <h1>
            File Preview
          </h1>
        </header>
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

        {fileType === 'text' && (
            <TextPreview
                src={fileUrl}
                mimeType={mimeType}
                fileName={fileName}
            />
        )}

        {fileType === 'pdf' && (
            <PDFPreview
                src={fileUrl}
                fileName={fileName}
            />
        )}

        {fileType === 'office' && (
            <OfficePreview
                src={fileUrl}
                mimeType={mimeType}
                fileName={fileName}
            />
        )}

        {fileType === 'document' && (
            <DocPreview
                src={fileUrl}
                mimeType={mimeType}
                fileName={fileName}
            />
        )}

        {fileType === 'other' && (
            <div className={`${styles.unsupportedFile} ${geistSans.className}`}>
              <h2>This file type ({mimeType}) is not supported for preview.</h2>
              <p>The file cannot be previewed directly in the browser.</p>
              <a href={fileUrl + '&download=true'} download className={styles.downloadLink}>
                Download File
              </a>
            </div>
        )}
      </div>
  );
};

export default FilePreview;

