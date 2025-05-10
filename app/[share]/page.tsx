'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getDirectoryContents } from '@/lib/webdav-client';
import styles from '@/app/FileServer.module.scss';
import Link from 'next/link';

export default function ShareFileBrowser() {
  const params = useParams();
  const [currentData, setCurrentData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState('Connecting...');

  // Extract share from URL params
  const share = params.share as string;

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        setConnectionStatus(`Connecting to WebDAV: ${process.env.NEXT_PUBLIC_WEBDAV_URL}/${share}/`);
        const data = await getDirectoryContents('/', `/${share}`);
        setCurrentData(data);
        setError(null);
      } catch (err: any) {
        console.error('Error details:', err);
        setError(`Connection error: ${err.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    if (share) {
      fetchData();
    }
  }, [share]);

  if (loading) {
    return (
        <div className={styles.loading}>
          <p>Loading content from WebDAV server...</p>
          <p>{connectionStatus}</p>
        </div>
    );
  }

  if (error) {
    return (
        <div className={styles.error}>
          <h2>Error loading WebDAV content</h2>
          <p>{error}</p>
          <p>Please check:</p>
          <ul>
            <li>WebDAV server is running and accessible</li>
            <li>Share path "{share}" exists on the server</li>
            <li>CORS is properly configured on your WebDAV server</li>
          </ul>
          <p>Server URL: {process.env.NEXT_PUBLIC_WEBDAV_URL}/{share}/</p>
        </div>
    );
  }

  return (
      <div className={styles.fileServer}>
        <h1>Files in /{share}/</h1>
        {/* File listing UI here */}
      </div>
  );
}