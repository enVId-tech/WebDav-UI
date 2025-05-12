'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getDirectoryContents } from '@/lib/webdav-client';
import styles from '@/app/FileServer.module.scss';

// File type definitions
type FileItem = {
  filename: string;
  basename: string;
  type: 'file' | 'directory';
  size: number;
  lastmod: string;
};

export default function ShareFileBrowser() {
  const router = useRouter();
  const params = useParams();
  const [currentData, setCurrentData] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Extract share and path from URL params
  const share = params.share as string;
  const pathSegments = Array.isArray(params.path) ? params.path : [];
  const relativePath = pathSegments.length > 0 ? `/${pathSegments.join('/')}` : '/';

  // Build navigation breadcrumbs
  const breadcrumbs = [
    { name: share, path: `/${share}` },
    ...pathSegments.map((segment, index) => {
      // Decode for display
      const decodedName = decodeURIComponent(segment);
      // Create properly encoded path for navigation
      const encodedPath = `/${share}/${pathSegments
          .slice(0, index + 1)
          .map(seg => encodeURIComponent(decodeURIComponent(seg)))
          .join('/')}`;

      return {
        name: decodedName,
        path: encodedPath
      };
    })
  ];
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
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  // Navigate to a folder
  const navigateToFolder = (folderPath: string) => {
    try {
      const relativeFolderPath = folderPath.replace(`/${share}`, '');
      // Properly encode the path segments while preserving the path structure
      const encodedPath = relativeFolderPath === ''
          ? `/${share}`
          : `/${share}/${relativeFolderPath.split('/')
              .filter(segment => segment)
              .map(segment => encodeURIComponent(segment))
              .join('/')}`;

      router.push(encodedPath);
    } catch (error) {
      console.error('Navigation error:', error);
    }
  };

  // Navigate to parent directory
  const navigateUp = () => {
    if (relativePath === '/') return;
    // Get the parent path and ensure we're working with decoded values
    const decodedPath = relativePath.split('/').map(decodeURIComponent).join('/');
    const parentPath = decodedPath.substring(0, decodedPath.lastIndexOf('/')) || '/';
    navigateToFolder(`/${share}${parentPath}`);
  };

  // Get file icon based on extension
  const getFileIcon = (filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    switch (extension) {
      case 'pdf': return '📄';
      case 'docx': case 'doc': return '📝';
      case 'xlsx': case 'xls': case 'csv': return '📊';
      case 'png': case 'jpg': case 'jpeg': case 'gif': case 'svg': return '🖼️';
      case 'mp4': case 'mov': case 'avi': case 'webm': return '🎬';
      case 'mp3': case 'wav': case 'ogg': case 'flac': return '🎵';
      case 'zip': case 'rar': case '7z': case 'tar': case 'gz': return '📦';
      default: return '📄';
    }
  };

  if (loading) return (
      <div className={styles.fileServer}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading files...</p>
        </div>
      </div>
  );

  if (error) return (
      <div className={styles.fileServer}>
        <div className={styles.error}>
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={() => router.push(`/${share}`)}>Go to root</button>
        </div>
      </div>
  );

  return (
      <div className={styles.fileServer}>
        <div className={styles.header}>
          <h1>File Explorer</h1>
          <div className={styles.breadcrumb}>
            {breadcrumbs.map((crumb, index) => (
                <span key={index}>
              {index > 0 && <span className={styles.separator}>/</span>}
                  <span
                      className={styles.breadcrumbItem}
                      onClick={() => navigateToFolder(crumb.path)}
                  >
                {crumb.name}
              </span>
            </span>
            ))}
          </div>
        </div>

        {relativePath !== '/' && (
            <button className={styles.navButton} onClick={navigateUp}>
              ↑ Up
            </button>
        )}

        <div className={styles.fileList}>
          <div className={styles.fileHeader}>
            <div className={styles.nameColumn}>Name</div>
            <div className={styles.dateColumn}>Modified</div>
            <div className={styles.sizeColumn}>Size</div>
          </div>

          {currentData.map((item) => (
              <div key={item.filename} className={styles.fileItem}>
                {item.type === 'directory' ? (
                    <div
                        className={styles.folderRow}
                        onClick={() => navigateToFolder(item.filename)}
                    >
                      <div className={styles.nameColumn}>
                        <span className={styles.icon}>📁</span>
                        <span className={styles.name}>{item.basename}</span>
                      </div>
                      <div className={styles.dateColumn}>
                        {formatDate(item.lastmod)}
                      </div>
                      <div className={styles.sizeColumn}>-</div>
                    </div>
                ) : (
                    <a
                        href={`${process.env.NEXT_PUBLIC_WEBDAV_URL || '/'}${encodeURIComponent(item.filename)}`}
                        className={styles.fileRow}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                      <div className={styles.nameColumn}>
                        <span className={styles.icon}>{getFileIcon(item.basename)}</span>
                        <span className={styles.name}>{item.basename}</span>
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