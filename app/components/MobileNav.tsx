'use client';

import React, { useState, useEffect, useMemo } from 'react';
import styles from '../fileserver.module.scss';
import { FolderNode } from './FileExplorer/types';

interface MobileNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  breadcrumbs: { name: string; path: string }[];
  folderStructure?: FolderNode;
  onToggleFolderExpansion?: (path: string) => void;
  share?: string;
}

// Deep clone folder structure
function cloneFolderStructure(node: FolderNode): FolderNode {
  return {
    ...node,
    children: node.children.map(child => cloneFolderStructure(child))
  };
}

export default function MobileNav({ 
  currentPath, 
  onNavigate, 
  breadcrumbs,
  folderStructure,
  share
}: MobileNavProps) {
  const [menuOpen, setMenuOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mobileNavOpen');
      return saved === 'true';
    }
    return false;
  });
  const [searchQuery, setSearchQuery] = useState('');
  
  // Independent folder expansion state for mobile
  const [mobileExpandedFolders, setMobileExpandedFolders] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('mobileNavOpen', menuOpen.toString());
    }
  }, [menuOpen]);

  // Create mobile-specific folder structure with independent expansion state
  const mobileFolderStructure = useMemo(() => {
    if (!folderStructure) return undefined;
    
    const cloned = cloneFolderStructure(folderStructure);
    
    // Apply mobile expansion state
    const applyExpansion = (node: FolderNode): FolderNode => {
      node.expanded = mobileExpandedFolders.has(node.path);
      node.children = node.children.map(child => applyExpansion(child));
      return node;
    };
    
    return applyExpansion(cloned);
  }, [folderStructure, mobileExpandedFolders]);

  const toggleMobileFolderExpansion = (path: string) => {
    setMobileExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderFolderNode = (node: FolderNode, level = 0): React.JSX.Element | null => {
    const isCurrentPath = node.path === currentPath || `/${share}${currentPath}` === node.path;

    // Filter based on search
    if (searchQuery && !node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      const hasMatchingChild = node.children.some(child => 
        child.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (!hasMatchingChild) return null;
    }
    
    const hasChildren = node.children.length > 0 || !node.isLoaded;
    
    return (
      <div key={node.path} className={styles.mobilefolderTreeNode}>
        <div
          className={`${styles.mobileFolderTreeItem} ${isCurrentPath ? styles.mobileActivePath : ''}`}
          style={{ paddingLeft: `${level * 12 + 8}px` }}
        >
          <span
            className={styles.mobileFolderExpander}
            onClick={(e) => {
              e.stopPropagation();
              toggleMobileFolderExpansion(node.path);
            }}
          >
            {hasChildren ? (node.expanded ? '▾' : '▸') : '•'}
          </span>
          <span 
            className={styles.mobileFolderName}
            onClick={() => {
              onNavigate(node.path);
            }}
          >
            📁 {node.name}
          </span>
        </div>
        {node.expanded && node.children.length > 0 && (
          <div className={styles.mobileFolderChildren}>
            {node.children.map(child => renderFolderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.mobileNav}>
      <button
        className={`${styles.mobileMenuButton} ${menuOpen ? styles.active : ''}`}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <span>{menuOpen ? '▼' : '▶'} {breadcrumbs[breadcrumbs.length - 1]?.name || 'Files'}</span>
      </button>

      {menuOpen && (
        <div className={styles.mobileBreadcrumbMenu}>
          <div className={styles.mobileSearchSection}>
            <div className={styles.mobileSearchBar}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className={styles.mobileSearchIcon}>
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
              <input
                type="text"
                placeholder="Search folders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.mobileSearchInput}
              />
              {searchQuery && (
                <button
                  className={styles.mobileClearSearch}
                  onClick={() => setSearchQuery('')}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className={styles.mobileBreadcrumbs}>
            <div className={styles.mobileBreadcrumbHeader}>Current Path:</div>
            {breadcrumbs.map((crumb, idx) => (
              <div
                key={idx}
                className={styles.mobileBreadcrumbItem}
                onClick={() => {
                  onNavigate(crumb.path);
                }}
              >
                {idx > 0 && <span className={styles.mobileIndent}>{'└─ '}</span>}
                {crumb.name}
              </div>
            ))}
          </div>

          {folderStructure && (
            <div className={styles.mobileFolderTree}>
              <div className={styles.mobileFolderTreeHeader}>
                <span>All Folders</span>
                {searchQuery && <span className={styles.mobileSearchResultBadge}>Filtered</span>}
              </div>
              <div className={styles.mobileFolderTreeContent}>
                {mobileFolderStructure?.name ? (
                  renderFolderNode(mobileFolderStructure)
                ) : (
                  <div className={styles.mobileEmptyFolderTree}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                      <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
                    </svg>
                    <p>No folders found</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}