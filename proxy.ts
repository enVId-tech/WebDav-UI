import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { hasGuestAccess } from '@/lib/permissions';

// Define public routes that don't require authentication
const publicRoutes = ['/login', '/api/auth/login', '/api/auth/status'];

// Define API routes that require authentication (write operations)
const writeApiRoutes = ['/api/webdav/upload', '/api/webdav/delete', '/api/webdav/text-save'];

// Admin-only routes
const adminRoutes = ['/admin', '/api/permissions'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }
  
  // Check for session
  const session = getSessionFromRequest(request);
  
  // Admin-only routes
  if (adminRoutes.some(route => pathname.startsWith(route))) {
    if (!session || session.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin access required' },
        { status: 403 }
      );
    }
    return NextResponse.next();
  }
  
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
    
    // Guests cannot perform write operations
    if (session.role === 'guest') {
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
  
  // User is not logged in - check if path has guest access enabled
  // Extract the path from the URL for permission checking
  let pathToCheck = pathname;
  
  // For share paths like /sharename/path/to/file
  // Check guest access for that specific path
  const pathMatch = pathname.match(/^\/([^\/]+)(\/.*)?$/);
  if (pathMatch) {
    pathToCheck = pathname;
  }
  
  // Check if guest access is enabled for this path
  const guestAccessAllowed = await hasGuestAccess(pathToCheck);
  
  if (guestAccessAllowed) {
    // Allow access for browsing
    return NextResponse.next();
  }
  
  // No guest access, redirect to login for pages
  if (!pathname.startsWith('/api/')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  // API routes get 401
  return NextResponse.json(
    { error: 'Unauthorized', message: 'Login required or guest access not enabled for this path' },
    { status: 401 }
  );
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
