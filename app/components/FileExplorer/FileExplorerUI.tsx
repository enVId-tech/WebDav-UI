'use client';

import React, { useCallback, useState } from 'react';
import { FileItem, FolderNode } from './types';
import { formatFileSize, formatDate, getFileIcon, getEnhancedFileIcon as utilGetEnhancedFileIcon } from './utils';
import styles from '../../styles/fileExplorer.module.scss';
import commonStyles from '../../styles/common.module.scss';
import { lookup } from 'mime-types';
import MobileNav from '../MobileNav';
import { useAuth } from '@/app/context/AuthContext';
import { geistMono } from '@/app/types/font';
import { usePathname } from 'next/navigation';

interface FileExplorerUIProps {
  loadingState: 'active' | 'fading' | 'hidden';
  error: string | null;
  folderStructure: FolderNode;
  share: string;
  relativePath: string;
  breadcrumbs: Array<{ name: string; path: string }>;
  currentData: FileItem[];
  viewMode: 'list' | 'grid';
  searchQuery: string;
  searchResults: FileItem[];
  isSearching: boolean;
  showSearchResults: boolean;
  routerPush: (path: string) => void;
  onNavigateUp: () => void;
  onToggleViewMode: () => void;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchSubmit: (e: React.FormEvent) => void;
  onSetShowSearchResults: (show: boolean) => void;
  onNavigateToFolder: (folderPath: string) => void;
  onFileClick: (fileName: string) => void;
  onToggleFolderExpansion: (path: string) => void;
  onUploadFile: (file: File) => void;
  onDeleteFiles: (fileNames: string[]) => void;
}

const FileExplorerUI: React.FC<FileExplorerUIProps> = ({
  loadingState,
  error,
  folderStructure,
  share,
  relativePath,
  breadcrumbs,
  currentData,
  viewMode,
  searchQuery,
  searchResults,
  isSearching,
  showSearchResults,
  routerPush,
  onNavigateUp,
  onToggleViewMode,
  onSearchChange,
  onSearchSubmit,
  onSetShowSearchResults,
  onNavigateToFolder,
  onFileClick,
  onToggleFolderExpansion,
  onUploadFile,
  onDeleteFiles,
}) => {
  const [deleteModeActive, setDeleteModeActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const { loggedIn, logout, isLoading: authIsLoading, username, isAdmin } = useAuth();
  const pathname = usePathname();
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Theme management
  React.useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    
    setIsDarkMode(shouldBeDark);
    
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    
    if (newTheme) {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  // Sorting and Filtering State
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fileExplorer_activeFilters');
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch {
          return new Set();
        }
      }
    }
    return new Set();
  });
  const [viewSize, setViewSize] = useState<'small' | 'medium' | 'large'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fileExplorer_viewSize');
      return (saved === 'small' || saved === 'medium' || saved === 'large') ? saved : 'medium';
    }
    return 'medium';
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fileExplorer_itemsPerPage');
      const parsed = saved ? parseInt(saved, 10) : 25;
      return !isNaN(parsed) && parsed > 0 ? parsed : 25;
    }
    return 25;
  });

  // Save settings to localStorage whenever they change
  React.useEffect(() => {
    localStorage.setItem('fileExplorer_itemsPerPage', itemsPerPage.toString());
  }, [itemsPerPage]);

  React.useEffect(() => {
    localStorage.setItem('fileExplorer_viewSize', viewSize);
  }, [viewSize]);

  React.useEffect(() => {
    localStorage.setItem('fileExplorer_activeFilters', JSON.stringify(Array.from(activeFilters)));
  }, [activeFilters]);

  const getEnhancedFileIcon = utilGetEnhancedFileIcon;

  const handleFilterToggle = (type: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleSort = (column: 'name' | 'date' | 'size') => {
    if (sortBy === column) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Filter and Sort Logic
  const getFilteredAndSortedFiles = useCallback(() => {
    let files = [...currentData];

    // Filter
    if (activeFilters.size > 0) {
      files = files.filter(item => {
        let type = 'other';
        const mimeType = lookup(item.basename) || '';
        
        if (item.type === 'directory') type = 'folder';
        else if (mimeType.startsWith('video/')) type = 'video';
        else if (mimeType.startsWith('image/')) type = 'image';
        else if (mimeType.startsWith('audio/')) type = 'audio';
        else if (mimeType.startsWith('text/') || mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('spreadsheet') || mimeType.includes('presentation')) type = 'document';
        
        return activeFilters.has(type);
      });
    }

    // Sort
    files.sort((a, b) => {
      // Always keep directories on top unless sorting by size/date specifically requested to mix? 
      // Usually folders are always on top in Windows.
      if (a.type === 'directory' && b.type !== 'directory') return -1;
      if (a.type !== 'directory' && b.type === 'directory') return 1;

      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.basename.localeCompare(b.basename);
          break;
        case 'size':
          comparison = (a.size || 0) - (b.size || 0);
          break;
        case 'date':
          comparison = new Date(a.lastmod).getTime() - new Date(b.lastmod).getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return files;
  }, [currentData, activeFilters, sortBy, sortOrder]);

  const displayedFiles = getFilteredAndSortedFiles();

  // Filter Search Results
  const filteredSearchResults = React.useMemo(() => {
    if (activeFilters.size === 0) return searchResults;
    return searchResults.filter(item => {
        let type = 'other';
        const mimeType = lookup(item.basename) || '';
        
        if (item.type === 'directory') type = 'folder';
        else if (mimeType.startsWith('video/')) type = 'video';
        else if (mimeType.startsWith('image/')) type = 'image';
        else if (mimeType.startsWith('audio/')) type = 'audio';
        else if (mimeType.startsWith('text/') || mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('spreadsheet') || mimeType.includes('presentation')) type = 'document';
        
        return activeFilters.has(type);
    });
  }, [searchResults, activeFilters]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredSearchResults.length / itemsPerPage);
  
  const paginatedSearchResults = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredSearchResults.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredSearchResults, currentPage, itemsPerPage]);

  // Reset to page 1 when search results or filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchResults, activeFilters, itemsPerPage]);

  // Pagination Controls
  const renderPaginationControls = () => (
    <div className={styles.paginationControls}>
      <div className={styles.paginationInfo}>
        <span>Show:</span>
        <select 
          value={itemsPerPage} 
          onChange={(e) => setItemsPerPage(Number(e.target.value))}
          className={styles.itemsPerPageSelect}
        >
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
        </select>
        <span>items per page</span>
      </div>
      
      <div className={styles.paginationButtons}>
        <button 
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className={styles.paginationButton}
        >
          Previous
        </button>
        <span className={styles.pageIndicator}>
          Page {currentPage} of {Math.max(totalPages, 1)}
        </span>
        <button 
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage >= totalPages}
          className={styles.paginationButton}
        >
          Next
        </button>
      </div>
    </div>
  );

  const searchStyles = {
    searchForm: {
      display: 'flex',
      flex: 1,
      maxWidth: '500px',
    },
    searchInput: {
      flex: 1,
      padding: '0.5rem 1rem',
      borderRadius: '4px 0 0 4px',
      border: '1px solid #ced4da',
      borderRight: 'none',
    },
    searchButton: {
      padding: '0.5rem 1rem',
      background: '#0d6efd',
      color: 'white',
      border: 'none',
      borderRadius: '0 4px 4px 0',
      cursor: 'pointer',
    },
    searchResults: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '1rem 1.5rem',
      borderBottom: '1px solid #e3e6f0',
    },
    locationColumn: {
      color: '#6c757d',
      fontSize: '0.9rem',
    },
    searchText: {
      fontSize: '1.2rem',
      fontWeight: 'bold',
      color: '#0d6efd',
    }
  };

  const gridStyles = {
    gridContainer: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: '16px',
      padding: '16px',
    },
    gridItem: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '16px',
      borderRadius: '8px',
      backgroundColor: 'var(--background-color, white)', // Use CSS var
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      transition: 'transform 0.15s, box-shadow 0.15s',
      cursor: 'pointer',
      overflow: 'hidden',
      textAlign: 'center' as 'center',
      height: '100%',
      color: 'var(--text-color, #333)', // Use CSS var
    },
    gridItemHover: {
      transform: 'translateY(-4px)',
      boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
    },
    gridIcon: {
      fontSize: '3rem',
      marginBottom: '12px',
      width: '100px',
      height: '100px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    gridName: {
      fontSize: '0.9rem',
      fontWeight: '500',
      wordBreak: 'break-word' as 'break-word',
      maxWidth: '100%',
    },
    gridInfo: {
      fontSize: '0.8rem',
      color: 'var(--secondary-text-color, #6c757d)', // Use CSS var
      marginTop: '8px',
    },
    thumbnail: {
      width: '100px',
      height: '100px',
      objectFit: 'cover' as 'cover',
      borderRadius: '4px',
    }
  };

  const getFilePreview = useCallback((filename: string, currentPath: string): React.JSX.Element => {
    const mimeType = lookup(filename) || '';
    const isImage = mimeType.startsWith('image/');

    if (isImage) {
      const imgPath = `/${share}${currentPath === '/' ? '' : currentPath}/${encodeURIComponent(filename)}`;
      return (
          <img
              src={imgPath}
              alt={filename}
              style={gridStyles.thumbnail}
              onError={(e) => {
                const parent = e.currentTarget.parentElement;
                if (parent) {
                    e.currentTarget.style.display = 'none';
                    const iconDiv = document.createElement('div');
                    iconDiv.innerHTML = getEnhancedFileIcon(filename);
                    parent.appendChild(iconDiv.firstChild || new Node());
                }
              }}
          />
      );
    }
    return <div dangerouslySetInnerHTML={{ __html: getEnhancedFileIcon(filename) }} />;
  }, [share, getEnhancedFileIcon, gridStyles.thumbnail]);

  // Handle sidebar resize
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = e.clientX;
    if (newWidth >= 50 && newWidth <= 800) {
      setSidebarWidth(newWidth);
    }
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // Add and remove event listeners for resize
  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const renderFolderNode = useCallback((node: FolderNode, level = 0): React.JSX.Element | null => {
    const isCurrentPath = node.path === relativePath || `/${share}${relativePath}` === node.path;

    console.log('Rendering folder node:', node.path, 'Current path:', `/${share}${relativePath}`, 'Is current:', isCurrentPath);

    // Filter based on sidebar search
    if (sidebarSearchQuery && !node.name.toLowerCase().includes(sidebarSearchQuery.toLowerCase())) {
      // Check if any children match
      const hasMatchingChild = node.children.some(child => 
        child.name.toLowerCase().includes(sidebarSearchQuery.toLowerCase())
      );
      if (!hasMatchingChild) return null;
    }
    
    const hasChildren = node.children.length > 0 || !node.isLoaded;
    
    return (
        <div key={node.path} className={styles.folderTreeNode}>
          <div
              className={`${styles.folderTreeItem} ${isCurrentPath ? styles.activePath : ''}`}
              style={{ paddingLeft: `${level * 12 + 8}px` }}
              title={node.path}
          >
            <span
                className={styles.folderExpandIcon}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFolderExpansion(node.path);
                }}
            >
              {hasChildren ? (
                node.isExpanded ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M2 4l4 4 4-4z"/>
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M4 2l4 4-4 4z"/>
                  </svg>
                )
              ) : (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" style={{ opacity: 0.3 }}>
                  <circle cx="4" cy="4" r="2"/>
                </svg>
              )}
            </span>
            <span
                className={styles.folderIconWrapper}
                onClick={() => onNavigateToFolder(node.path)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className={styles.folderIcon}>
                <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" 
                      fill={isCurrentPath ? 'var(--accent-color)' : 'currentColor'}
                      opacity={isCurrentPath ? '1' : '0.7'}/>
              </svg>
            </span>
            <span
                className={styles.folderName}
                onClick={() => onNavigateToFolder(node.path)}
            >{node.name}</span>
            {isCurrentPath && <span className={styles.activeIndicator}></span>}
          </div>
          {node.isExpanded && (
            node.children.length > 0 ? (
              node.children.map(child => renderFolderNode(child, level + 1))
            ) : (
              <div style={{ paddingLeft: `${(level + 1) * 12 + 8}px`, paddingTop: '4px', paddingBottom: '4px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                {!node.isLoaded ? 'Loading...' : 'Empty'}
              </div>
            )
          )}
        </div>
    );
  }, [relativePath, share, sidebarSearchQuery, onToggleFolderExpansion, onNavigateToFolder, styles]);

  // Handler for file input change
  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!loggedIn) {
      const currentUrl = encodeURIComponent(pathname);
      const sharePath = encodeURIComponent(`/${share}${relativePath}`);
      routerPush(`/login?redirect=${currentUrl}&path=${sharePath}`);
      return;
    }
    const files = event.target.files;
    if (files && files.length > 0) {
      // Handle multiple files if needed, for now just first file
      onUploadFile(files[0]);
      event.target.value = ''; // Reset file input
    }
  };

  // Drag and drop handlers
  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (loggedIn && !isDragging) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    // Check if we're really leaving (not entering child element)
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;
    if (x <= rect.left || x >= rect.right || y <= rect.top || y >= rect.bottom) {
      setIsDragging(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    
    if (!loggedIn) {
      const currentUrl = encodeURIComponent(pathname);
      const sharePath = encodeURIComponent(`/${share}${relativePath}`);
      routerPush(`/login?redirect=${currentUrl}&path=${sharePath}`);
      return;
    }

    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
      // Handle first file for now
      onUploadFile(files[0]);
    }
  };

  const handleToggleDeleteMode = () => {
    if (!loggedIn) {
      const currentUrl = encodeURIComponent(pathname);
      const sharePath = encodeURIComponent(`/${share}${relativePath}`);
      routerPush(`/login?redirect=${currentUrl}&path=${sharePath}`);
      return;
    }
    const next = !deleteModeActive;
    setDeleteModeActive(next);
    if (!next) {
      setSelectedFiles(new Set());
    }
  };

  const toggleFileSelection = (basename: string) => {
    setSelectedFiles(prev => {
      const next = new Set(prev);
      if (next.has(basename)) {
        next.delete(basename);
      } else {
        next.add(basename);
      }
      return next;
    });
  };

  const handleDeleteSelected = () => {
    if (!loggedIn || selectedFiles.size === 0) return;
    const names = Array.from(selectedFiles);
    onDeleteFiles(names);
    setSelectedFiles(new Set());
  };

  if (authIsLoading) {
    return (
      <div className={`${styles.loadingContainer}`}>
        <div className={styles.spinner}></div>
        <p className={`${geistMono.className}`}>Checking authentication...</p>
      </div>
    );
  }

  if (loadingState !== 'hidden') {
    return (
      <div className={`${styles.loadingContainer} ${loadingState === 'fading' ? styles.fading : ''}`}>
        <div className={styles.spinner}></div>
        <p className={`${geistMono.className}`}>Loading files...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorContent}>
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={() => routerPush(`/${share}`)}>Go to root</button>
        </div>
      </div>
    );
  }
  return (
      <div className={`${styles.modernExplorerContainer} ${commonStyles.themeVariables}`}>
        <div 
          className={styles.explorerContentWrapper}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
        <div className={`${styles.modernSidebar} ${sidebarCollapsed ? styles.collapsed : ''}`} style={{ width: sidebarCollapsed ? '60px' : `${sidebarWidth}px` }}>
          <div className={styles.sidebarHeader}>
            <div className={styles.sidebarHeaderContent}>
              {!sidebarCollapsed && (
                <>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className={styles.sidebarLogo}>
                    <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z"/>
                  </svg>
                  <h3>Navigation</h3>
                </>
              )}
              <button 
                className={styles.collapseButton}
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  {sidebarCollapsed ? (
                    <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                  ) : (
                    <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
                  )}
                </svg>
              </button>
            </div>
          </div>
          
          {!sidebarCollapsed && (
            <>
              <div className={styles.sidebarSearch}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className={styles.searchIcon}>
                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <input
                  type="text"
                  placeholder="Search folders..."
                  value={sidebarSearchQuery}
                  onChange={(e) => setSidebarSearchQuery(e.target.value)}
                  className={styles.sidebarSearchInput}
                />
                {sidebarSearchQuery && (
                  <button
                    className={styles.clearSearchButton}
                    onClick={() => setSidebarSearchQuery('')}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              <div className={styles.folderTreeHeader}>
                <span>Folders</span>
                {sidebarSearchQuery && (
                  <span className={styles.searchResultCount}>Filtered</span>
                )}
              </div>
              <div className={styles.modernFolderTree}>
                {folderStructure.name ? (
                  renderFolderNode(folderStructure)
                ) : (
                  <div className={styles.emptyFolderTree}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                      <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
                    </svg>
                    <p>No folders found</p>
                  </div>
                )}
              </div>
            </>
          )}
          {!sidebarCollapsed && (
            <div 
              className={styles.resizeHandle}
              onMouseDown={handleMouseDown}
            />
          )}
        </div>

        <div className={styles.modernContent}>
          <div className={styles.topBar}>
            <div className={styles.modernHeader}>
              <h1 className={styles.explorerTitle}>WebDav Content Explorer</h1>
              <MobileNav
                  currentPath={relativePath}
                  onNavigate={routerPush}
                  breadcrumbs={breadcrumbs}
                  folderStructure={folderStructure}
                  onToggleFolderExpansion={onToggleFolderExpansion}
                  share={share}
              />
              <div className={styles.modernBreadcrumb}>
                {breadcrumbs.map((crumb, index) => (
                    <span key={index}>
                {index > 0 && <span className={styles.separator}>/</span>}
                      <span
                          className={styles.breadcrumbItem}
                          onClick={() => routerPush(crumb.path)}
                      >
                  {crumb.name}
                </span>
              </span>
                ))}
              </div>
            </div>

            <div className={styles.modernActions}>
              <button 
                onClick={toggleTheme}
                className={styles.themeToggleButton}
                title={isDarkMode ? 'Switch to light theme' : 'Switch to dark theme'}
              >
                {isDarkMode ? '☀️' : '🌙'}
              </button>
              {!loggedIn && (
                <button 
                  onClick={() => {
                    const currentUrl = encodeURIComponent(pathname);
                    const sharePath = encodeURIComponent(`/${share}${relativePath}`);
                    routerPush(`/login?redirect=${currentUrl}&path=${sharePath}`);
                  }} 
                  className={styles.modernButton} 
                  style={{ marginRight: '10px' }}
                >
                  Login
                </button>
              )}
              {loggedIn && (
                <>
                  {isAdmin && (
                    <button 
                      onClick={() => routerPush('/admin')} 
                      className={styles.modernButton} 
                      style={{ marginRight: '10px', background: '#ffc107', color: '#333' }}
                      title="Manage Permissions"
                    >
                      ⚙️ Admin
                    </button>
                  )}
                  <button 
                    onClick={async () => { await logout(); }} 
                    className={styles.modernButton} 
                    style={{ marginRight: '10px' }}
                  >
                    Logout ({username})
                  </button>
                </>
              )}
              {relativePath !== '/' && (
                  <button className={styles.modernButton} onClick={onNavigateUp}>
                    ↑ Up
                  </button>
              )}
              {loggedIn && (
                <>
                  <input
                    type="file"
                    ref={fileInputRef}
                    id="fileUpload"
                    style={{ display: 'none' }}
                    onChange={handleFileSelected}
                    disabled={!loggedIn}
                  />
                  <label 
                    htmlFor="fileUpload" 
                    className={`${styles.modernButton} ${styles.uploadButton} ${!loggedIn ? styles.disabledButton : ''}`} 
                    style={{ marginRight: '10px', cursor: loggedIn ? 'pointer' : 'not-allowed' }}
                  >
                    📤 Upload
                  </label>
                  {/* Toggle Delete Mode Button */}
                  <button
                    className={`${styles.toggleDeleteButton} ${deleteModeActive ? styles.active : ''} ${!loggedIn ? styles.disabledButton : ''}`}
                    onClick={handleToggleDeleteMode} // Already checks for login
                    style={{ marginRight: '10px' }}
                    disabled={!loggedIn} // Disable if not logged in
                  >
                    {deleteModeActive ? 'Cancel Delete' : 'Enable Delete'}
                  </button>
                  {deleteModeActive && (
                    <button
                      className={styles.modernButton}
                      onClick={handleDeleteSelected}
                      disabled={selectedFiles.size === 0}
                    >
                      Delete Selected ({selectedFiles.size})
                    </button>
                  )}
                </>
              )}
              {/* View Mode Toggle Button */}
              <button
                onClick={onToggleViewMode}
                className={styles.modernButton}
                style={{ marginRight: '10px' }}
                title={viewMode === 'grid' ? "Switch to List View" : "Switch to Grid View"}
              >
                {viewMode === 'grid' ? 'List' : 'Grid'} View
              </button>

              {/* View Size Controls */}
              <div className={styles.viewSizeControls}>
                <button 
                  className={`${styles.sizeButton} ${viewSize === 'small' ? styles.active : ''}`}
                  onClick={() => setViewSize('small')}
                  title="Small Icons"
                >S</button>
                <button 
                  className={`${styles.sizeButton} ${viewSize === 'medium' ? styles.active : ''}`}
                  onClick={() => setViewSize('medium')}
                  title="Medium Icons"
                >M</button>
                <button 
                  className={`${styles.sizeButton} ${viewSize === 'large' ? styles.active : ''}`}
                  onClick={() => setViewSize('large')}
                  title="Large Icons"
                >L</button>
              </div>

              {/* Filter Controls */}
              <div className={`${styles.filterControls} ${commonStyles.themeVariables}`}>
                Filter:
                {['folder', 'video', 'image', 'audio', 'document'].map(type => (
                  <button
                    key={type}
                    className={`${styles.filterButton} ${activeFilters.has(type) ? styles.active : ''}`}
                    onClick={() => handleFilterToggle(type)}
                    title={`Filter by ${type}`}
                  >
                    {type === 'folder' ? '📁' : 
                     type === 'video' ? '🎬' : 
                     type === 'image' ? '🖼️' : 
                     type === 'audio' ? '🎵' : '📄'}
                  </button>
                ))}
                {activeFilters.size > 0 && (
                  <button 
                    className={styles.clearFilterButton}
                    onClick={() => setActiveFilters(new Set())}
                    title="Clear Filters"
                  >✕</button>
                )}
              </div>

              <form onSubmit={onSearchSubmit} style={searchStyles.searchForm as React.CSSProperties}>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={onSearchChange}
                    placeholder="Search files..."
                    style={searchStyles.searchInput as React.CSSProperties}
                    className={styles.searchInput} // Added for consistency
                />
                <button
                    type="submit"
                    style={searchStyles.searchButton as React.CSSProperties}
                    className={styles.searchButton} // Added for consistency
                    title={isSearching ? 'Search in progress - click to start new search' : 'Search'}
                >
                  {isSearching ? '🔍...' : '🔍'}
                </button>
              </form>
            </div>
          </div>

          <div className={styles.modernFileList}>
            {isDragging && loggedIn && (
              <div className={styles.dropZone}>
                <div className={styles.dropZoneContent}>
                  <div className={styles.dropZoneIcon}>📁</div>
                  <div className={styles.dropZoneText}>Drop file here to upload</div>
                </div>
              </div>
            )}
            {showSearchResults ? (
                <>
                  <div className={styles.searchResultsHeader}>
                    <h3>Search Results for "{searchQuery}"</h3>
                    <button
                        className={styles.modernButton}
                        onClick={() => onSetShowSearchResults(false)}
                    >
                      Back to Files
                    </button>
                  </div>
                  {filteredSearchResults.length > 0 && renderPaginationControls()}
                  <div className={`${styles.modernFileHeader} ${styles.searchHeader}`}>
                    <div className={styles.nameColumn}>Name</div>
                    <div className={styles.locationColumn}>Location</div>
                    <div className={styles.dateColumn}>Modified</div>
                    <div className={styles.sizeColumn}>Size</div>
                  </div>
                  <div className={`${styles.modernFileItems} ${styles[viewSize]}`}>
                    {paginatedSearchResults.length > 0 ? (
                        paginatedSearchResults.map((item) => (
                            <div key={item.filename + (item.relativePath || '')} className={`${styles.fileItem} ${styles[viewSize]}`}>
                                <div className={styles.modernFileRow}>
                                  <div className={styles.nameColumn}>
                                    <span className={styles.icon}>{item.type === 'directory' ? '📁' : getFileIcon(item.basename)}</span>
                                    <span className={styles.name} onClick={() => item.type === 'directory' ? onNavigateToFolder(item.relativePath || item.filename) : onFileClick(item.basename)}>{item.basename}</span>
                                  </div>
                                  <div className={styles.locationColumn}>{item.relativePath?.replaceAll("%20", " ").substring(0, item.relativePath.lastIndexOf('/')) || '/'}</div>
                                  <div className={styles.dateColumn}>{formatDate(item.lastmod)}</div>
                                  <div className={styles.sizeColumn}>{item.type === 'file' ? formatFileSize(item.size) : '-'}</div>
                                  {loggedIn && deleteModeActive && item.type === 'file' && (
                                    <input
                                      type="checkbox"
                                      checked={selectedFiles.has(item.basename)}
                                      onChange={() => toggleFileSelection(item.basename)}
                                    />
                                  )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className={styles.modernEmptyFolder}>
                          <div className={styles.emptyIcon}>🔍</div>
                          <p>{isSearching ? 'Searching...' : 'No results found'}</p>
                        </div>
                    )}
                  </div>
                  {filteredSearchResults.length > 0 && renderPaginationControls()}
                </>
            ) : (
                <>
                  
                    {viewMode === 'list' && (
                      <div className={styles.modernFileHeader}>
                        <div 
                          className={`${styles.nameColumn} ${styles.sortableHeader}`} 
                          onClick={() => handleSort('name')}
                          title="Sort by Name"
                        >
                          Name <span className={`${styles.sortIcon} ${sortBy === 'name' ? styles.active : ''}`}>{sortBy === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                        </div>
                        <div 
                          className={`${styles.dateColumn} ${styles.sortableHeader}`}
                          onClick={() => handleSort('date')}
                          title="Sort by Date"
                        >
                          Modified <span className={`${styles.sortIcon} ${sortBy === 'date' ? styles.active : ''}`}>{sortBy === 'date' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                        </div>
                        <div 
                          className={`${styles.sizeColumn} ${styles.sortableHeader}`}
                          onClick={() => handleSort('size')}
                          title="Sort by Size"
                        >
                          Size <span className={`${styles.sortIcon} ${sortBy === 'size' ? styles.active : ''}`}>{sortBy === 'size' ? (sortOrder === 'asc' ? '↑' : '↓') : '↕'}</span>
                        </div>
                      </div>
                    )}
                  
                  <div className={`${styles.modernFileItems} ${styles[viewSize]}`}>
                    {viewMode === 'grid' ? (
                        <div style={{
                          ...gridStyles.gridContainer,
                          gridTemplateColumns: viewSize === 'small' ? 'repeat(auto-fill, minmax(120px, 1fr))' : 
                                             viewSize === 'large' ? 'repeat(auto-fill, minmax(240px, 1fr))' : 
                                             'repeat(auto-fill, minmax(180px, 1fr))'
                        } as React.CSSProperties}>
                          {displayedFiles.length > 0 ? (
                              displayedFiles.map((item) => (
                                  <div
                                      key={item.filename}
                                      style={gridStyles.gridItem as React.CSSProperties}
                                      className={`${styles.gridItem} ${styles[viewSize]}`}
                                      // onClick handled by individual elements now
                                  >
                                    <div style={{cursor: 'pointer'}} onClick={() => {
                                        if (item.type === 'directory') {
                                          onNavigateToFolder(item.filename);
                                        } else {
                                          onFileClick(item.basename);
                                        }
                                      }}>
                                      <div style={{
                                        ...gridStyles.gridIcon,
                                        width: viewSize === 'small' ? '60px' : viewSize === 'large' ? '140px' : '100px',
                                        height: viewSize === 'small' ? '60px' : viewSize === 'large' ? '140px' : '100px',
                                        fontSize: viewSize === 'small' ? '2rem' : viewSize === 'large' ? '4rem' : '3rem'
                                      } as React.CSSProperties}>
                                        {item.type === 'directory' ? (
                                            <svg width="100%" height="100%" viewBox="0 0 24 24">
                                              <path fill="#ffc107" d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                                            </svg>
                                        ) : (
                                            getFilePreview(item.basename, relativePath)
                                        )}
                                      </div>
                                      <div style={gridStyles.gridName as React.CSSProperties}>{item.basename}</div>
                                      {/* Updated gridInfo to include Modified Date */}
                                      <div style={gridStyles.gridInfo as React.CSSProperties} className={styles.gridItemInfo}>
                                        <div>{formatDate(item.lastmod)}</div>
                                        {item.type === 'file' && (item.size >= 0) && <div>{formatFileSize(item.size)}</div>}
                                      </div>
                                    </div>
                                    {item.type === 'file' && deleteModeActive && (
                                      <input
                                        type="checkbox"
                                        checked={selectedFiles.has(item.basename)}
                                        onChange={() => toggleFileSelection(item.basename)}
                                      />
                                    )}
                                  </div>
                              ))
                          ) : (
                              <div className={styles.modernEmptyFolder}>
                                <div className={styles.emptyIcon}>📂</div>
                                <p>This folder is empty</p>
                              </div>
                          )}
                        </div>
                    ) : (
                        displayedFiles.length > 0 ? (
                            displayedFiles.map((item) => (
                                <div key={item.filename} className={`${styles.fileItem} ${styles[viewSize]}`}>
                                  {item.type === 'directory' ? (
                                      <div
                                          className={styles.modernFolderRow}
                                          onClick={() => onNavigateToFolder(item.filename)}
                                      >
                                        <div className={styles.nameColumn}>
                                          <span className={styles.icon}>📁</span>
                                          <span className={styles.name}>{item.basename}</span>
                                        </div>
                                        <div className={styles.dateColumn}>{formatDate(item.lastmod)}</div>
                                        <div className={styles.sizeColumn}>-</div>
                                      </div>
                                  ) : (
                                        <div
                                          className={styles.modernFileRow}
                                          onClick={() => !deleteModeActive && onFileClick(item.basename)}
                                        >
                                        <div className={styles.nameColumn}>
                                          <span className={styles.icon}>{getFileIcon(item.basename)}</span>
                                          <span className={styles.name}>{item.basename}</span>
                                        </div>
                                        <div className={styles.dateColumn}>{formatDate(item.lastmod)}</div>
                                        <div className={styles.sizeColumn}>{formatFileSize(item.size)}</div>
                                        {deleteModeActive && (
                                          <input
                                            type="checkbox"
                                            checked={selectedFiles.has(item.basename)}
                                            onChange={(e) => { e.stopPropagation(); toggleFileSelection(item.basename); }}
                                          />
                                        )}
                                      </div>
                                  )}
                                </div>
                            ))
                        ) : (
                            <div className={styles.modernEmptyFolder}>
                              <div className={styles.emptyIcon}>📂</div>
                              <p>This folder is empty</p>
                            </div>
                        )
                    )}
                  </div>
                </>
            )}
          </div>
        </div>
        </div>
      </div>
  );
};

export default FileExplorerUI;

