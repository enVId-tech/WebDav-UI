import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Define public routes that don't require authentication
const publicRoutes = ['/login', '/api/auth/login', '/api/auth/status'];

// Define API routes that should be protected
const protectedApiRoutes = ['/api/webdav'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow public routes
  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }
  
  // Check for session token in cookies
  const sessionToken = request.cookies.get('session_token')?.value;
  
  // Check if this is a protected API route
  const isProtectedApi = protectedApiRoutes.some(route => pathname.startsWith(route));
  
  // If no session token and accessing protected routes, redirect to login
  if (!sessionToken) {
    if (isProtectedApi) {
      // For API routes, return 401
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
