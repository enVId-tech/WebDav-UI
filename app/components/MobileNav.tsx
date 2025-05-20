'use client';

import React, { useState } from 'react';
import styles from '../fileserver.module.scss';

interface MobileNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  breadcrumbs: { name: string; path: string }[];
}

export default function MobileNav({ currentPath, onNavigate, breadcrumbs }: MobileNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className={styles.mobileNav}>
      <button
        className={styles.mobileMenuButton}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {menuOpen ? '✕' : '☰'} {breadcrumbs[breadcrumbs.length - 1]?.name || 'Files'}
      </button>

      {menuOpen && (
        <div className={styles.mobileBreadcrumbMenu}>
          {breadcrumbs.map((crumb, idx) => (
            <div
              key={idx}
              className={styles.mobileBreadcrumbItem}
              onClick={() => {
                onNavigate(crumb.path);
                setMenuOpen(false);
              }}
            >
              {idx > 0 && <span className={styles.mobileIndent}>{'└─ '}</span>}
              {crumb.name}
            </div>
          ))}
          <button
            className={styles.mobileCloseMenu}
            onClick={() => setMenuOpen(false)}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}