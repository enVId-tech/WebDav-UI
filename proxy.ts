import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { hasAnonymousAccess, requiresUserLogin, hasAnyPermissionForPath } from '@/lib/permissions';

// Define public routes that don't require authentication
const publicRoutes = ['/login', '/api/auth/login', '/api/auth/status'];

// Define API routes that require authentication (write operations)
const writeApiRoutes = ['/api/webdav/upload', '/api/webdav/delete', '/api/webdav/text-save'];

// Admin-only routes are now enforced in their respective
// route handlers/pages. Middleware no longer special-cases them
// to avoid inconsistencies across runtimes.
const adminRoutes: string[] = [];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }
  
  // Check for session
  const session: any = getSessionFromRequest(request);
  
  // No special handling for admin routes here; authorization is
  // performed inside the actual API routes and pages.
  
  // Check if this is a write operation API route
  const isWriteApi = writeApiRoutes.some(route => pathname.startsWith(route));
  
  // Write operations require authentication
  if (isWriteApi) {
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please log in to upload or delete files' },
        { status: 401 }
      );
    }
    
    // Check if user is admin (by role or username)
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const isAdminUser = session.role === 'admin' || session.username === adminUsername;
    
    // Users with restricted permissions cannot perform write operations (but admins can)
    if (session.role === 'guest' && !isAdminUser) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Insufficient permissions to modify files' },
        { status: 403 }
      );
    }
    
    return NextResponse.next();
  }
  
  // For read operations and page routes
  // If user is logged in (admin or guest), allow access
  if (session) {
    return NextResponse.next();
  }
  
  // User is not logged in
  // Treat all top-level non-auth, non-admin, non-home page routes
  // (e.g. /documents, /media) as potential shares with permissions.

  const isApiRoute = pathname.startsWith('/api/');
  const isHome = pathname === '/';
  const isAuthOrAdmin = pathname.startsWith('/login') || pathname.startsWith('/admin');
  
  // Special handling for preview API - should follow same rules as page routes
  const isPreviewApi = pathname.startsWith('/api/preview/');
  
  // Also handle preview page routes
  const isPreviewPage = pathname.startsWith('/preview/');

  if ((!isApiRoute || isPreviewApi) && !isHome && !isAuthOrAdmin) {
    // Check if user is admin (logged in sessions were already handled above)
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const isAdminUser = session ? (session.role === 'admin' || session.username === adminUsername) : false;
    
    // For preview API or page, extract the actual path from the URL
    // e.g., /api/preview/etran/folder/file.mp4 -> /etran/folder
    // e.g., /preview/etran/folder/file.mp4 -> /etran/folder
    let checkPath = pathname;
    if (isPreviewApi) {
      // Remove /api/preview prefix
      const filePath = pathname.replace('/api/preview/', '/');
      // Get parent directory
      const segments = filePath.split('/').filter(Boolean);
      const parentSegments = segments.slice(0, -1);
      checkPath = parentSegments.length > 0 ? `/${parentSegments.join('/')}` : '/';
    } else if (isPreviewPage) {
      // Remove /preview prefix
      const filePath = pathname.replace('/preview/', '/');
      // Get parent directory
      const segments = filePath.split('/').filter(Boolean);
      const parentSegments = segments.slice(0, -1);
      checkPath = parentSegments.length > 0 ? `/${parentSegments.join('/')}` : '/';
    }
    
    // Only enforce permissions if there is an entry (direct or
    // inherited) for this path. Otherwise, allow anonymous access
    // as before.
    const hasPermission = await hasAnyPermissionForPath(checkPath, isAdminUser);
    if (!hasPermission) {
      return NextResponse.next();
    }

    const allowed = await hasAnonymousAccess(checkPath, isAdminUser);

    if (!allowed) {
      // Path without anonymous access: require full login
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', (isPreviewApi || isPreviewPage) ? checkPath : pathname);
      return NextResponse.redirect(url);
    }

    // Anonymous access is enabled for this path; if user credentials are
    // configured, require user login instead of allowing anonymous access.
    const needsUserLogin = await requiresUserLogin(checkPath, isAdminUser);
    if (needsUserLogin) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', (isPreviewApi || isPreviewPage) ? checkPath : pathname);
      url.searchParams.set('role', 'guest');
      url.searchParams.set('path', (isPreviewApi || isPreviewPage) ? checkPath : pathname);
      return NextResponse.redirect(url);
    }
  }

  // For all other unauthenticated routes, allow anonymous access
  return NextResponse.next();
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
