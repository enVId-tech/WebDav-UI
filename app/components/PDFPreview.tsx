"use client";
import React, { useEffect, useState, useRef } from 'react';
import styles from '@/app/styles/pdfPreview.module.scss';

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
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

// Add new useEffect to render page when currentPage changes or when loading completes
  useEffect(() => {
    if (!loading && pdfDocRef.current && canvasRef.current) {
      renderPage(currentPage).catch(err => {
        console.error('Error rendering page:', err);
        setError('Failed to render page: ' + err.message);
      });
    }
  }, [currentPage, loading]);

  const renderPage = async (pageNumber: number) => {
    if (!pdfDocRef.current || !canvasRef.current) return;

    try {
      // Get page
      const page = await pdfDocRef.current.getPage(pageNumber);

      // Get canvas context
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      // Calculate optimal scale
      const viewport = page.getViewport({ scale: 1.5 });

      // Set canvas dimensions to match the viewport
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      // Render PDF page
      const renderContext = {
        canvas: canvas,
        canvasContext: context,
        viewport: viewport,
      };

      await page.render(renderContext).promise;

      // Update current page only after rendering is complete
      setCurrentPage(pageNumber);
    } catch (error) {
      console.error('Error rendering page:', error);
      setError('Failed to render page.');
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      renderPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < numPages) {
      renderPage(currentPage + 1);
    }
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
          <h2 className={styles.fileName}>{decodeURIComponent(fileName)}</h2>
          <div className={styles.pdfControls}>
            <button
                onClick={goToPreviousPage}
                disabled={currentPage === 1}
                className={styles.pdfButton}
            >
              Previous
            </button>
            <span>
            Page {currentPage} of {numPages}
          </span>
            <button
                onClick={goToNextPage}
                disabled={currentPage === numPages}
                className={styles.pdfButton}
            >
              Next
            </button>
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
          <canvas ref={canvasRef} />
        </div>
      </div>
  );
};

export default PDFPreview;

