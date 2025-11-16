"use client";
import React, { useEffect, useState, useRef } from 'react';
import styles from '@/app/styles/pdfPreview.module.scss';
import ThemeToggle from './ThemeToggle';

// PDF.js types
import { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import {render} from "sass";

interface PDFPreviewProps {
  src: string;
  fileName: string;
}

const PDFPreview: React.FC<PDFPreviewProps> = ({ src, fileName }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'single' | 'continuous'>('single');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const continuousCanvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    // Dynamically import PDF.js only on client-side
    import('pdfjs-dist').then(async pdfjs => {
      try {
        // Use .js extension instead of .mjs
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.mjs`;

        // Load the PDF
        const response = await fetch(src);
        if (!response.ok) {
          throw new Error(`Failed to access PDF (status: ${response.status})`);
        }

        const pdfData = await response.arrayBuffer();
        const loadingTask = pdfjs.getDocument({
          data: pdfData,
          cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
          cMapPacked: true,
        });

        const pdfDoc = await loadingTask.promise;

        if (!isMounted) return;
        pdfDocRef.current = pdfDoc;
        setNumPages(pdfDoc.numPages);
        setLoading(false);

        // Force a state update that will trigger a re-render to ensure canvasRef is available
        setCurrentPage(1);
      } catch (err: any) {
        console.error('PDF loading error:', err);
        if (isMounted) {
          setError(`Failed to load PDF: ${err.message || 'Invalid PDF structure'}`);
          setLoading(false);
        }
      }
    }).catch(err => {
      console.error('PDF.js import error:', err);
      if (isMounted) {
        setError(`Failed to load PDF library: ${err.message}`);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy().catch(console.error);
      }
    };
  }, [src]);

  // Render single page view
  useEffect(() => {
    if (!loading && pdfDocRef.current && canvasRef.current && viewMode === 'single') {
      renderPage(currentPage, canvasRef.current).catch(err => {
        console.error('Error rendering page:', err);
        setError('Failed to render page: ' + err.message);
      });
    }
  }, [currentPage, loading, zoom, viewMode]);

  // Render continuous view
  useEffect(() => {
    if (!loading && pdfDocRef.current && viewMode === 'continuous' && numPages > 0) {
      renderAllPages().catch(err => {
        console.error('Error rendering pages:', err);
        setError('Failed to render pages: ' + err.message);
      });
    }
  }, [loading, zoom, viewMode, numPages]);

  const renderPage = async (pageNumber: number, canvas: HTMLCanvasElement) => {
    if (!pdfDocRef.current || !canvas) return;

    try {
      // Get page
      const page = await pdfDocRef.current.getPage(pageNumber);

      // Get canvas context
      const context = canvas.getContext('2d');
      if (!context) return;

      // Calculate optimal scale
      const viewport = page.getViewport({ scale: 1.5 * zoom });

      // Set canvas dimensions to match the viewport
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Render PDF page
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      };

      await page.render(renderContext).promise;

    } catch (error) {
      console.error('Error rendering page:', error);
      setError('Failed to render page.');
    }
  };

  const renderAllPages = async () => {
    if (!pdfDocRef.current) return;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const canvas = continuousCanvasRefs.current.get(pageNum);
      if (canvas) {
        await renderPage(pageNum, canvas);
      }
    }
  };

  const goToPreviousPage = () => {
    setCurrentPage((page) => Math.max(1, page - 1));
  };

  const goToNextPage = () => {
    setCurrentPage((page) => Math.min(numPages, page + 1));
  };

  if (loading) {
    return <div className={styles.loading}>Loading PDF...</div>;
  }

  if (error) {
    return (
        <div className={styles.error}>
          <p>{error}</p>
          <a href={`${src}&download=true`} className={styles.downloadLink}>
            Download PDF
          </a>
        </div>
    );
  }

  return (
      <div className={styles.pdfViewer} ref={containerRef}>
        <div className={styles.pdfHeader}>
          <div className={styles.pdfHeaderTop}>
            <h2 className={styles.fileName}>{decodeURIComponent(fileName)}</h2>
          </div>
          <div className={styles.pdfControls}>
            <div className={styles.viewModeControls}>
              <button
                type="button"
                className={`${styles.pdfButton} ${viewMode === 'single' ? styles.active : ''}`}
                onClick={() => setViewMode('single')}
              >
                Single Page
              </button>
              <button
                type="button"
                className={`${styles.pdfButton} ${viewMode === 'continuous' ? styles.active : ''}`}
                onClick={() => setViewMode('continuous')}
              >
                Continuous
              </button>
            </div>
            {viewMode === 'single' && (
              <div className={styles.pageControls}>
                <button
                  onClick={goToPreviousPage}
                  disabled={currentPage === 1}
                  className={styles.pdfButton}
                >
                  Previous
                </button>
                <span className={styles.pageInfo}>
                  Page {currentPage} of {numPages}
                </span>
                <button
                  onClick={goToNextPage}
                  disabled={currentPage === numPages}
                  className={styles.pdfButton}
                >
                  Next
                </button>
              </div>
            )}
            <div className={styles.scaleControls}>
              <span className={styles.scaleValue}>{Math.round(zoom * 100)}%</span>
              <input
                type="range"
                min="0.1"
                max="3"
                step="0.1"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
              />
              <button
                type="button"
                className={styles.pdfButton}
                onClick={() => setZoom((z) => Math.max(0.1, +(z - 0.1).toFixed(2)))}
                disabled={zoom <= 0.1}
              >
                -
              </button>
              <button
                type="button"
                className={styles.pdfButton}
                onClick={() => setZoom(1)}
              >
                100%
              </button>
              <button
                type="button"
                className={styles.pdfButton}
                onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
                disabled={zoom >= 3}
              >
                +
              </button>
            </div>
            <a
                href={`${src}&download=true`}
                download
                className={styles.pdfButton}
            >
              Download
            </a>
          </div>
        </div>
        <div className={styles.pdfCanvas}>
          {viewMode === 'single' ? (
            <canvas ref={canvasRef} />
          ) : (
            <div className={styles.continuousView}>
              {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                <div key={pageNum} className={styles.pageContainer}>
                  <div className={styles.pageNumber}>Page {pageNum}</div>
                  <canvas
                    ref={(el) => {
                      if (el) {
                        continuousCanvasRefs.current.set(pageNum, el);
                      } else {
                        continuousCanvasRefs.current.delete(pageNum);
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
  );
};

export default PDFPreview;

