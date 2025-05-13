'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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
              <form onSubmit={handleSearchSubmit} style={searchStyles.searchForm}>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    placeholder="Search files..."
                    style={searchStyles.searchInput}
                    className={styles.searchInput}
                />
                <button
                    type="submit"
                    style={searchStyles.searchButton}
                    className={styles.searchButton}
                    disabled={isSearching}
                >
                  {isSearching ? '🔍...' : '🔍'}
                </button>
              </form>
            </div>
          </div>

          {showSearchResults ? (
              <div className={styles.modernFileList}>
                <div style={searchStyles.searchResults} className={styles.searchResults}>
                  <h3 style={searchStyles.searchText}>Search Results for "{searchQuery}"</h3>
                  <button
                      className={styles.modernButton}
                      onClick={() => setShowSearchResults(false)}
                  >
                    Back to Files
                  </button>
                </div>

                <div className={styles.modernFileHeader}>
                  <div className={styles.nameColumn}>Name</div>
                  <div style={searchStyles.locationColumn} className={styles.locationColumn}>Location</div>
                  <div className={styles.dateColumn}>Modified</div>
                  <div className={styles.sizeColumn}>Size</div>
                </div>

                <div className={styles.modernFileItems}>
                  {searchResults.length > 0 ? (
                      searchResults.map((item) => (
                          <div key={item.filename} className={styles.fileItem}>
                            {item.type === 'directory' ? (
                                <div
                                    className={styles.modernFolderRow}
                                    onClick={() => navigateToFolder(item.relativePath!)}
                                >
                                  <div className={styles.nameColumn}>
                                    <span className={styles.icon}>📁</span>
                                    <span className={styles.name}>{item.basename}</span>
                                  </div>
                                  <div style={searchStyles.locationColumn} className={styles.locationColumn}>
                                    {item.relativePath || '/'}
                                  </div>
                                  <div className={styles.dateColumn}>
                                    {formatDate(item.lastmod)}
                                  </div>
                                  <div className={styles.sizeColumn}>-</div>
                                </div>
                            ) : (
                                <a
                                    href={`/${share}${item.relativePath}`}
                                    className={styles.modernFileRow}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                  <div className={styles.nameColumn}>
                                    <span className={styles.icon}>{getFileIcon(item.basename)}</span>
                                    <span className={styles.name}>{item.basename}</span>
                                  </div>
                                  <div style={searchStyles.locationColumn} className={styles.locationColumn}>
                                    {item.relativePath || '/'}
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
                        <div className={styles.emptyIcon}>🔍</div>
                        {isSearching ? (
                            <>
                              <p>Searching for "{searchQuery}"...</p>
                              <div className={styles.searchProgressInfo}>
                                <p>Currently searching: {searchProgress.currentFolder || '/'}</p>
                                <p>Folders searched: {searchProgress.foldersSearched} of {searchProgress.totalFolders} (estimated)</p>
                                <div className={styles.progressBar}>
                                  <div
                                      className={styles.progressFill}
                                      style={{
                                        width: `${Math.min(100, Math.round((searchProgress.foldersSearched / Math.max(1, searchProgress.totalFolders)) * 100))}%`
                                      }}
                                  ></div>
                                </div>
                              </div>
                            </>
                        ) : searchComplete ? (
                            <p>No results found for "{searchQuery}"</p>
                        ) : (
                            <p>Enter a search term and click the search button</p>
                        )}
                      </div>
                  )}
                </div>
              </div>
          ) : (
              <div className={styles.modernFileList}>
                <div className={styles.modernFileHeader}>
                  <div className={styles.nameColumn}>Name</div>
                  <div className={styles.dateColumn}>Modified</div>
                  <div className={styles.sizeColumn}>Size</div>
                </div>

                <div className={styles.modernFileItems}>
                  {currentData.length > 0 ? (
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
                  )}
                </div>
              </div>
          )}
        </div>
      </div>
  );
}