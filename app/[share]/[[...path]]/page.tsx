'use client';

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getDirectoryContents } from '@/lib/webdav-client';
import { FileItem, FolderNode } from '@/app/components/FileExplorer/types';
import FileExplorerUI from '@/app/components/FileExplorer/FileExplorerUI';
import FileOperationStatus, { OperationStatus } from '@/app/components/FileOperationStatus';

export default function ShareFileBrowser() {
  const router = useRouter();
  const params = useParams();
  const [currentData, setCurrentData] = useState<FileItem[]>([]);
  const [loadingState, setLoadingState] = useState<'active' | 'fading' | 'hidden'>('active');
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
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  
  // AbortController ref to cancel ongoing searches
  const searchAbortControllerRef = useRef<AbortController | null>(null);

  // Operation status tracking
  const [operations, setOperations] = useState<OperationStatus[]>([]);

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

        // Check if the target path is a descendant of the current node
        const isDescendant = node.path === '/' 
          ? path !== '/' 
          : path.startsWith(node.path + '/');

        if (isDescendant) {
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
      // Adjusted to ensure correct path construction when navigating from root of share
      if (!folderPath.startsWith(`/${share}`)) {
        const currentBasePath = relativePath === '/' ? '' : relativePath;
        newPath = `/${share}${currentBasePath}/${folderPath}`.replace(/\/\//g, '/');
      }
      router.push(newPath);
    } catch (error) {
      console.error('Navigation error:', error);
    }
  }, [router, share, relativePath]);

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

    // Cancel any ongoing search before starting a new one
    if (searchAbortControllerRef.current) {
      searchAbortControllerRef.current.abort();
    }

    // Create a new AbortController for this search
    const abortController = new AbortController();
    searchAbortControllerRef.current = abortController;

    setIsSearching(true);
    setShowSearchResults(true);
    setSearchResults([]);

    try {
      // Cache to track already searched paths to avoid duplicate API calls
      const searchedPaths = new Set<string>();
      // For estimating total folders (will be updated during search)
      let totalFolders = 1; // Start with current folder
      let searchedCount = 0;

      const searchRecursive = async (path: string, results: FileItem[] = []): Promise<FileItem[]> => {
        // Check if search was aborted
        if (abortController.signal.aborted) {
          throw new Error('Search aborted');
        }

        // Skip if already searched this path
        if (searchedPaths.has(path)) return results;
        searchedPaths.add(path);

        // Update search progress
        searchedCount++;

        const contents = await loadDirectoryContents(path, `/${share}`);

        // Check again after async operation
        if (abortController.signal.aborted) {
          throw new Error('Search aborted');
        }

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

        for (const dir of subDirs) {
          // Check if search was aborted before processing each subdirectory
          if (abortController.signal.aborted) {
            throw new Error('Search aborted');
          }

          const dirPath = path === '/' ? `/${dir.basename}` : `${path}/${dir.basename}`;
          await searchRecursive(dirPath, results);
        }

        return results;
      };

      await searchRecursive(relativePath);
    } catch (err: any) {
      // Don't log error if search was intentionally aborted
      if (err.message !== 'Search aborted') {
        console.error('Search error:', err);
      }
    } finally {
      // Only set isSearching to false if this is still the current search
      if (searchAbortControllerRef.current === abortController) {
        setIsSearching(false);
        searchAbortControllerRef.current = null;
      }
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

  const handleFileClick = useCallback((fileName: string) => {
    try {
      // Get full path relative to current location
      const filePath = relativePath === '/'
          ? `/${fileName}`
          : `${relativePath}/${fileName}`;

      // Instead of downloading, navigate to a preview page
      const previewUrl = `/preview/${share}${filePath}`.replace(/\/\//g, '/');
      window.open(previewUrl, '_blank');
    } catch (error) {
      console.error('Error opening file preview:', error);
    }
  }, [relativePath, share]);

  const handleUploadFile = useCallback(async (file: File) => {
    if (!share || !relativePath) return;
    
    const operationId = `${file.name}-${Date.now()}`;
    const startTime = Date.now();
    
    // Add operation to tracking
    setOperations(prev => [...prev, {
      type: 'upload',
      fileName: file.name,
      status: 'processing',
      progress: 0,
      startTime
    }]);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('path', relativePath);
      formData.append('sharePath', `/${share}`);

      // Simulate progress for better UX (actual progress requires XMLHttpRequest or custom streaming)
      const progressInterval = setInterval(() => {
        setOperations(prev => prev.map(op => 
          op.fileName === file.name && op.status === 'processing'
            ? { ...op, progress: Math.min((op.progress || 0) + 10, 90) }
            : op
        ));
      }, 200);

      const response = await fetch('/api/webdav/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.userMessage || result.error || 'Failed to upload file');
      }

      // Update operation status to success with details
      setOperations(prev => prev.map(op => 
        op.fileName === file.name
          ? { 
              ...op, 
              status: 'success', 
              progress: 100,
              speed: result.details?.uploadSpeedMBps ? `${result.details.uploadSpeedMBps} MB/s` : undefined
            }
          : op
      ));

      // Refresh directory contents after upload
      const data = await getDirectoryContents(relativePath, `/${share}`);
      setCurrentData(data);

      // Auto-clear successful operations after 5 seconds
      setTimeout(() => {
        setOperations(prev => prev.filter(op => op.fileName !== file.name));
      }, 5000);

    } catch (err: any) {
      console.error('Error uploading file:', err);
      
      // Update operation status to error
      setOperations(prev => prev.map(op => 
        op.fileName === file.name
          ? { ...op, status: 'error', error: err.message || 'Upload failed' }
          : op
      ));

      // Keep error visible longer
      setTimeout(() => {
        setOperations(prev => prev.filter(op => op.fileName !== file.name));
      }, 10000);
    }
  }, [share, relativePath, setCurrentData]);

  const handleDeleteFiles = useCallback(async (fileNames: string[]) => {
    if (!share || !relativePath || fileNames.length === 0) return;

    if (!confirm(`Delete ${fileNames.length} item(s)?`)) {
      return;
    }

    const startTime = Date.now();

    // Add all files to operation tracking
    const newOperations: OperationStatus[] = fileNames.map(fileName => ({
      type: 'delete',
      fileName,
      status: 'processing',
      startTime
    }));
    setOperations(prev => [...prev, ...newOperations]);

    try {
      // Optimistic UI update: remove files locally first
      setCurrentData(prev => prev.filter(item => !fileNames.includes(item.basename)));

      // Build paths for batch delete
      const filePaths = fileNames.map(fileName => 
        relativePath === '/' ? `/${fileName}` : `${relativePath}/${fileName}`
      );

      // Use batch delete API with 'paths' parameter
      const response = await fetch('/api/webdav/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paths: filePaths,
          sharePath: `/${share}`,
        }),
      });

      const result = await response.json();

      if (result.success || response.status === 207) {
        // Update operation statuses based on individual results
        if (result.details?.results) {
          result.details.results.forEach((fileResult: any) => {
            setOperations(prev => prev.map(op => 
              op.fileName === fileResult.fileName
                ? {
                    ...op,
                    status: fileResult.success ? 'success' : 'error',
                    error: fileResult.error
                  }
                : op
            ));
          });
        } else {
          // Mark all as successful
          setOperations(prev => prev.map(op => 
            fileNames.includes(op.fileName)
              ? { ...op, status: 'success' }
              : op
          ));
        }

        // Auto-clear successful operations after 5 seconds
        setTimeout(() => {
          setOperations(prev => prev.filter(op => !fileNames.includes(op.fileName) || op.status === 'error'));
        }, 5000);

      } else {
        throw new Error(result.userMessage || result.error || 'Failed to delete files');
      }

      // Refresh directory contents
      const data = await getDirectoryContents(relativePath, `/${share}`);
      setCurrentData(data);

    } catch (err: any) {
      console.error('Error deleting files:', err);
      
      // Update all operations to error status
      setOperations(prev => prev.map(op => 
        fileNames.includes(op.fileName)
          ? { ...op, status: 'error', error: err.message || 'Delete failed' }
          : op
      ));

      // Re-fetch to restore UI
      const data = await getDirectoryContents(relativePath, `/${share}`);
      setCurrentData(data);

      // Keep errors visible longer
      setTimeout(() => {
        setOperations(prev => prev.filter(op => !fileNames.includes(op.fileName)));
      }, 10000);
    }
  }, [share, relativePath, setCurrentData]);

  // Initial data loading - minimized dependencies to prevent excess fetching
  useEffect(() => {
    // Skip if share is not yet available
    if (!share) return;

    let isMounted = true;
    const fetchData = async () => {
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
          setLoadingState('fading');
          setTimeout(() => setLoadingState('hidden'), 500); // Adjust the timeout as needed
        }
      }
    };

    fetchData();

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
  }, [share, relativePath, toggleFolderExpansion]); // Only depend on path changes, not function references

  useEffect(() => {
    // Only run in browser environment
    if (typeof window !== 'undefined') {
      const savedViewMode = localStorage.getItem('fileExplorer.viewMode');
      if (savedViewMode === 'list' || savedViewMode === 'grid') {
        setViewMode(savedViewMode as 'list' | 'grid');
      }
    }
  }, []);

  return (
    <>
      <FileExplorerUI
        loadingState={loadingState}
        error={error}
        folderStructure={folderStructure}
        share={share}
        relativePath={relativePath}
        breadcrumbs={breadcrumbs}
        currentData={currentData}
        viewMode={viewMode}
        searchQuery={searchQuery}
        searchResults={searchResults}
        isSearching={isSearching}
        showSearchResults={showSearchResults}
        routerPush={(path) => router.push(path)}
        onNavigateUp={navigateUp}
        onToggleViewMode={() => {
          const newViewMode = viewMode === 'list' ? 'grid' : 'list';
          setViewMode(newViewMode);
          localStorage.setItem('fileExplorer.viewMode', newViewMode);
        }}
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
        onSetShowSearchResults={setShowSearchResults}
        onNavigateToFolder={navigateToFolder}
        onFileClick={handleFileClick}
        onToggleFolderExpansion={toggleFolderExpansion}
        onUploadFile={handleUploadFile}
        onDeleteFiles={handleDeleteFiles}
      />
      <FileOperationStatus 
        operations={operations} 
        onClose={() => setOperations([])} 
      />
    </>
  );
}

