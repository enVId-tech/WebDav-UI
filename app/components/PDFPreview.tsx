"use client";
import React, { useEffect, useState, useRef } from 'react';
import styles from '@/app/fileserver.module.scss';

// PDF.js types
import { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

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

    const loadPDF = async () => {
      try {
        setLoading(true);

        // Dynamically import PDF.js to avoid server-side loading issues
        const pdfjs = await import('pdfjs-dist');

        // Set worker path - use local worker from node_modules
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        // Fetch the PDF through our API
        const loadingTask = pdfjs.getDocument(src);
        const pdf = await loadingTask.promise;

        if (!isMounted) return;

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setLoading(false);

        // Render the first page
        renderPage(1);
      } catch (err: any) {
        console.error('Error loading PDF:', err);
        if (isMounted) {
          setLoading(false);
          setError(err.message || 'Failed to load PDF document');
        }
      }
    };

    loadPDF();

    return () => {
      isMounted = false;
      // Clean up resources
      if (pdfDocRef.current) {
        pdfDocRef.current.destroy();
      }
    };
  }, [src]);

  const renderPage = async (pageNumber: number) => {
    if (!pdfDocRef.current || !canvasRef.current) return;

    try {
      const page = await pdfDocRef.current.getPage(pageNumber);

      // Get the current container width to adjust the scale
      const container = containerRef.current;
      const containerWidth = container?.clientWidth || 800;

      // Calculate scale to fit container width
      const viewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / viewport.width;
      const scaledViewport = page.getViewport({ scale });

      // Set canvas dimensions
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      canvas.height = scaledViewport.height;
      canvas.width = scaledViewport.width;

      // Render PDF page
      const renderContext = {
        canvasContext: context!,
        viewport: scaledViewport
      };

      await page.render(renderContext).promise;
      setCurrentPage(pageNumber);
    } catch (err: any) {
      console.error('Error rendering PDF page:', err);
      setError(`Failed to render page ${pageNumber}: ${err.message}`);
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
          <h2>{fileName}</h2>
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