"use client";
import React, { useState, useEffect } from 'react';
import styles from '@/app/styles/officePreview.module.scss';

interface OfficePreviewProps {
  src: string;
  mimeType: string;
  fileName: string;
}

const OfficePreview: React.FC<OfficePreviewProps> = ({ src, mimeType, fileName }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fileDetails, setFileDetails] = useState<{
    type: 'word' | 'excel' | 'powerpoint' | 'other';
    icon: React.ReactNode;
    description: string;
    color: string;
  } | null>(null);

  // Decode the filename for display (convert %20 back to spaces, etc.)
  const displayFileName = decodeURIComponent(fileName);

  // Get the file extension for specific handling
  const fileExt = fileName.split('.').pop()?.toLowerCase() || '';

  useEffect(() => {
    setIsLoading(true);

    try {
      // Check if the file is a Microsoft Office document
      const isOfficeDoc = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'rtf', 'odt', 'ods', 'odp'].includes(fileExt);

      if (!isOfficeDoc) {
        setError(`File type .${fileExt} is not supported for Office preview`);
        setIsLoading(false);
        return;
      }

      // Identify document type
      let docType: 'word' | 'excel' | 'powerpoint' | 'other' = 'other';
      let description = 'Office Document';
      let color = '#2b579a';

      if (['doc', 'docx', 'dot', 'dotx', 'rtf', 'odt'].includes(fileExt)) {
        docType = 'word';
        description = 'Word Document';
        color = '#2b579a'; // Word blue
      } else if (['xls', 'xlsx', 'xlt', 'xltx', 'ods'].includes(fileExt)) {
        docType = 'excel';
        description = 'Excel Spreadsheet';
        color = '#217346'; // Excel green
      } else if (['ppt', 'pptx', 'pot', 'potx', 'odp'].includes(fileExt)) {
        docType = 'powerpoint';
        description = 'PowerPoint Presentation';
        color = '#d24726'; // PowerPoint orange
      }

      // Set document details
      setFileDetails({
        type: docType,
        icon: getDocumentIcon(docType),
        description,
        color
      });

      // Complete loading
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    } catch (err) {
      console.error('Error setting up office preview:', err);
      setError('Failed to initialize document preview');
      setIsLoading(false);
    }
  }, [fileExt]);

  // Render the document preview interface
  const renderPreview = () => {
    if (error) {
      return <div className={styles.error}>{error}</div>;
    }

    if (isLoading) {
      return (
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p className={styles.loadingText}>Loading document details...</p>
        </div>
      );
    }

    return (
      <div className={styles.directDownload}>
        <div className={styles.documentHeader} style={{ backgroundColor: fileDetails?.color || '#2b579a' }}>
          <h2>{displayFileName}</h2>
          <div className={styles.documentType}>{fileDetails?.description}</div>
        </div>

        <div className={styles.documentContent}>
          <div className={styles.documentIcon}>
            {fileDetails?.icon}
          </div>

          <div className={styles.documentInfo}>
            <h3>Microsoft Office Document</h3>
            <p>
              This file requires Microsoft Office or a compatible application to view its contents.
              You can download this file to view it in your Office application.
            </p>

            <div className={styles.buttonContainer}>
              <a
                href={`${src}&download=true`}
                download={displayFileName}
                className={styles.downloadButton}
              >
                Download Document
              </a>
            </div>

            <div className={styles.compatInfo}>
              <h4>Compatible with:</h4>
              <ul>
                {fileDetails?.type === 'word' && (
                  <>
                    <li>Microsoft Word</li>
                    <li>Google Docs</li>
                    <li>LibreOffice Writer</li>
                  </>
                )}
                {fileDetails?.type === 'excel' && (
                  <>
                    <li>Microsoft Excel</li>
                    <li>Google Sheets</li>
                    <li>LibreOffice Calc</li>
                  </>
                )}
                {fileDetails?.type === 'powerpoint' && (
                  <>
                    <li>Microsoft PowerPoint</li>
                    <li>Google Slides</li>
                    <li>LibreOffice Impress</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Get icon based on document type
  const getDocumentIcon = (type: 'word' | 'excel' | 'powerpoint' | 'other') => {
    switch (type) {
      case 'word':
        return (
          <svg width="120" height="120" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M96 24V96H0V0H72L96 24Z" fill="#41A5EE"/>
            <path d="M72 0V24H96L72 0Z" fill="#2B7CD3"/>
            <path d="M60 51H13V54H60V51Z" fill="white"/>
            <path d="M60 57H13V60H60V57Z" fill="white"/>
            <path d="M60 63H13V66H60V63Z" fill="white"/>
            <path d="M39 69H13V72H39V69Z" fill="white"/>
            <path d="M60 42H13V45H60V42Z" fill="white"/>
            <path d="M60 36H13V39H60V36Z" fill="white"/>
          </svg>
        );
      case 'excel':
        return (
          <svg width="120" height="120" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M96 24V96H0V0H72L96 24Z" fill="#21A366"/>
            <path d="M72 0V24H96L72 0Z" fill="#107C41"/>
            <path d="M70 60.3584V38H32V83H70V60.3584Z" fill="white"/>
            <path d="M51 44H62V50H51V44Z" fill="#66BB6A"/>
            <path d="M51 56H62V61H51V56Z" fill="#66BB6A"/>
            <path d="M51 67H62V73H51V67Z" fill="#66BB6A"/>
            <path d="M40 44H50V50H40V44Z" fill="#66BB6A"/>
            <path d="M40 56H50V61H40V56Z" fill="#66BB6A"/>
            <path d="M40 67H50V73H40V67Z" fill="#66BB6A"/>
          </svg>
        );
      case 'powerpoint':
        return (
          <svg width="120" height="120" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M96 24V96H0V0H72L96 24Z" fill="#FF8F6B"/>
            <path d="M72 0V24H96L72 0Z" fill="#DA3B01"/>
            <path d="M66 45C66 41.6863 63.3137 39 60 39H33V69H42V60H60C63.3137 60 66 57.3137 66 54V45Z" fill="white"/>
            <path d="M60 51H42V48H60V51Z" fill="#FF8F6B"/>
          </svg>
        );
      default:
        return (
          <svg width="120" height="120" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M96 24V96H0V0H72L96 24Z" fill="#8C8C8C"/>
            <path d="M72 0V24H96L72 0Z" fill="#5F5F5F"/>
            <path d="M64 42H24V72H64V42Z" fill="white"/>
            <path d="M59 47H29V67H59V47Z" fill="#D9D9D9"/>
          </svg>
        );
    }
  };

  return (
    <div className={styles.officePreviewContainer}>
      {renderPreview()}
    </div>
  );
};

export default OfficePreview;
