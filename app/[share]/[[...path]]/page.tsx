'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getDirectoryContents } from '@/lib/webdav-client';
import styles from '@/app/FileServer.module.scss';

export default function ShareFileBrowser() {
  const router = useRouter();
  const params = useParams();
  const [currentData, setCurrentData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract share and path from URL params
  const share = params.share as string;
  const pathSegments = Array.isArray(params.path) ? params.path : [];
  const relativePath = pathSegments.length > 0 ? `/${pathSegments.join('/')}` : '/';

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        console.log(`Fetching data for share: /${share}${relativePath}`);
        const data = await getDirectoryContents(relativePath, `/${share}`);
        setCurrentData(data);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(`Failed to load directory contents: ${err.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [share, relativePath]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  // Navigate to a folder
  const navigateToFolder = (folderPath: string) => {
    // Extract the relative path from the full path
    const sharePath = `/${share}`;
    const relativeFolderPath = folderPath.replace(sharePath, '');

    if (relativeFolderPath === '') {
      router.push(`/${share}`);
    } else {
      router.push(`/${share}${relativeFolderPath}`);
    }
  };

  // File icon logic
  const getFileIcon = (filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    switch (extension) {
      case 'pdf': return '📄';
      case 'docx': case 'doc': return '📝';
      case 'xlsx': case 'xls': return '📊';
      case 'png': case 'jpg': case 'jpeg': case 'gif': return '🖼️';
      default: return '📄';
    }
  };

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
      <div className={styles.fileServer}>
        <div className={styles.header}>
          <h1>WebDAV Files - {share}{relativePath !== '/' ? relativePath : ''}</h1>
        </div>

        <div className={styles.fileList}>
          <div className={styles.fileHeader}>
            <div className={styles.nameColumn}>Name</div>
            <div className={styles.dateColumn}>Modified</div>
            <div className={styles.sizeColumn}>Size</div>
          </div>

          {/* Parent directory link (show only if not at root) */}
          {relativePath !== '/' && (
              <div
                  className={styles.fileItem}
                  onClick={() => {
                    // Go to parent directory
                    const parentPath = relativePath.substring(0, relativePath.lastIndexOf('/')) || '/';
                    navigateToFolder(`/${share}${parentPath}`);
                  }}
              >
                <div className={styles.folderRow}>
                  <div className={styles.nameColumn}>
                    <span className={styles.icon}>📁</span>
                    <span>..</span>
                  </div>
                  <div className={styles.dateColumn}></div>
                  <div className={styles.sizeColumn}></div>
                </div>
              </div>
          )}

          {currentData.map((item) => (
              <div key={item.filename} className={styles.fileItem}>
                {item.type === 'directory' ? (
                    <div
                        className={styles.folderRow}
                        onClick={() => navigateToFolder(item.filename)}
                    >
                      <div className={styles.nameColumn}>
                        <span className={styles.icon}>📁</span>
                        <span>{item.basename}</span>
                      </div>
                      <div className={styles.dateColumn}>
                        {formatDate(item.lastmod)}
                      </div>
                      <div className={styles.sizeColumn}>-</div>
                    </div>
                ) : (
                    <a
                        href={`${process.env.NEXT_PUBLIC_WEBDAV_URL}${item.filename}`}
                        className={styles.fileRow}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                      <div className={styles.nameColumn}>
                        <span className={styles.icon}>{getFileIcon(item.basename)}</span>
                        <span>{item.basename}</span>
                      </div>
                      <div className={styles.dateColumn}>
                        {formatDate(item.lastmod)}
                      </div>
                      <div className={styles.sizeColumn}>
                        {formatFileSize(item.size)}
                      </div>
                    </a>
                )}
              </div>
          ))}

          {currentData.length === 0 && (
              <div className={styles.emptyFolder}>This folder is empty</div>
          )}
        </div>
      </div>
  );
}