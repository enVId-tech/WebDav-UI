"use client";
import React, { useEffect, useState } from 'react';
import styles from '@/app/fileserver.module.scss';
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
    return <div className={styles.loading}>Loading text content...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <div className={styles.textPreviewContainer}>
      <div className={styles.textPreviewHeader}>
        <span className={styles.fileName}>{fileName}</span>
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={styles.themeToggle}
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>
      <div className={styles.textPreviewContent}>
        <SyntaxHighlighter
          language={getLanguage()}
          style={isDarkMode ? vscDarkPlus : vs}
          showLineNumbers
          wrapLines
          customStyle={{
            margin: 0,
            borderRadius: '4px',
            maxHeight: '100%',
            overflow: 'auto',
          }}
        >
          {content}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export default TextPreview;