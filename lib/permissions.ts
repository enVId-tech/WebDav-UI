/**
 * Permissions Management System
 * 
 * This module handles per-directory guest access permissions and credentials.
 * Permissions are stored in a JSON file and cached in memory for performance.
 */

import fs from 'fs/promises';
import path from 'path';

export interface GuestCredentials {
  username: string;
  password: string;
}

export interface PathPermission {
  path: string; // WebDAV path like "/share/folder"
  guestAccessEnabled: boolean;
  guestCredentials?: GuestCredentials; // Optional guest-specific credentials
  inheritToChildren: boolean; // Whether subdirectories inherit this permission
}

export interface PermissionsStore {
  version: string;
  lastModified: string;
  permissions: PathPermission[];
}

const PERMISSIONS_FILE = path.join(process.cwd(), 'data', 'permissions.json');

// In-memory cache
let permissionsCache: PermissionsStore | null = null;
let lastLoadTime: number = 0;
const CACHE_TTL = 5000; // 5 seconds

/**
 * Initialize the permissions file if it doesn't exist
 */
async function initializePermissionsFile(): Promise<void> {
  try {
    await fs.access(PERMISSIONS_FILE);
  } catch {
    // File doesn't exist, create it
    const dataDir = path.dirname(PERMISSIONS_FILE);
    await fs.mkdir(dataDir, { recursive: true });
    
    const initialStore: PermissionsStore = {
      version: '1.0',
      lastModified: new Date().toISOString(),
      permissions: []
    };
    
    await fs.writeFile(PERMISSIONS_FILE, JSON.stringify(initialStore, null, 2), 'utf-8');
  }
}

/**
 * Load permissions from file with caching
 */
export async function loadPermissions(): Promise<PermissionsStore> {
  const now = Date.now();
  
  // Return cached version if still valid
  if (permissionsCache && (now - lastLoadTime) < CACHE_TTL) {
    return permissionsCache;
  }
  
  await initializePermissionsFile();
  
  const content = await fs.readFile(PERMISSIONS_FILE, 'utf-8');
  permissionsCache = JSON.parse(content);
  lastLoadTime = now;
  
  return permissionsCache!;
}

/**
 * Save permissions to file and update cache
 */
export async function savePermissions(store: PermissionsStore): Promise<void> {
  store.lastModified = new Date().toISOString();
  await fs.writeFile(PERMISSIONS_FILE, JSON.stringify(store, null, 2), 'utf-8');
  
  // Update cache
  permissionsCache = store;
  lastLoadTime = Date.now();
}

/**
 * Check if a path has guest access enabled
 * Checks the path itself and parent paths with inheritToChildren
 */
export async function hasGuestAccess(requestPath: string): Promise<boolean> {
  const store = await loadPermissions();
  
  // Normalize path
  const normalizedPath = requestPath.startsWith('/') ? requestPath : `/${requestPath}`;
  
  // Check exact match first
  const exactMatch = store.permissions.find(p => p.path === normalizedPath);
  if (exactMatch) {
    return exactMatch.guestAccessEnabled;
  }
  
  // Check parent paths with inheritToChildren enabled
  const pathParts = normalizedPath.split('/').filter(Boolean);
  
  for (let i = pathParts.length - 1; i >= 0; i--) {
    const parentPath = '/' + pathParts.slice(0, i).join('/');
    const parentPermission = store.permissions.find(p => p.path === parentPath);
    
    if (parentPermission && parentPermission.inheritToChildren) {
      return parentPermission.guestAccessEnabled;
    }
  }
  
  // Check root path
  const rootPermission = store.permissions.find(p => p.path === '/');
  if (rootPermission && rootPermission.inheritToChildren) {
    return rootPermission.guestAccessEnabled;
  }
  
  // Default: no guest access
  return false;
}

/**
 * Get guest credentials for a specific path
 * Returns the most specific credentials (checks path and parents)
 */
export async function getGuestCredentials(requestPath: string): Promise<GuestCredentials | null> {
  const store = await loadPermissions();
  
  const normalizedPath = requestPath.startsWith('/') ? requestPath : `/${requestPath}`;
  
  // Check exact match first
  const exactMatch = store.permissions.find(p => p.path === normalizedPath);
  if (exactMatch?.guestCredentials) {
    return exactMatch.guestCredentials;
  }
  
  // Check parent paths
  const pathParts = normalizedPath.split('/').filter(Boolean);
  
  for (let i = pathParts.length - 1; i >= 0; i--) {
    const parentPath = '/' + pathParts.slice(0, i).join('/');
    const parentPermission = store.permissions.find(p => p.path === parentPath);
    
    if (parentPermission?.guestCredentials) {
      return parentPermission.guestCredentials;
    }
  }
  
  return null;
}

/**
 * Check if a path requires guest credentials (i.e. has guest credentials
 * configured either on the exact path or an inheritable parent).
 */
export async function requiresGuestCredentials(requestPath: string): Promise<boolean> {
  const creds = await getGuestCredentials(requestPath);
  return !!creds;
}

/**
 * Check if any permission applies to a given path, either directly
 * or via an inheritable parent entry. This is used to decide whether
 * middleware should enforce login/guest access or allow anonymous
 * access for paths with no permissions configured.
 */
export async function hasAnyPermissionForPath(requestPath: string): Promise<boolean> {
  const store = await loadPermissions();

  const normalizedPath = requestPath.startsWith('/') ? requestPath : `/${requestPath}`;

  // Exact match
  if (store.permissions.some(p => p.path === normalizedPath)) {
    return true;
  }

  // Check parent paths with inheritance enabled
  const pathParts = normalizedPath.split('/').filter(Boolean);

  for (let i = pathParts.length - 1; i >= 0; i--) {
    const parentPath = '/' + pathParts.slice(0, i).join('/');
    const parentPermission = store.permissions.find(p => p.path === parentPath);

    if (parentPermission && parentPermission.inheritToChildren) {
      return true;
    }
  }

  // Root-level permission with inheritance
  const rootPermission = store.permissions.find(p => p.path === '/');
  if (rootPermission && rootPermission.inheritToChildren) {
    return true;
  }

  return false;
}

/**
 * Set permission for a specific path
 */
export async function setPathPermission(permission: PathPermission): Promise<void> {
  const store = await loadPermissions();
  
  // Remove existing permission for this path
  store.permissions = store.permissions.filter(p => p.path !== permission.path);
  
  // Add new permission
  store.permissions.push(permission);
  
  await savePermissions(store);
}

/**
 * Remove permission for a specific path
 */
export async function removePathPermission(pathToRemove: string): Promise<void> {
  const store = await loadPermissions();
  store.permissions = store.permissions.filter(p => p.path !== pathToRemove);
  await savePermissions(store);
}

/**
 * Get all permissions
 */
export async function getAllPermissions(): Promise<PathPermission[]> {
  const store = await loadPermissions();
  return store.permissions;
}

/**
 * Bulk update permissions for multiple paths
 */
export async function bulkUpdatePermissions(
  paths: string[],
  updates: Partial<Omit<PathPermission, 'path'>>
): Promise<void> {
  const store = await loadPermissions();
  
  for (const path of paths) {
    const existingIndex = store.permissions.findIndex(p => p.path === path);
    
    if (existingIndex >= 0) {
      // Update existing
      store.permissions[existingIndex] = {
        ...store.permissions[existingIndex],
        ...updates
      };
    } else {
      // Create new
      store.permissions.push({
        path,
        guestAccessEnabled: updates.guestAccessEnabled ?? false,
        inheritToChildren: updates.inheritToChildren ?? false,
        guestCredentials: updates.guestCredentials
      });
    }
  }
  
  await savePermissions(store);
}

/**
 * Clear cache (useful for testing or after direct file modifications)
 */
export function clearCache(): void {
  permissionsCache = null;
  lastLoadTime = 0;
}
