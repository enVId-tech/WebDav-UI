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

type FolderNode = {
  name: string;
  path: string;
  children: FolderNode[];
  isExpanded?: boolean;
};

export default function ShareFileBrowser() {
  const router = useRouter();
  const params = useParams();
  const [currentData, setCurrentData] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [folderStructure, setFolderStructure] = useState<FolderNode>({ name: '', path: '', children: [] });

  // Extract share and path from URL params
  const share = params.share as string;
  const pathSegments = Array.isArray(params.path) ? params.path : [];
  const relativePath = pathSegments.length > 0 ? `/${pathSegments.join('/')}` : '/';

  // Build navigation breadcrumbs
  const breadcrumbs = [
    { name: share, path: `/${share}` },
    ...pathSegments.map((segment, index) => {
      const decodedName = decodeURIComponent(segment);
      const encodedPath = `/${share}/${pathSegments
          .slice(0, index + 1)
          .map(seg => encodeURIComponent(decodeURIComponent(seg)))
          .join('/')}`;

      return { name: decodedName, path: encodedPath };
    })
  ];

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        console.log(`Fetching data for share: /${share}${relativePath}`);
        const data = await getDirectoryContents(relativePath, `/${share}`);
        setCurrentData(data);

        // Update folder structure
        updateFolderStructure(data);

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

  // Update folder structure with the current data
  const updateFolderStructure = (data: FileItem[]) => {
    // Create root if it doesn't exist
    if (folderStructure.name === '') {
      setFolderStructure({
        name: share,
        path: `/${share}`,
        children: [],
        isExpanded: true
      });
    }

    // Add current folders to the structure
    const folders = data.filter(item => item.type === 'directory');

    // This is a simple implementation - for a real app, you'd need more complex
    // logic to maintain the full hierarchy across navigation
    const newChildren = folders.map(folder => ({
      name: folder.basename,
      path: `${relativePath === '/' ? '' : relativePath}/${folder.basename}`,
      children: [],
      isExpanded: false
    }));

    // Update the structure with current path marked as expanded
    // Note: In a real app, you'd need more sophisticated tree manipulation
    setFolderStructure(prev => ({...prev, children: newChildren}));
  };

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
      const encodedPath = relativeFolderPath === ''
          ? `/${share}`
          : `/${share}/${relativePath}/${relativeFolderPath.split('/')
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
    const parentPath = relativePath.split('/').slice(0, -1).join('/');
    const newPath = parentPath === '' ? `/${share}` : `/${share}${parentPath}`;
    router.push(newPath);
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

  // Render folder tree node recursively
  const renderFolderNode = (node: FolderNode, level = 0) => {
    const isCurrentPath = node.path === relativePath || `/${share}${relativePath}` === node.path;

    return (
        <div key={node.path} className={styles.folderTreeNode}>
          <div
              className={`${styles.folderTreeItem} ${isCurrentPath ? styles.activePath : ''}`}
              style={{ paddingLeft: `${level * 16}px` }}
              onClick={() => navigateToFolder(`/${share}${node.path}`)}
          >
            <span className={styles.folderIcon}>📁</span>
            <span className={styles.folderName}>{node.name}</span>
          </div>

          {node.isExpanded && node.children.map(child => renderFolderNode(child, level + 1))}
        </div>
    );
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
      <div className={styles.fileExplorerContainer}>
        <div className={styles.folderSidebar}>
          <div className={styles.sidebarHeader}>
            <h3>Folders</h3>
          </div>
          <div className={styles.folderTree}>
            {renderFolderNode({
              name: share,
              path: `/${share}`,
              children: folderStructure.children,
              isExpanded: true
            })}
          </div>
        </div>

        <div className={styles.fileExplorerContent}>
          <div className={styles.header}>
            <h1>File Explorer</h1>
            <div className={styles.breadcrumb}>
              {breadcrumbs.map((crumb, index) => (
                  <span key={index}>
                {index > 0 && <span className={styles.separator}>/</span>}
                    <span
                        className={styles.breadcrumbItem}
                        onClick={() => router.push(crumb.path)}
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
                          href={`/${share}${relativePath}/${encodeURIComponent(item.basename)}`}
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
      </div>
  );
}