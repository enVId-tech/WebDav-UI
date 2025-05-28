'use client';

import React, { useCallback, useState } from 'react'; // Added useState
import { FileItem, FolderNode } from './types';
import { formatFileSize, formatDate, getFileIcon, getEnhancedFileIcon as utilGetEnhancedFileIcon } from './utils';
import styles from '../../styles/fileExplorer.module.scss'; // Adjusted path
import commonStyles from '../../styles/common.module.scss'; // Import common styles for theme variables
import { lookup } from 'mime-types';
import MobileNav from '../MobileNav'; // Adjusted path
import ThemeToggle from '../ThemeToggle'; // Adjusted path
import { useAuth } from '@/app/context/AuthContext'; // Corrected import path to use alias
import LoginForm from '../LoginForm'; // Import LoginForm component

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
  onDeleteFile: (fileName: string) => void;
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
  onDeleteFile,
}) => {
  const [deleteModeActive, setDeleteModeActive] = useState(false);
  const { loggedIn, login, logout, isLoading: authIsLoading, username } = useAuth(); // Get auth state, added login
  const [showLoginForm, setShowLoginForm] = useState(false); // New state for login form visibility

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

  const renderFolderNode = useCallback((node: FolderNode, level = 0): React.JSX.Element => {
    const isCurrentPath = node.path === relativePath || `/${share}${relativePath}` === node.path;
    return (
        <div key={node.path} className={styles.folderTreeNode}>
          <div
              className={`${styles.folderTreeItem} ${isCurrentPath ? styles.activePath : ''}`}
              style={{ paddingLeft: `${level * 16}px` }}
          >
          <span
              className={styles.folderExpandIcon}
              onClick={() => onToggleFolderExpansion(node.path)}
          >
            {node.children.length > 0 || !node.isLoaded ? (node.isExpanded ? '▾' : '▸') : '○'}
          </span>
            <span
                className={styles.folderIcon}
                onClick={() => onNavigateToFolder(node.path)}
            >📁</span>
            <span
                className={styles.folderName}
                onClick={() => onNavigateToFolder(node.path)}
            >{node.name}</span>
          </div>
          {node.isExpanded && node.children.map(child => renderFolderNode(child, level + 1))}
        </div>
    );
  }, [relativePath, share, onToggleFolderExpansion, onNavigateToFolder, styles]);

  // Handler for file input change
  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!loggedIn) {
      alert("Please log in to upload files.");
      setShowLoginForm(true); // Show login form if trying to upload without being logged in
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
      alert("Please log in to delete files.");
      setShowLoginForm(true); // Show login form if trying to enable delete without being logged in
      return;
    }
    setDeleteModeActive(!deleteModeActive);
  }

  if (authIsLoading) {
    return (
      <div className={`${styles.loadingContainer}`}>
        <div className={styles.spinner}></div>
        <p>Checking authentication...</p>
      </div>
    );
  }

  //LoginForm is now conditionally rendered based on showLoginForm state
  //The main file explorer UI is rendered below, and LoginForm can be shown on top or inline

  if (loadingState !== 'hidden' && !showLoginForm) { // Ensure file loading doesn't hide login form if active
    return (
      <div className={`${styles.loadingContainer} ${loadingState === 'fading' ? styles.fading : ''}`}>
        <div className={styles.spinner}></div>
        <p>Loading files...</p>
      </div>
    );
  }

  if (error && !showLoginForm) { // Ensure error display doesn't hide login form if active
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

        {/* Conditional rendering for Login Form - could be a modal or inline */}
        {showLoginForm && !loggedIn && (
          <div className={styles.loginFormOverlay}> {/* Optional: for modal-like appearance */}
            <LoginForm />
            <button onClick={() => setShowLoginForm(false)} className={styles.closeLoginButton}>Close</button>
          </div>
        )}

        <div className={styles.modernSidebar}>
          <div className={styles.sidebarHeader}>
            <h3>Folders</h3>
          </div>
          <div className={styles.modernFolderTree}>
            {folderStructure.name && renderFolderNode(folderStructure)}
          </div>
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
              {!loggedIn && !showLoginForm && (
                <button onClick={() => setShowLoginForm(true)} className={styles.modernButton} style={{ marginRight: '10px' }}>
                  Login
                </button>
              )}
              {loggedIn && (
                <button onClick={async () => { await logout(); setShowLoginForm(false);}} className={styles.modernButton} style={{ marginRight: '10px' }}>
                  Logout ({username})
                </button>
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
                </>
              )}
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
                    disabled={isSearching}
                >
                  {isSearching ? '🔍...' : '🔍'}
                </button>
              </form>
            </div>
          </div>

          <div className={styles.modernFileList}>
            {showSearchResults ? (
                <>
                  <div style={searchStyles.searchResults as React.CSSProperties} className={styles.searchResultsHeader}> {/* Added class */}
                    <h3 style={searchStyles.searchText as React.CSSProperties}>Search Results for "{searchQuery}"</h3>
                    <button
                        className={styles.modernButton}
                        onClick={() => onSetShowSearchResults(false)}
                    >
                      Back to Files
                    </button>
                  </div>
                  <div className={styles.modernFileHeader}>
                    <div className={styles.nameColumn}>Name</div>
                    <div style={searchStyles.locationColumn as React.CSSProperties} className={styles.locationColumn}>Location</div> {/* Added class */}
                    <div className={styles.dateColumn}>Modified</div>
                    <div className={styles.sizeColumn}>Size</div>
                  </div>
                  <div className={styles.modernFileItems}>
                    {searchResults.length > 0 ? (
                        searchResults.map((item) => (
                            <div key={item.filename + (item.relativePath || '')} className={styles.fileItem}> {/* Ensure unique key */}
                                <div className={styles.nameColumn}>
                                  <span className={styles.icon}>{item.type === 'directory' ? '📁' : getFileIcon(item.basename)}</span>
                                  <span className={styles.name} onClick={() => item.type === 'directory' ? onNavigateToFolder(item.relativePath || item.filename) : onFileClick(item.basename)}>{item.basename}</span>
                                </div>
                                <div style={searchStyles.locationColumn as React.CSSProperties} className={styles.locationColumn}>{item.relativePath?.substring(0, item.relativePath.lastIndexOf('/')) || '/'}</div>
                                <div className={styles.dateColumn}>{formatDate(item.lastmod)}</div>
                                <div className={styles.sizeColumn}>{item.type === 'file' ? formatFileSize(item.size) : '-'}</div>
                                {item.type === 'file' && (
                                  <button
                                    onClick={() => onDeleteFile(item.basename)}
                                    className={`${styles.deleteButton} ${deleteModeActive ? styles.visible : ''}`}
                                    title="Delete file"
                                  >
                                    🗑️
                                  </button>
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
                  <div className={styles.modernFileHeader}>
                    <div className={styles.nameColumn}>Name</div>
                    <div className={styles.dateColumn}>Modified</div>
                    <div className={styles.sizeColumn}>Size</div>
                  </div>
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
                                      <div style={gridStyles.gridInfo as React.CSSProperties}>
                                        {item.type === 'file' ? formatFileSize(item.size) : ''}
                                      </div>
                                    </div>
                                    {item.type === 'file' && (
                                      <button
                                        onClick={() => onDeleteFile(item.basename)}
                                        className={`${styles.deleteButtonGrid} ${deleteModeActive ? styles.visible : ''}`}
                                        title="Delete file"
                                        style={{ marginTop: '8px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem' }}
                                      >
                                        🗑️
                                      </button>
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
                                          onClick={() => onFileClick(item.basename)}
                                      >
                                        <div className={styles.nameColumn}>
                                          <span className={styles.icon}>{getFileIcon(item.basename)}</span>
                                          <span className={styles.name}>{item.basename}</span>
                                        </div>
                                        <div className={styles.dateColumn}>{formatDate(item.lastmod)}</div>
                                        <div className={styles.sizeColumn}>{formatFileSize(item.size)}</div>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); onDeleteFile(item.basename);}}
                                          className={`${styles.deleteButton} ${deleteModeActive ? styles.visible : ''}`}
                                          title="Delete file"
                                        >
                                          🗑️
                                        </button>
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

