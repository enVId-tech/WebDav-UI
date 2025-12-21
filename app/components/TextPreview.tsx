"use client";
import React, { useEffect, useState, useCallback, useRef } from 'react';
import styles from '@/app/styles/textPreview.module.scss';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs, twilight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { geistSans } from '../types/font';
import { useAuth } from '@/app/context/AuthContext';
import { vs2015 } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { solarizedLight } from 'react-syntax-highlighter/dist/cjs/styles/hljs';

interface TextPreviewProps {
  src: string;
  mimeType: string;
  fileName: string;
}

const TextPreview: React.FC<TextPreviewProps> = ({ src, mimeType, fileName }) => {
  const [content, setContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [lineCount, setLineCount] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1); // 1 = 100%
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const autosaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const { loggedIn, username } = useAuth();

  // Debug: Log authentication state
  useEffect(() => {
    console.log('[TextPreview] Auth state:', { loggedIn, username });
  }, [loggedIn, username]);

  // Determine language for syntax highlighting
  const getLanguage = () => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';

    // Map file extensions to syntax highlighting languages
    const extensionMap: { [key: string]: string } = {
      'js': 'javascript',
      'jsx': 'jsx',
      'ts': 'typescript',
      'tsx': 'tsx',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'md': 'markdown',
      'py': 'python',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cs': 'csharp',
      'go': 'go',
      'rb': 'ruby',
      'php': 'php',
      'sh': 'bash',
      'yaml': 'yaml',
      'yml': 'yaml',
      'xml': 'xml',
      'sql': 'sql',
      'txt': 'text'
    };

    return extensionMap[extension] || 'text';
  };

  useEffect(() => {
    // Check for system dark mode preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }

    // Listen for changes to color scheme preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);

    // Fetch text content
    const fetchText = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(src);
        if (!response.ok) {
          throw new Error(`Failed to load text: ${response.status} ${response.statusText}`);
        }
        const text = await response.text();

        const whiteSpaceTrimmed = text.trim();
        setContent(whiteSpaceTrimmed);

        // Count lines for display purposes
        const lines = whiteSpaceTrimmed.split('\n').length;
        if (lines > 5000) {
          setError('File is too large to display (over 5,000 lines). Please download to view.');
          setContent('');
        } else {
          setLineCount(lines);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load text content');
        console.error('Error loading text:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchText();

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [src]);

  const clampedZoom = Math.min(4, Math.max(0.25, zoom));

  const scheduleAutosave = useCallback(() => {
    if (!loggedIn) return;
    setIsDirty(true);
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      handleSave();
    }, 1500);
  }, [loggedIn]);

  const handleSave = useCallback(async () => {
    if (!loggedIn) return;
    try {
      setIsSaving(true);

      // src is like /api/webdav?path=...&sharePath=...&isFile=true
      const url = new URL(src, window.location.origin);
      const path = url.searchParams.get('path');
      const sharePath = url.searchParams.get('sharePath');

      if (!path || !sharePath) {
        console.error('Missing path or sharePath on save');
        setError('Unable to save: missing file path information');
        return;
      }

      const response = await fetch('/api/webdav/text-save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include session cookie
        body: JSON.stringify({ path, sharePath, content }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Unknown error' }));
        const errorMsg = data.error || data.message || `Failed to save file (${response.status})`;
        console.error('Save failed:', errorMsg, data);
        setError(`Save failed: ${errorMsg}`);
        throw new Error(errorMsg);
      }

      setIsDirty(false);
      setLastSavedAt(new Date().toLocaleTimeString());
      setError(null); // Clear any previous errors
    } catch (err: any) {
      console.error('Error saving text file:', err);
      // Error is already set above, but ensure it's set
      if (!error) {
        setError(err.message || 'Failed to save file');
      }
    } finally {
      setIsSaving(false);
    }
  }, [loggedIn, src, content, error]);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div className={`${styles.loading} ${geistSans.className}`}>
        <div className={styles.spinner}></div>
        <p>Loading text...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.error} ${geistSans.className}`}>
        <p>{error}</p>
        <a href={`${src}&download=true`} download className={styles.downloadButton}>
          Download Text File
        </a>
      </div>
    );
  }

  return (
    <div className={`${styles.textPreviewContainer} ${geistSans.className}`}>
      <div className={styles.textHeader}>
        <div className={styles.headerLeft}>
          <h2 className={styles.fileName}>{decodeURIComponent(fileName)}</h2>
          <div className={styles.fileInfo}>
            <span className={styles.fileType}>{getLanguage()}</span>
            <span className={styles.separator}>•</span>
            <span className={styles.lineCount}>{lineCount} lines</span>
            <span className={styles.separator}>•</span>
            <span className={styles.mimeType}>{mimeType}</span>
          </div>
        </div>
        <div className={styles.headerRight}>
          {loggedIn && (
            <div className={styles.saveStatus}>
              {isSaving && <span>Saving…</span>}
              {!isSaving && isDirty && <span>Unsaved changes</span>}
              {!isSaving && !isDirty && lastSavedAt && (
                <span>Saved at {lastSavedAt}</span>
              )}
            </div>
          )}
          <div className={styles.zoomControls}>
            <button
              type="button"
              className={styles.zoomButton}
              onClick={() => setZoom((z) => +(Math.max(0.25, z - 0.1)).toFixed(2))}
              aria-label="Zoom out"
            >
              -
            </button>
            <span className={styles.zoomValue}>{Math.round(clampedZoom * 100)}%</span>
            <button
              type="button"
              className={styles.zoomButton}
              onClick={() => setZoom((z) => +(Math.min(4, z + 0.1)).toFixed(2))}
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
          <a href={`${src}&download=true`} download className={styles.downloadButton}>
            ⬇ Download
          </a>
        </div>
      </div>
      <div className={styles.textPreviewContent}>
        <div
          className={styles.zoomViewport}
          style={{ transform: `scale(${clampedZoom})` }}
        >
          {loggedIn ? (
            <textarea
              className={`${styles.editableTextarea} ${isDarkMode ? styles.darkEditor : styles.lightEditor}`}
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                scheduleAutosave();
              }}
              readOnly={false}
              disabled={false}
              spellCheck={false}
            />
          ) : (
            <SyntaxHighlighter
              language={getLanguage()}
              style={isDarkMode ? vscDarkPlus : solarizedLight}
              showLineNumbers
              wrapLines
              customStyle={{
                margin: 0,
                borderRadius: 0,
                overflowX: 'visible',
                color: isDarkMode ? '#858585' : '#333',
                background: isDarkMode ? '#1e1e1e' : '#fafafa',
              }}
              lineNumberStyle={{
                paddingRight: '1em',
                color: isDarkMode ? '#858585' : '#999',
                userSelect: 'none',
              }}
            >
              {content}
            </SyntaxHighlighter>
          )}
        </div>
      </div>
    </div>
  );
};

export default TextPreview;

