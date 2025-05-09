'use client';

import { useState } from 'react';
import { FileSystemItem, FolderItem, FileItem } from './types/file-system';
import styles from './FileServer.module.scss';

const fileSystemData: FileSystemItem[] = [
  {
    id: 'folder-1',
    name: 'Documents',
    type: 'folder',
    lastModified: '2023-10-15T14:00:00Z',
    items: [
      {
        id: 'file-1',
        name: 'Project Proposal.pdf',
        type: 'file',
        size: 2500000,
        extension: 'pdf',
        lastModified: '2023-10-14T10:30:00Z',
        url: '/files/project-proposal.pdf'
      },
      {
        id: 'file-2',
        name: 'Meeting Notes.docx',
        type: 'file',
        size: 150000,
        extension: 'docx',
        lastModified: '2023-10-15T09:15:00Z',
        url: '/files/meeting-notes.docx'
      }
    ]
  },
  {
    id: 'folder-2',
    name: 'Images',
    type: 'folder',
    lastModified: '2023-10-10T16:20:00Z',
    items: [
      {
        id: 'file-3',
        name: 'Logo.png',
        type: 'file',
        size: 500000,
        extension: 'png',
        lastModified: '2023-10-05T11:45:00Z',
        url: '/files/logo.png'
      },
      {
        id: 'file-4',
        name: 'Team Photo.jpg',
        type: 'file',
        size: 3500000,
        extension: 'jpg',
        lastModified: '2023-10-09T15:30:00Z',
        url: '/files/team-photo.jpg'
      }
    ]
  },
  {
    id: 'file-5',
    name: 'Report.xlsx',
    type: 'file',
    size: 750000,
    extension: 'xlsx',
    lastModified: '2023-10-12T13:20:00Z',
    url: '/files/report.xlsx'
  }
];

const FileServer = () => {
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [currentData, setCurrentData] = useState<FileSystemItem[]>(fileSystemData);

  // Format file size to human-readable format
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format date
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Navigate to a folder
  const navigateToFolder = (folder: FolderItem) => {
    setCurrentPath([...currentPath, folder.name]);
    setCurrentData(folder.items);
  };

  // Navigate to root
  const navigateToRoot = () => {
    setCurrentPath([]);
    setCurrentData(fileSystemData);
  };

  // Navigate up one level
  const navigateUp = () => {
    if (currentPath.length === 0) return;

    const newPath = currentPath.slice(0, -1);
    setCurrentPath(newPath);

    if (newPath.length === 0) {
      setCurrentData(fileSystemData);
      return;
    }

    // Find the current folder based on the path
    let tempData = fileSystemData;
    for (let i = 0; i < newPath.length - 1; i++) {
      const folderItem = tempData.find(
          item => item.type === 'folder' && item.name === newPath[i]
      ) as FolderItem | undefined;

      if (folderItem) {
        tempData = folderItem.items;
      }
    }

    const lastFolder = tempData.find(
        item => item.type === 'folder' && item.name === newPath[newPath.length - 1]
    ) as FolderItem | undefined;

    if (lastFolder) {
      setCurrentData(lastFolder.items);
    }
  };

  // Get file icon based on extension
  const getFileIcon = (extension: string): string => {
    switch (extension) {
      case 'pdf': return '📄';
      case 'docx': case 'doc': return '📝';
      case 'xlsx': case 'xls': return '📊';
      case 'png': case 'jpg': case 'jpeg': case 'gif': return '🖼️';
      default: return '📄';
    }
  };

  return (
      <div className={styles.fileServer}>
        <div className={styles.header}>
          <h1>File Server</h1>
          <div className={styles.breadcrumb}>
            <span className={styles.breadcrumbItem} onClick={navigateToRoot}>Home</span>
            {currentPath.map((folder, index) => (
                <span key={index}>
              <span className={styles.separator}>/</span>
              <span className={styles.breadcrumbItem}>{folder}</span>
            </span>
            ))}
          </div>
        </div>

        {currentPath.length > 0 && (
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
              <div key={item.id} className={styles.fileItem}>
                {item.type === 'folder' ? (
                    <div className={styles.folderRow} onClick={() => navigateToFolder(item)}>
                      <div className={styles.nameColumn}>
                        <span className={styles.icon}>📁</span>
                        <span>{item.name}</span>
                      </div>
                      <div className={styles.dateColumn}>{formatDate(item.lastModified)}</div>
                      <div className={styles.sizeColumn}>-</div>
                    </div>
                ) : (
                    <a href={item.url} className={styles.fileRow} target="_blank" rel="noopener noreferrer">
                      <div className={styles.nameColumn}>
                        <span className={styles.icon}>{getFileIcon(item.extension)}</span>
                        <span>{item.name}</span>
                      </div>
                      <div className={styles.dateColumn}>{formatDate(item.lastModified)}</div>
                      <div className={styles.sizeColumn}>{formatFileSize(item.size)}</div>
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
};

export default FileServer;