'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getDirectoryContents } from '@/lib/webdav-client';
import styles from '../../fileserver.module.scss';

type FileItem = {
  filename: string;
  basename: string;
  type: 'file' | 'directory';
  size: number;
  lastmod: string;
  relativePath?: string;
};

type FolderNode = {
  name: string;
  path: string;
  children: FolderNode[];
  isExpanded: boolean;
  isLoaded: boolean;
};

export default function ShareFileBrowser() {
  const router = useRouter();
  const params = useParams();
  const [currentData, setCurrentData] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [folderStructure, setFolderStructure] = useState<FolderNode>({
    name: '',
    path: '',
    children: [],
    isExpanded: true,
    isLoaded: false
  });

  // Search functionality
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchProgress, setSearchProgress] = useState<{
    currentFolder: string;
    foldersSearched: number;
    totalFolders: number;
  }>({
    currentFolder: '',
    foldersSearched: 0,
    totalFolders: 0
  });
  const [searchComplete, setSearchComplete] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Extract share and path from URL params - memoized to prevent recalculation
  const share = useMemo(() => params.share as string, [params.share]);
  const pathSegments = useMemo(() =>
          Array.isArray(params.path) ? params.path : [],
      [params.path]
  );
  const relativePath = useMemo(() =>
          pathSegments.length > 0 ? `/${pathSegments.join('/')}` : '/',
      [pathSegments]
  );

  // Build navigation breadcrumbs - memoized to prevent recalculation
  const breadcrumbs = useMemo(() => [
    { name: share, path: `/${share}` },
    ...pathSegments.map((segment, index) => {
      const decodedName = decodeURIComponent(segment);
      const encodedPath = `/${share}/${pathSegments
          .slice(0, index + 1)
          .map(seg => encodeURIComponent(decodeURIComponent(seg)))
          .join('/')}`;

      return { name: decodedName, path: encodedPath };
    })
  ], [share, pathSegments]);

  // Stable function references with useCallback to prevent re-creation on render
  const buildPathForApi = useCallback((path: string): string => {
    return path === '/' ? '/' : path.replace(/\/+/g, '/');
  }, []);

  const loadDirectoryContents = useCallback(async (path: string, sharePath: string) => {
    try {
      const apiPath = buildPathForApi(path);
      console.log(`Fetching data for: ${apiPath} in share: ${sharePath}`);
      return await getDirectoryContents(apiPath, sharePath);
    } catch (err: any) {
      console.error('Error fetching directory:', err);
      throw err;
    }
  }, [buildPathForApi]);

  // Update or add a folder node in the tree - memoized since it doesn't depend on state
  const updateFolderInTree = useCallback((
      structure: FolderNode,
      targetPath: string,
      newChildren: FolderNode[],
      shareId: string
  ): FolderNode => {
    if (targetPath === '/' && structure.path === '') {
      return {
        ...structure,
        name: shareId,
        path: '/',
        children: newChildren,
        isExpanded: true,
        isLoaded: true
      };
    }

    const normPath = targetPath.endsWith('/') ? targetPath : `${targetPath}/`;

    const updateNode = (node: FolderNode): FolderNode => {
      const nodePath = node.path.endsWith('/') ? node.path : `${node.path}/`;

      if (nodePath === normPath) {
        return {
          ...node,
          children: newChildren,
          isLoaded: true
        };
      }

      if (normPath.startsWith(nodePath)) {
        return {
          ...node,
          children: node.children.map(updateNode),
          isExpanded: true
        };
      }

      return node;
    };

    return updateNode(structure);
  }, []);

  // Load folder contents with stable reference
  const loadFolderContents = useCallback(async (folderPath: string) => {
    if (!share) return []; // Prevent API call if share is not available

    try {
      const contents = await loadDirectoryContents(folderPath, `/${share}`);

      setFolderStructure(prevStructure => {
        return updateFolderInTree(
            prevStructure,
            folderPath,
            contents.filter(item => item.type === 'directory').map(folder => ({
              name: folder.basename,
              path: folderPath === '/'
                  ? `/${folder.basename}`
                  : `${folderPath}/${folder.basename}`,
              children: [],
              isExpanded: false,
              isLoaded: false
            })),
            share
        );
      });

      return contents;
    } catch (err) {
      console.error('Error loading folder contents:', err);
      return [];
    }
  }, [share, loadDirectoryContents, updateFolderInTree]);

  // Toggle folder expansion with stable reference
  const toggleFolderExpansion = useCallback((path: string) => {
    setFolderStructure(prevStructure => {
      const toggleNode = (node: FolderNode): FolderNode => {
        if (node.path === path) {
          // Only load folder contents if needed and only when expanding
          const shouldLoadContents = !node.isLoaded && !node.isExpanded;

          if (shouldLoadContents) {
            // Schedule the content loading without making it a dependency
            setTimeout(() => loadFolderContents(node.path), 0);
          }

          return {
            ...node,
            isExpanded: !node.isExpanded
          };
        }

        if (path.startsWith(node.path + '/') || path === node.path) {
          return {
            ...node,
            children: node.children.map(toggleNode),
            isExpanded: true
          };
        }

        return node;
      };

      return toggleNode(prevStructure);
    });
  }, [loadFolderContents]);

  // Navigation functions with stable references
  const navigateToFolder = useCallback((folderPath: string) => {
    try {
      let newPath = folderPath;
      if (!folderPath.startsWith(`/${share}`)) {
        newPath = `/${share}/${relativePath}/${folderPath === '/' ? '' : folderPath}`;
      }
      router.push(newPath);
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [router, share]);

  const navigateUp = useCallback(() => {
    const segments = relativePath.split('/').filter(Boolean);
    const parentPath = segments.length <= 1
        ? `/${share}`
        : `/${share}/${segments.slice(0, -1).join('/')}`;
    router.push(parentPath);
  }, [router, share, relativePath]);

  // Search related functions
  const searchFiles = useCallback(async () => {
    if (!searchQuery.trim() || !share) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setIsSearching(true);
    setSearchComplete(false);
    setShowSearchResults(true);
    setSearchResults([]);

    try {
      // Cache to track already searched paths to avoid duplicate API calls
      const searchedPaths = new Set<string>();
      // For estimating total folders (will be updated during search)
      let totalFolders = 1; // Start with current folder
      let searchedCount = 0;

      const searchRecursive = async (path: string, results: FileItem[] = []): Promise<FileItem[]> => {
        // Skip if already searched this path
        if (searchedPaths.has(path)) return results;
        searchedPaths.add(path);

        // Update search progress
        searchedCount++;
        setSearchProgress(prev => ({
          currentFolder: path,
          foldersSearched: searchedCount,
          totalFolders
        }));

        const contents = await loadDirectoryContents(path, `/${share}`);

        const matches = contents.filter(item =>
            item.basename.toLowerCase().includes(searchQuery.toLowerCase())
        ).map(item => ({
          ...item,
          relativePath: path === '/' ? `/${item.basename}` : `${path}/${item.basename}`
        }));

        // Add matches to results state immediately to show progress
        if (matches.length > 0) {
          setSearchResults(prevResults => [...prevResults, ...matches]);
        }

        // Recursively search subdirectories
        const subDirs = contents.filter(item => item.type === 'directory');

        // Update total folder count estimation
        totalFolders += subDirs.length;
        setSearchProgress(prev => ({
          ...prev,
          totalFolders
        }));

        for (const dir of subDirs) {
          const dirPath = path === '/' ? `/${dir.basename}` : `${path}/${dir.basename}`;
          await searchRecursive(dirPath, results);
        }

        return results;
      };

      await searchRecursive(relativePath);
      setSearchComplete(true);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, share, relativePath, loadDirectoryContents]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    if (!e.target.value) {
      setShowSearchResults(false);
    }
  }, []);

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    searchFiles();
  }, [searchFiles]);

  // Utility functions - memoized to maintain stable references
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${sizes[i]}`;
  }, []);

  const formatDate = useCallback((dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }, []);

  const getFileIcon = useCallback((filename: string): string => {
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
  }, []);

  // Initial data loading - minimized dependencies to prevent excess fetching
  useEffect(() => {
    // Skip if share is not yet available
    if (!share) return;

    let isMounted = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        console.log(`Fetching data for share: /${share}${relativePath}`);
        const data = await getDirectoryContents(relativePath, `/${share}`);

        // Only update state if component is still mounted
        if (!isMounted) return;

        setCurrentData(data);

        // Initialize root structure if needed
        setFolderStructure(prevStructure => {
          if (prevStructure.name === '') {
            const rootFolders = data
                .filter(item => item.type === 'directory')
                .map(folder => ({
                  name: folder.basename,
                  path: `/${folder.basename}`,
                  children: [],
                  isExpanded: false,
                  isLoaded: false
                }));

            return {
              name: share,
              path: '/',
              children: rootFolders,
              isExpanded: true,
              isLoaded: true
            };
          }

          // Only update structure for the current path
          return prevStructure;
        });

        // Only expand folders in the current path if we're not at root
        if (relativePath !== '/') {
          // Process path expansion in a timeout to avoid circular dependencies
          setTimeout(() => {
            const pathSegments = relativePath.split('/').filter(Boolean);

            // Expand all parent folders in the path
            let currentPath = '';
            for (const segment of pathSegments) {
              currentPath = currentPath ? `${currentPath}/${segment}` : `/${segment}`;
              toggleFolderExpansion(currentPath);
            }
          }, 0);
        }

        setShowSearchResults(false);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        if (isMounted) {
          setError(`Failed to load directory contents: ${err.message || 'Unknown error'}`);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [share, relativePath]); // Only depend on path changes, not function references

  useEffect(() => {
    // Only run in browser environment
    if (typeof window !== 'undefined') {
      const savedViewMode = localStorage.getItem('fileExplorer.viewMode');
      if (savedViewMode === 'list' || savedViewMode === 'grid') {
        setViewMode(savedViewMode as 'list' | 'grid');
      }
    }
  }, []);

  const getFilePreview = useCallback((filename: string, path: string): React.JSX.Element => {
    const extension = filename.split('.').pop()?.toLowerCase() || '';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension);

    if (isImage) {
      // For image files, use the actual file as thumbnail
      const imgPath = `/${share}${path}/${encodeURIComponent(filename)}`;
      return (
          <img
              src={imgPath}
              alt={filename}
              style={gridStyles.thumbnail}
              onError={(e) => {
                // Fallback to icon if image fails to load
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = getEnhancedFileIcon(filename);
              }}
          />
      );
    }

    // For non-image files, use enhanced icons
    return <div dangerouslySetInnerHTML={{ __html: getEnhancedFileIcon(filename) }}></div>;
  }, [share]);

// Enhanced file icons function
  const getEnhancedFileIcon = useCallback((filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase() || '';

    // Return SVG or emoji icons based on file type
    switch (extension) {
      case 'pdf': return '<svg width="60" height="60" viewBox="0 0 24 24"><path fill="#e74c3c" d="M12 16h1v-3h-1v3zm-2.5-3h1v3h-1v-3zm5 0h1v3h-1v-3zm4.5-12h-14c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2v-12c0-1.1-.9-2-2-2zm0 14h-10l-2 2v-2h-2v-12h14v12z"/></svg>';
      case 'doc': case 'docx': return '<svg width="60" height="60" viewBox="0 0 24 24"><path fill="#2a5699" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 14h-3v-2h3v2zm0-4h-8v-2h8v2zm-6-4V4l6 6h-6z"/></svg>';
      case 'xls': case 'xlsx': case 'csv': return '<svg width="60" height="60" viewBox="0 0 24 24"><path fill="#1d6f42" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 13h-4v-1h4v1zm3-3H8v-1h8v1zm0-3H8V8h8v1z"/></svg>';
      case 'mp4': case 'mov': case 'avi': case 'webm': return '<svg width="60" height="60" viewBox="0 0 24 24"><path fill="#8e44ad" d="M4 6h16v12H4V6m15 11V7H5v10h14zM13 8l5 4-5 4V8z"/></svg>';
      case 'mp3': case 'wav': case 'ogg': case 'flac': return '<svg width="60" height="60" viewBox="0 0 24 24"><path fill="#3498db" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6zm-2 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>';
      case 'zip': case 'rar': case '7z': case 'tar': case 'gz': return '<svg width="60" height="60" viewBox="0 0 24 24"><path fill="#f39c12" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-2 16h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V8h2v2zm0-4h-2V4h2v2zm4 12h-2v-6h2v6z"/></svg>';
        // Add more file types as needed
      default: return '<svg width="60" height="60" viewBox="0 0 24 24"><path fill="#95a5a6" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>';
    }
  }, []);

  // Folder tree rendering with stable reference
  const renderFolderNode = useCallback((node: FolderNode, level = 0) => {
    const isCurrentPath = node.path === relativePath || `/${share}${relativePath}` === node.path;

    return (
        <div key={node.path} className={styles.folderTreeNode}>
          <div
              className={`${styles.folderTreeItem} ${isCurrentPath ? styles.activePath : ''}`}
              style={{ paddingLeft: `${level * 16}px` }}
          >
          <span
              className={styles.folderExpandIcon}
              onClick={() => toggleFolderExpansion(node.path)}
          >
            {node.children.length > 0 || !node.isLoaded ? (node.isExpanded ? '▾' : '▸') : '○'}
          </span>
            <span
                className={styles.folderIcon}
                onClick={() => navigateToFolder(node.path)}
            >📁</span>
            <span
                className={styles.folderName}
                onClick={() => navigateToFolder(node.path)}
            >{node.name}</span>
          </div>

          {node.isExpanded && node.children.map(child => renderFolderNode(child, level + 1))}
        </div>
    );
  }, [relativePath, share, toggleFolderExpansion, navigateToFolder]);

  // Add search-related styles
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
      backgroundColor: 'white',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      transition: 'transform 0.15s, box-shadow 0.15s',
      cursor: 'pointer',
      overflow: 'hidden',
      textAlign: 'center',
      height: '100%',
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
      wordBreak: 'break-word',
      maxWidth: '100%',
      color: '#333',
    },
    gridInfo: {
      fontSize: '0.8rem',
      color: '#6c757d',
      marginTop: '8px',
    },
    thumbnail: {
      width: '100px',
      height: '100px',
      objectFit: 'cover' as 'cover',
      borderRadius: '4px',
    }
  };

  if (loading) return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading files...</p>
      </div>
  );

  if (error) return (
      <div className={styles.errorContainer}>
        <div className={styles.errorContent}>
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={() => router.push(`/${share}`)}>Go to root</button>
        </div>
      </div>
  );

  return (
      <div className={styles.modernExplorerContainer}>
        {/* Left sidebar with folder hierarchy */}
        <div className={styles.modernSidebar}>
          <div className={styles.sidebarHeader}>
            <h3>Folders</h3>
          </div>
          <div className={styles.modernFolderTree}>
            {renderFolderNode(folderStructure)}
          </div>
        </div>

        {/* Main content area */}
        <div className={styles.modernContent}>
          <div className={styles.topBar}>
            <div className={styles.modernHeader}>
              <h1 className={styles.explorerTitle}>File Explorer</h1>
              <div className={styles.modernBreadcrumb}>
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

            <div className={styles.modernActions}>
              {relativePath !== '/' && (
                  <button className={styles.modernButton} onClick={navigateUp}>
                    ↑ Up
                  </button>
              )}

              {/* View toggle button */}
              <button
                  className={styles.modernButton}
                  onClick={() => {
                    const newViewMode = viewMode === 'list' ? 'grid' : 'list';
                    setViewMode(newViewMode);
                    localStorage.setItem('fileExplorer.viewMode', newViewMode);
                  }}
                  style={{ marginRight: '10px' }}
              >
                {viewMode === 'list' ? '📑 Grid View' : '📋 List View'}
              </button>

              <form onSubmit={handleSearchSubmit} style={searchStyles.searchForm as React.CSSProperties}>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search files..."
                    style={searchStyles.searchInput as React.CSSProperties}
                    className={styles.searchInput}
                />
                <button
                    type="submit"
                    style={searchStyles.searchButton as React.CSSProperties}
                    className={styles.searchButton}
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
                  {/* Search Results Header */}
                  <div style={searchStyles.searchResults as React.CSSProperties} className={styles.searchResults}>
                    <h3 style={searchStyles.searchText as React.CSSProperties}>Search Results for "{searchQuery}"</h3>
                    <button
                        className={styles.modernButton}
                        onClick={() => setShowSearchResults(false)}
                    >
                      Back to Files
                    </button>
                  </div>

                  {/* Search Results Header Columns */}
                  <div className={styles.modernFileHeader}>
                    <div className={styles.nameColumn}>Name</div>
                    <div style={searchStyles.locationColumn as React.CSSProperties} className={styles.locationColumn}>Location</div>
                    <div className={styles.dateColumn}>Modified</div>
                    <div className={styles.sizeColumn}>Size</div>
                  </div>

                  {/* Search Results Items */}
                  <div className={styles.modernFileItems}>
                    {searchResults.length > 0 ? (
                        searchResults.map((item) => (
                            <div key={item.filename} className={styles.fileItem}>
                              {/* Search result item rendering logic here */}
                              {/* ... */}
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
                  {/* Regular File List Header */}
                  <div className={styles.modernFileHeader}>
                    <div className={styles.nameColumn}>Name</div>
                    <div className={styles.dateColumn}>Modified</div>
                    <div className={styles.sizeColumn}>Size</div>
                  </div>

                  {/* File Items - Grid or List View */}
                  <div className={styles.modernFileItems}>
                    {viewMode === 'grid' ? (
                        <div style={gridStyles.gridContainer as React.CSSProperties}>
                          {currentData.length > 0 ? (
                              currentData.map((item) => (
                                  <div
                                      key={item.filename}
                                      style={gridStyles.gridItem as React.CSSProperties}
                                      className={styles.gridItem}
                                      onClick={() => {
                                        if (item.type === 'directory') {
                                          navigateToFolder(item.filename);
                                        } else {
                                          window.open(`/${share}${relativePath}/${encodeURIComponent(item.basename)}`, '_blank');
                                        }
                                      }}
                                      onMouseOver={(e) => {
                                        Object.assign(e.currentTarget.style, gridStyles.gridItemHover as React.CSSProperties);
                                      }}
                                      onMouseOut={(e) => {
                                        e.currentTarget.style.transform = '';
                                        e.currentTarget.style.boxShadow = '';
                                      }}
                                  >
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
                              ))
                          ) : (
                              <div className={styles.modernEmptyFolder}>
                                <div className={styles.emptyIcon}>📂</div>
                                <p>This folder is empty</p>
                              </div>
                          )}
                        </div>
                    ) : (
                        // List view rendering
                        currentData.length > 0 ? (
                            currentData.map((item) => (
                                <div key={item.filename} className={styles.fileItem}>
                                  {item.type === 'directory' ? (
                                      <div
                                          className={styles.modernFolderRow}
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
                                          className={styles.modernFileRow}
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
}