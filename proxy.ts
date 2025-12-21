import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { hasGuestAccess, requiresGuestCredentials, hasAnyPermissionForPath } from '@/lib/permissions';

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
  const session = getSessionFromRequest(request);
  
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
    
    // Guests cannot perform write operations (but admins can)
    if (session.role === 'guest' && !isAdminUser) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Guest users cannot modify files' },
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

  if (!isApiRoute && !isHome && !isAuthOrAdmin) {
    // Only enforce permissions if there is an entry (direct or
    // inherited) for this path. Otherwise, allow anonymous access
    // as before.
    const hasPermission = await hasAnyPermissionForPath(pathname);
    if (!hasPermission) {
      return NextResponse.next();
    }

    const allowed = await hasGuestAccess(pathname);

    if (!allowed) {
      // Path without guest access: require full login
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }

    // Guest access is enabled for this path; if guest credentials are
    // configured, force a credential-based guest login instead of
    // anonymous access.
    const needsGuestLogin = await requiresGuestCredentials(pathname);
    if (needsGuestLogin) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      url.searchParams.set('role', 'guest');
      url.searchParams.set('path', pathname);
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
