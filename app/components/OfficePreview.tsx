"use client";
import React, { useState, useEffect, useRef, useMemo } from 'react';
import styles from '@/app/styles/officePreview.module.scss';
import ThemeToggle from './ThemeToggle';
import { renderAsync } from 'docx-preview';

interface OfficePreviewProps {
  src: string;
  mimeType: string;
  fileName: string;
}

type DocType = 'word' | 'excel' | 'powerpoint' | 'other';
type ViewerType = 'native' | 'microsoft' | 'google' | 'download';

const baseWordExtensions = ['doc', 'docx', 'dot', 'dotx', 'rtf', 'odt'];
const officeExtensions = [...baseWordExtensions, 'xls', 'xlsx', 'xlt', 'xltx', 'ods', 'ppt', 'pptx', 'pot', 'potx', 'odp'];

const OfficePreview: React.FC<OfficePreviewProps> = ({ src, mimeType, fileName }) => {
  const fileExt = useMemo(() => fileName.split('.').pop()?.toLowerCase() || '', [fileName]);
  const supportsNativeViewer = baseWordExtensions.includes(fileExt);

  const [metadataLoading, setMetadataLoading] = useState(true);
  const [viewerLoading, setViewerLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nativeError, setNativeError] = useState<string | null>(null);
  const [fileDetails, setFileDetails] = useState<{
    type: DocType;
    icon: React.ReactNode;
    description: string;
    color: string;
  } | null>(null);
  const [canUseExternalViewers, setCanUseExternalViewers] = useState(false);
  const [viewerType, setViewerType] = useState<ViewerType>(supportsNativeViewer ? 'native' : 'download');

  const docxContainerRef = useRef<HTMLDivElement>(null);
  const viewerInitializedRef = useRef(false);

  const displayFileName = decodeURIComponent(fileName);

  const absoluteUrl = useMemo(() => {
    if (typeof window === 'undefined') return src;
    if (src.startsWith('http')) return src;
    return `${window.location.origin}${src}`;
  }, [src]);

  useEffect(() => {
    viewerInitializedRef.current = false;
  }, [fileName, supportsNativeViewer]);

  useEffect(() => {
    if (viewerInitializedRef.current) return;
    const preferredViewer: ViewerType = supportsNativeViewer
      ? 'native'
      : canUseExternalViewers
        ? 'microsoft'
        : 'download';
    setViewerType(preferredViewer);
    setViewerLoading(preferredViewer !== 'download');
    viewerInitializedRef.current = true;
    setNativeError(null);
  }, [supportsNativeViewer, canUseExternalViewers]);

  useEffect(() => {
    setMetadataLoading(true);
    setError(null);

    if (!officeExtensions.includes(fileExt)) {
      setError(`File type .${fileExt || 'unknown'} is not supported for preview.`);
      setMetadataLoading(false);
      return;
    }

    let docType: DocType = 'other';
    let description = 'Office Document';
    let color = '#2b579a';

    if (baseWordExtensions.includes(fileExt)) {
      docType = 'word';
      description = 'Word Document';
      color = '#2b579a';
    } else if (['xls', 'xlsx', 'xlt', 'xltx', 'ods'].includes(fileExt)) {
      docType = 'excel';
      description = 'Excel Spreadsheet';
      color = '#217346';
    } else if (['ppt', 'pptx', 'pot', 'potx', 'odp'].includes(fileExt)) {
      docType = 'powerpoint';
      description = 'PowerPoint Presentation';
      color = '#d24726';
    }

    setFileDetails({
      type: docType,
      icon: getDocumentIcon(docType),
      description,
      color
    });

    setMetadataLoading(false);
  }, [fileExt]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const host = window.location.hostname;
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(host);
    const privateRange = /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) || host.endsWith('.local');
    setCanUseExternalViewers(!(isLocalhost || privateRange));
  }, []);

  useEffect(() => {
    if (viewerType !== 'native' || !supportsNativeViewer) {
      return;
    }

    const container = docxContainerRef.current;
    if (!container) return;
    container.innerHTML = '';

    let cancelled = false;
    const controller = new AbortController();
    setViewerLoading(true);
    setNativeError(null);

    fetch(src, { signal: controller.signal })
      .then(resp => {
        if (!resp.ok) {
          throw new Error(`Failed to fetch document (status ${resp.status})`);
        }
        return resp.arrayBuffer();
      })
      .then(buffer => renderAsync(buffer, container, undefined, {
        className: styles.docxDocument,
        inWrapper: true,
        ignoreFonts: false,
        useBase64URL: true
      }))
      .then(() => {
        if (!cancelled) {
          setViewerLoading(false);
        }
      })
      .catch(err => {
        if (cancelled || err.name === 'AbortError') return;
        console.error('Native Word viewer error:', err);
        setNativeError(err.message || 'Unable to render document.');
        setViewerLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [viewerType, supportsNativeViewer, src]);

  useEffect(() => {
    if (!canUseExternalViewers && (viewerType === 'microsoft' || viewerType === 'google')) {
      setViewerType(supportsNativeViewer ? 'native' : 'download');
    }
  }, [canUseExternalViewers, viewerType, supportsNativeViewer]);

  const microsoftViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absoluteUrl)}`;
  const googleViewerUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(absoluteUrl)}&embedded=true`;

  const handleIframeLoad = () => {
    setViewerLoading(false);
  };

  const handleIframeError = () => {
    setViewerLoading(false);
    if (viewerType === 'microsoft' && canUseExternalViewers) {
      setViewerType('google');
      setViewerLoading(true);
    } else {
      setViewerType(supportsNativeViewer ? 'native' : 'download');
    }
  };

  const switchViewer = (target: ViewerType) => {
    if (target === viewerType) return;
    if ((target === 'microsoft' || target === 'google') && !canUseExternalViewers) return;
    if (target === 'native' && !supportsNativeViewer) return;

    setNativeError(null);
    setViewerType(target);
    setViewerLoading(target !== 'download');
  };

  const renderViewerControls = () => (
    <div className={styles.viewerControls}>
      {supportsNativeViewer && (
        <button
          className={`${styles.viewerButton} ${viewerType === 'native' ? 'active' : ''}`}
          onClick={() => switchViewer('native')}
          disabled={viewerType === 'native'}
        >
          Built-in Viewer
        </button>
      )}

      <button
        className={`${styles.viewerButton} ${viewerType === 'microsoft' ? 'active' : ''}`}
        onClick={() => switchViewer('microsoft')}
        disabled={!canUseExternalViewers || viewerType === 'microsoft'}
        title={!canUseExternalViewers ? 'External viewers need a publicly reachable URL' : undefined}
      >
        Microsoft Viewer
      </button>

      <button
        className={`${styles.viewerButton} ${viewerType === 'google' ? 'active' : ''}`}
        onClick={() => switchViewer('google')}
        disabled={!canUseExternalViewers || viewerType === 'google'}
        title={!canUseExternalViewers ? 'External viewers need a publicly reachable URL' : undefined}
      >
        Google Viewer
      </button>

      <button
        className={`${styles.viewerButton} ${viewerType === 'download' ? 'active' : ''}`}
        onClick={() => switchViewer('download')}
      >
        Download Instead
      </button>
    </div>
  );

  const renderPreview = () => {
    if (metadataLoading) {
      return (
        <div className={styles.loadingContainer}>
          <div className={styles.spinner}></div>
          <p className={styles.loadingText}>Preparing document information…</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className={styles.error}>
          <p>{error}</p>
          <a href={`${src}&download=true`} download={displayFileName} className={styles.downloadButton}>
            Download Document
          </a>
        </div>
      );
    }

    if (viewerType === 'download') {
      return (
        <div className={styles.directDownload}>
          <div className={styles.documentHeader} style={{ backgroundColor: fileDetails?.color || '#2b579a' }}>
            <h2>{displayFileName}</h2>
            <div className={styles.documentType}>{fileDetails?.description}</div>
          </div>
          <div className={styles.documentContent}>
            <div className={styles.documentIcon}>{fileDetails?.icon}</div>
            <div className={styles.documentInfo}>
              <h3>Microsoft Office Document</h3>
              <p>
                This file requires Microsoft Office or a compatible application. Download it to continue in your
                preferred editor.
              </p>
              <div className={styles.buttonContainer}>
                <a href={`${src}&download=true`} download={displayFileName} className={styles.downloadButton}>
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
    }

    if (viewerType === 'native' && supportsNativeViewer) {
      return (
        <div className={styles.nativeViewer}>
          {viewerLoading && (
            <div className={styles.loadingOverlay}>
              <div className={styles.spinner}></div>
              <p className={styles.loadingText}>Rendering document…</p>
            </div>
          )}
          {nativeError ? (
            <div className={styles.error}>
              <p>{nativeError}</p>
              {canUseExternalViewers && (
                <button className={styles.downloadButton} onClick={() => switchViewer('microsoft')}>
                  Try Microsoft Viewer
                </button>
              )}
            </div>
          ) : (
            <div ref={docxContainerRef} className={styles.docxContainer} />
          )}
        </div>
      );
    }

    if (!canUseExternalViewers) {
      return (
        <div className={styles.error}>
          <p>External viewers require a publicly accessible URL. Switch to download mode to continue.</p>
          <button className={styles.downloadButton} onClick={() => switchViewer('download')}>
            Download Document
          </button>
        </div>
      );
    }

    const viewerUrl = viewerType === 'microsoft' ? microsoftViewerUrl : googleViewerUrl;

    return (
      <div className={styles.iframeShell}>
        {viewerLoading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.spinner}></div>
            <p className={styles.loadingText}>Loading {viewerType} viewer…</p>
          </div>
        )}
        <div className={styles.iframeContainer}>
          <iframe
            key={viewerType}
            src={viewerUrl}
            title={`${displayFileName} preview`}
            className={styles.documentIframe}
            onLoad={handleIframeLoad}
            onError={handleIframeError}
          />
        </div>
      </div>
    );
  };

  // Get icon based on document type
  const getDocumentIcon = (type: DocType) => {
    switch (type) {
      case 'word':
        return (
          <svg width="120" height="120" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M96 24V96H0V0H72L96 24Z" fill="#41A5EE" />
            <path d="M72 0V24H96L72 0Z" fill="#2B7CD3" />
            <path d="M60 51H13V54H60V51Z" fill="white" />
            <path d="M60 57H13V60H60V57Z" fill="white" />
            <path d="M60 63H13V66H60V63Z" fill="white" />
            <path d="M39 69H13V72H39V69Z" fill="white" />
            <path d="M60 42H13V45H60V42Z" fill="white" />
            <path d="M60 36H13V39H60V36Z" fill="white" />
          </svg>
        );
      case 'excel':
        return (
          <svg width="120" height="120" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M96 24V96H0V0H72L96 24Z" fill="#21A366" />
            <path d="M72 0V24H96L72 0Z" fill="#107C41" />
            <path d="M70 60.3584V38H32V83H70V60.3584Z" fill="white" />
            <path d="M51 44H62V50H51V44Z" fill="#66BB6A" />
            <path d="M51 56H62V61H51V56Z" fill="#66BB6A" />
            <path d="M51 67H62V73H51V67Z" fill="#66BB6A" />
            <path d="M40 44H50V50H40V44Z" fill="#66BB6A" />
            <path d="M40 56H50V61H40V56Z" fill="#66BB6A" />
            <path d="M40 67H50V73H40V67Z" fill="#66BB6A" />
          </svg>
        );
      case 'powerpoint':
        return (
          <svg width="120" height="120" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M96 24V96H0V0H72L96 24Z" fill="#FF8F6B" />
            <path d="M72 0V24H96L72 0Z" fill="#DA3B01" />
            <path d="M66 45C66 41.6863 63.3137 39 60 39H33V69H42V60H60C63.3137 60 66 57.3137 66 54V45Z" fill="white" />
            <path d="M60 51H42V48H60V51Z" fill="#FF8F6B" />
          </svg>
        );
      default:
        return (
          <svg width="120" height="120" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M96 24V96H0V0H72L96 24Z" fill="#8C8C8C" />
            <path d="M72 0V24H96L72 0Z" fill="#5F5F5F" />
            <path d="M64 42H24V72H64V42Z" fill="white" />
            <path d="M59 47H29V67H59V47Z" fill="#D9D9D9" />
          </svg>
        );
    }
  };

  return (
    <div className={styles.officePreviewContainer}>
      <div className={styles.previewHeader}>
        <h2 className={styles.fileName}>{displayFileName}</h2>
        <ThemeToggle />
      </div>
      {renderViewerControls()}
      {!canUseExternalViewers && (
        <p className={styles.viewerHint}>
          External viewers are disabled when the app runs on a private network. Switch to the built-in or download
          options above.
        </p>
      )}
      {renderPreview()}
    </div>
  );
};

export default OfficePreview;
