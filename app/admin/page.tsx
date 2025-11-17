'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import styles from '../styles/adminPermissions.module.scss';

interface PathPermission {
  path: string;
  guestAccessEnabled: boolean;
  inheritToChildren: boolean;
  guestCredentials?: {
    username: string;
    password: string;
  };
}

export default function AdminPermissionsPage() {
  const { loggedIn, isAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();
  
  const [permissions, setPermissions] = useState<PathPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [newPath, setNewPath] = useState('');
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch permissions
  useEffect(() => {
    console.log("Auth loading:", authLoading, "isAdmin:", isAdmin);
    if (!authLoading && !isAdmin) {
      router.push('/login?redirect=/admin');
      return;
    }

    if (isAdmin) {
      loadPermissions();
    }
  }, [authLoading, isAdmin, router]);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/permissions');
      const data = await response.json();
      
      if (data.success) {
        setPermissions(data.permissions);
      } else {
        setError('Failed to load permissions');
      }
    } catch (err) {
      setError('Error loading permissions');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPath = async () => {
    if (!newPath.trim()) {
      setError('Please enter a path');
      return;
    }

    const normalizedPath = newPath.startsWith('/') ? newPath : `/${newPath}`;

    const newPermission: PathPermission = {
      path: normalizedPath,
      guestAccessEnabled: false,
      inheritToChildren: false,
    };

    try {
      const response = await fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission: newPermission }),
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Added permission for ${normalizedPath}`);
        setNewPath('');
        await loadPermissions();
      } else {
        setError(data.message || 'Failed to add permission');
      }
    } catch (err) {
      setError('Error adding permission');
      console.error(err);
    }
  };

  const handleUpdatePermission = async (permission: PathPermission) => {
    try {
      const response = await fetch('/api/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permission }),
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Updated permission for ${permission.path}`);
        await loadPermissions();
      } else {
        setError(data.message || 'Failed to update permission');
      }
    } catch (err) {
      setError('Error updating permission');
      console.error(err);
    }
  };

  const handleDeletePermission = async (path: string) => {
    if (!confirm(`Delete permission for ${path}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/permissions?path=${encodeURIComponent(path)}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Deleted permission for ${path}`);
        await loadPermissions();
      } else {
        setError(data.message || 'Failed to delete permission');
      }
    } catch (err) {
      setError('Error deleting permission');
      console.error(err);
    }
  };

  const handleBulkUpdate = async (updates: Partial<Omit<PathPermission, 'path'>>) => {
    if (selectedPaths.size === 0) {
      setError('No paths selected');
      return;
    }

    try {
      const response = await fetch('/api/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paths: Array.from(selectedPaths),
          updates,
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setSuccess(`Updated ${selectedPaths.size} path(s)`);
        setSelectedPaths(new Set());
        await loadPermissions();
      } else {
        setError(data.message || 'Failed to bulk update');
      }
    } catch (err) {
      setError('Error bulk updating permissions');
      console.error(err);
    }
  };

  const togglePathSelection = (path: string) => {
    const newSelection = new Set(selectedPaths);
    if (newSelection.has(path)) {
      newSelection.delete(path);
    } else {
      newSelection.add(path);
    }
    setSelectedPaths(newSelection);
  };

  const selectAll = () => {
    setSelectedPaths(new Set(permissions.map(p => p.path)));
  };

  const clearSelection = () => {
    setSelectedPaths(new Set());
  };

  if (authLoading || loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (!loggedIn || !isAdmin) {
    return null;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Permission Management</h1>
        <button onClick={() => router.push('/')} className={styles.backButton}>
          ← Back to Files
        </button>
      </header>

      {error && (
        <div className={styles.alert} onClick={() => setError(null)}>
          ❌ {error}
        </div>
      )}

      {success && (
        <div className={styles.success} onClick={() => setSuccess(null)}>
          ✅ {success}
        </div>
      )}

      <section className={styles.addSection}>
        <h2>Add New Path</h2>
        <div className={styles.addForm}>
          <input
            type="text"
            placeholder="/share/path/to/folder"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddPath()}
            className={styles.input}
          />
          <button onClick={handleAddPath} className={styles.addButton}>
            Add Path
          </button>
        </div>
      </section>

      {selectedPaths.size > 0 && (
        <section className={styles.bulkActions}>
          <h3>{selectedPaths.size} path(s) selected</h3>
          <div className={styles.bulkButtons}>
            <button onClick={() => handleBulkUpdate({ guestAccessEnabled: true })}>
              Enable Guest Access
            </button>
            <button onClick={() => handleBulkUpdate({ guestAccessEnabled: false })}>
              Disable Guest Access
            </button>
            <button onClick={() => handleBulkUpdate({ inheritToChildren: true })}>
              Enable Inheritance
            </button>
            <button onClick={() => handleBulkUpdate({ inheritToChildren: false })}>
              Disable Inheritance
            </button>
            <button onClick={clearSelection} className={styles.clearButton}>
              Clear Selection
            </button>
          </div>
        </section>
      )}

      <section className={styles.permissionsSection}>
        <div className={styles.sectionHeader}>
          <h2>Permissions ({permissions.length})</h2>
          {permissions.length > 0 && (
            <button onClick={selectAll} className={styles.selectAllButton}>
              Select All
            </button>
          )}
        </div>

        {permissions.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No permissions configured</p>
            <p className={styles.hint}>By default, all paths are accessible. Add paths above to restrict access.</p>
          </div>
        ) : (
          <div className={styles.permissionsList}>
            {permissions.map((perm) => (
              <div
                key={perm.path}
                className={`${styles.permissionItem} ${selectedPaths.has(perm.path) ? styles.selected : ''}`}
              >
                <div className={styles.permissionHeader}>
                  <input
                    type="checkbox"
                    checked={selectedPaths.has(perm.path)}
                    onChange={() => togglePathSelection(perm.path)}
                  />
                  <h3>{perm.path}</h3>
                  <button
                    onClick={() => handleDeletePermission(perm.path)}
                    className={styles.deleteButton}
                  >
                    🗑️ Delete
                  </button>
                </div>

                <div className={styles.permissionStatus}>
                  <span className={perm.guestAccessEnabled ? styles.statusOn : styles.statusOff}>
                    Guest access: {perm.guestAccessEnabled ? 'ON' : 'OFF'}
                  </span>
                  <span className={perm.inheritToChildren ? styles.statusOn : styles.statusOff}>
                    Inheritance: {perm.inheritToChildren ? 'ON (subdirs)' : 'OFF'}
                  </span>
                </div>

                <div className={styles.permissionControls}>
                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={perm.guestAccessEnabled}
                      onChange={(e) =>
                        handleUpdatePermission({ ...perm, guestAccessEnabled: e.target.checked })
                      }
                    />
                    <span>Guest Access Enabled</span>
                  </label>

                  <label className={styles.checkbox}>
                    <input
                      type="checkbox"
                      checked={perm.inheritToChildren}
                      onChange={(e) =>
                        handleUpdatePermission({ ...perm, inheritToChildren: e.target.checked })
                      }
                    />
                    <span>Apply to Subdirectories</span>
                  </label>
                </div>

                {editingPath === perm.path ? (
                  <div className={styles.credentialsEdit}>
                    <h4>Guest Credentials</h4>
                    <input
                      type="text"
                      placeholder="Username"
                      value={perm.guestCredentials?.username || ''}
                      onChange={(e) =>
                        handleUpdatePermission({
                          ...perm,
                          guestCredentials: {
                            username: e.target.value,
                            password: perm.guestCredentials?.password || '',
                          },
                        })
                      }
                      className={styles.input}
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={perm.guestCredentials?.password || ''}
                      onChange={(e) =>
                        handleUpdatePermission({
                          ...perm,
                          guestCredentials: {
                            username: perm.guestCredentials?.username || '',
                            password: e.target.value,
                          },
                        })
                      }
                      className={styles.input}
                    />
                    <button onClick={() => setEditingPath(null)} className={styles.doneButton}>
                      Done
                    </button>
                  </div>
                ) : (
                  <div className={styles.credentialsView}>
                    {perm.guestCredentials ? (
                      <span>Guest: {perm.guestCredentials.username}</span>
                    ) : (
                      <span className={styles.noCredentials}>No guest credentials set</span>
                    )}
                    <button onClick={() => setEditingPath(perm.path)} className={styles.editButton}>
                      Edit Credentials
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
