"use client";
import React, { useEffect, useState } from 'react';
import styles from '@/app/styles/textPreview.module.scss';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';

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

  // Determine language for syntax highlighting
  const getLanguage = () => {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';

    // Map file extensions to syntax highlighting languages
    const extensionMap: {[key: string]: string} = {
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
        setContent(text);

        // Count lines for display purposes
        const lines = text.split('\n').length;
        setLineCount(lines);
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

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Loading text...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <p>{error}</p>
        <a href={`${src}&download=true`} download className={styles.downloadButton}>
          Download Text File
        </a>
      </div>
    );
  }

  return (
    <div className={styles.textPreviewContainer}>
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
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={styles.themeToggle}
            aria-label="Toggle theme"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          <a href={`${src}&download=true`} download className={styles.downloadButton}>
            ⬇ Download
          </a>
        </div>
      </div>
      <div className={styles.textPreviewContent}>
        <SyntaxHighlighter
          language={getLanguage()}
          style={isDarkMode ? vscDarkPlus : vs}
          showLineNumbers
          wrapLines
          customStyle={{
            margin: 0,
            borderRadius: 0,
            maxHeight: '100%',
            height: '100%',
            overflow: 'auto',
            fontSize: '14px',
            lineHeight: '1.6',
          }}
          lineNumberStyle={{
            minWidth: '3em',
            paddingRight: '1em',
            color: isDarkMode ? '#858585' : '#999',
            userSelect: 'none',
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export default TextPreview;

