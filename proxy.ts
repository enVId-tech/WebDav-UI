import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define public routes that don't require authentication
const publicRoutes = ['/login', '/api/auth/login', '/api/auth/status'];

// Define API routes that require authentication (write operations)
const writeApiRoutes = ['/api/webdav/upload', '/api/webdav/delete', '/api/webdav/text-save'];

// Define read-only API routes (allowed with guest access)
const readApiRoutes = ['/api/webdav'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }
  
  // Check for session token in cookies
  const sessionToken = request.cookies.get('session_token')?.value;
  
  // Check if guest access is enabled (default to true for backward compatibility)
  const guestAccessEnabled = process.env.GUEST_ACCESS_ENABLED !== 'false';
  
  // Check if this is a write operation API route
  const isWriteApi = writeApiRoutes.some(route => pathname.startsWith(route));
  const isReadApi = readApiRoutes.some(route => pathname.startsWith(route)) && !isWriteApi;
  
  // If no session token
  if (!sessionToken) {
    // Always protect write operations
    if (isWriteApi) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please log in to upload or delete files' },
        { status: 401 }
      );
    }
    
    // If guest access is disabled, protect all routes except public ones
    if (!guestAccessEnabled) {
      if (isReadApi) {
        return NextResponse.json(
          { error: 'Unauthorized', message: 'Please log in to access this resource' },
          { status: 401 }
        );
      } else if (pathname !== '/' && pathname !== '/login') {
        // For page routes, redirect to login
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
    // If guest access is enabled, allow browsing (read operations)
  }
  
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
