'use client';

import React, { useCallback, useState } from 'react';
import { FileItem, FolderNode } from './types';
import { formatFileSize, formatDate, getFileIcon, getEnhancedFileIcon as utilGetEnhancedFileIcon } from './utils';
import styles from '../../styles/fileExplorer.module.scss';
import commonStyles from '../../styles/common.module.scss';
import { lookup } from 'mime-types';
import MobileNav from '../MobileNav';
import ThemeToggle from '../ThemeToggle';
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
  const [sidebarWidth, setSidebarWidth] = useState(120);
  const [isResizing, setIsResizing] = useState(false);

  const getEnhancedFileIcon = utilGetEnhancedFileIcon;

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
      routerPush(`/login?redirect=${currentUrl}`);
      return;
    }
    const file = event.target.files?.[0];
    if (file) {
      onUploadFile(file);
      event.target.value = ''; // Reset file input
    }
  };

  const handleToggleDeleteMode = () => {
    if (!loggedIn) {
      const currentUrl = encodeURIComponent(pathname);
      routerPush(`/login?redirect=${currentUrl}`);
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
        <ThemeToggle />

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
              <h1 className={styles.explorerTitle}>File Explorer</h1>
              <MobileNav
                  currentPath={relativePath}
                  onNavigate={routerPush} // Assuming routerPush can handle this
                  breadcrumbs={breadcrumbs}
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
              {!loggedIn && (
                <button 
                  onClick={() => {
                    const currentUrl = encodeURIComponent(pathname);
                    routerPush(`/login?redirect=${currentUrl}`);
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
                    id="fileUpload"
                    style={{ display: 'none' }}
                    onChange={handleFileSelected}
                    disabled={!loggedIn} // Disable if not logged in
                  />
                  <label htmlFor="fileUpload" className={`${styles.modernButton} ${!loggedIn ? styles.disabledButton : ''}`} style={{ marginRight: '10px', cursor: loggedIn ? 'pointer' : 'not-allowed' }}>
                    Upload File
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
                  <div className={`${styles.modernFileHeader} ${styles.searchHeader}`}>
                    <div className={styles.nameColumn}>Name</div>
                    <div className={styles.locationColumn}>Location</div>
                    <div className={styles.dateColumn}>Modified</div>
                    <div className={styles.sizeColumn}>Size</div>
                  </div>
                  <div className={styles.modernFileItems}>
                    {searchResults.length > 0 ? (
                        searchResults.map((item) => (
                            <div key={item.filename + (item.relativePath || '')} className={styles.fileItem}>
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
                        ))
                    ) : (
                        <div className={styles.modernEmptyFolder}>
                          <div className={styles.emptyIcon}>🔍</div>
                          <p>{isSearching ? 'Searching...' : 'No results found'}</p>
                        </div>
                    )}
                  </div>
                </>
            ) : (
                <>
                  
                    {viewMode === 'list' && (
                      <div className={styles.modernFileHeader}>
                        <div className={styles.nameColumn}>Name</div>
                        <div className={styles.dateColumn}>Modified</div>
                        <div className={styles.sizeColumn}>Size</div>
                      </div>
                    )}
                  
                  <div className={styles.modernFileItems}>
                    {viewMode === 'grid' ? (
                        <div style={gridStyles.gridContainer as React.CSSProperties}>
                          {currentData.length > 0 ? (
                              currentData.map((item) => (
                                  <div
                                      key={item.filename}
                                      style={gridStyles.gridItem as React.CSSProperties}
                                      className={styles.gridItem} // Added class
                                      // onClick handled by individual elements now
                                  >
                                    <div style={{cursor: 'pointer'}} onClick={() => {
                                        if (item.type === 'directory') {
                                          onNavigateToFolder(item.filename);
                                        } else {
                                          onFileClick(item.basename);
                                        }
                                      }}>
                                      <div style={gridStyles.gridIcon as React.CSSProperties}>
                                        {item.type === 'directory' ? (
                                            <svg width="60" height="60" viewBox="0 0 24 24">
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
                        currentData.length > 0 ? (
                            currentData.map((item) => (
                                <div key={item.filename} className={styles.fileItem}>
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
  );
};

export default FileExplorerUI;

