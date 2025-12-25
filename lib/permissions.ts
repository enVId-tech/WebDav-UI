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
  permissionLevel?: number; // 0 = lowest (most restricted), 100 = highest (most permissive)
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
 * Validate permission to ensure no conflicts with existing permissions
 * - No duplicate credentials on the same path
 * - Nested paths with lower permission level than parent are invalid
 * - Nested paths with credentials must have equal or higher permission level
 */
export function validatePermission(
  newPermission: PathPermission,
  existingPermissions: PathPermission[]
): { valid: boolean; error?: string } {
  const newPath = newPermission.path;
  const newLevel = newPermission.permissionLevel ?? 50; // Default to mid-level
  const hasNewCredentials = !!newPermission.guestCredentials?.username;

  // Filter out the permission being updated from existing permissions
  const otherPermissions = existingPermissions.filter(p => p.path !== newPath);

  // Check for duplicate credentials on the same path (only check other paths)
  // Note: We've already filtered out the current path, so this only catches actual duplicates

  // Check parent paths for permission level conflicts
  for (const existing of otherPermissions) {

    const existingLevel = existing.permissionLevel ?? 50;
    const hasExistingCredentials = !!existing.guestCredentials?.username;

    // Check if newPath is a child of existing path
    if (newPath.startsWith(existing.path + '/') || 
        (existing.path === '/' && newPath !== '/')) {
      
      // If child has credentials, it must have equal or higher permission level
      if (hasNewCredentials) {
        if (newLevel < existingLevel) {
          return {
            valid: false,
            error: `Cannot set credentials on nested path with lower permission level (${newLevel}) than parent path ${existing.path} (${existingLevel}). Child paths with credentials must have equal or higher permission levels.`
          };
        }
      }
    }

    // Check if existing path is a child of new path
    if (existing.path.startsWith(newPath + '/') || 
        (newPath === '/' && existing.path !== '/')) {
      
      // If parent has credentials and child has lower level, warn
      if (hasNewCredentials && hasExistingCredentials && existingLevel < newLevel) {
        return {
          valid: false,
          error: `Cannot set credentials on parent path: child path ${existing.path} has lower permission level (${existingLevel}). This would prevent access to subdirectories.`
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Check if a path has guest access enabled
 * Checks the path itself and parent paths with inheritToChildren
 * Path-specific permissions OVERRIDE inherited permissions from parent paths
 * @param requestPath - The path to check
 * @param isAdmin - If true, bypasses all permission checks and grants access
 */
export async function hasGuestAccess(requestPath: string, isAdmin: boolean = false): Promise<boolean> {
  // Admin users have full access to everything
  if (isAdmin) {
    return true;
  }
  
  const store = await loadPermissions();
  
  // Normalize path
  const normalizedPath = requestPath.startsWith('/') ? requestPath : `/${requestPath}`;
  
  // Check exact match first - this ALWAYS takes precedence over inherited permissions
  const exactMatch = store.permissions.find(p => p.path === normalizedPath);
  if (exactMatch) {
    return exactMatch.guestAccessEnabled;
  }
  
  // Only check parent paths if no exact match exists
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
 * Path-specific credentials OVERRIDE inherited credentials from parent paths
 */
export async function getGuestCredentials(requestPath: string): Promise<GuestCredentials | null> {
  const store = await loadPermissions();
  
  const normalizedPath = requestPath.startsWith('/') ? requestPath : `/${requestPath}`;
  
  // Check exact match first - this ALWAYS takes precedence
  const exactMatch = store.permissions.find(p => p.path === normalizedPath);
  if (exactMatch) {
    // If exact match exists, return its credentials (even if undefined/null)
    // This allows a specific path to override inherited credentials by not having any
    return exactMatch.guestCredentials || null;
  }
  
  // Only check parent paths if no exact match exists
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
 * @param requestPath - The path to check
 * @param isAdmin - If true, bypasses credential requirements
 */
export async function requiresGuestCredentials(requestPath: string, isAdmin: boolean = false): Promise<boolean> {
  // Admin users don't need guest credentials
  if (isAdmin) {
    return false;
  }
  
  const creds = await getGuestCredentials(requestPath);
  return !!creds;
}

/**
 * Check if any permission applies to a given path, either directly
 * or via an inheritable parent entry. This is used to decide whether
 * middleware should enforce login/guest access or allow anonymous
 * access for paths with no permissions configured.
 * @param requestPath - The path to check
 * @param isAdmin - If true, bypasses permission checks
 */
export async function hasAnyPermissionForPath(requestPath: string, isAdmin: boolean = false): Promise<boolean> {
  // Admin users have full access - no permission checks needed
  if (isAdmin) {
    return true;
  }
  
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
 * Prevents duplicate entries by removing any existing permission for the same path first
 */
export async function setPathPermission(permission: PathPermission): Promise<void> {
  const store = await loadPermissions();
  
  // Normalize the path to prevent duplicates with different formats
  const normalizedPath = permission.path.startsWith('/') ? permission.path : `/${permission.path}`;
  
  // Remove ALL existing permissions for this exact path (prevents duplicates)
  store.permissions = store.permissions.filter(p => p.path !== normalizedPath);
  
  // Add new permission with normalized path
  store.permissions.push({
    ...permission,
    path: normalizedPath
  });
  
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
 * Prevents duplicate entries by normalizing paths and checking for existing entries
 */
export async function bulkUpdatePermissions(
  paths: string[],
  updates: Partial<Omit<PathPermission, 'path'>>
): Promise<void> {
  const store = await loadPermissions();
  
  // Track processed paths to prevent duplicates within the same bulk update
  const processedPaths = new Set<string>();
  
  for (const path of paths) {
    // Normalize the path
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    // Skip if we've already processed this path in this bulk update
    if (processedPaths.has(normalizedPath)) {
      continue;
    }
    processedPaths.add(normalizedPath);
    
    const existingIndex = store.permissions.findIndex(p => p.path === normalizedPath);
    
    if (existingIndex >= 0) {
      // Update existing
      store.permissions[existingIndex] = {
        ...store.permissions[existingIndex],
        ...updates,
        path: normalizedPath // Ensure path stays normalized
      };
    } else {
      // Create new
      store.permissions.push({
        path: normalizedPath,
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
