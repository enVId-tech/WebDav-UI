import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession, getSessionFromRequest } from './session';

/**
 * Middleware wrapper to require authentication for API routes
 * Use this for route handlers that receive NextRequest
 */
export function requireAuth(
  handler: (request: NextRequest, session: { username: string }) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: any) => {
    const session = getSessionFromRequest(request);
    
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }
    
    return handler(request, { username: session.username });
  };
}

/**
 * Get the authenticated user from the current request
 * For use in route handlers with NextRequest
 */
export function getAuthenticatedUserFromRequest(request: NextRequest): { username: string } | null {
  const session = getSessionFromRequest(request);
  
  if (!session) {
    return null;
  }
  
  return { username: session.username };
}

/**
 * Get the authenticated user from cookies (for server components)
 */
export async function getAuthenticatedUser(): Promise<{ username: string } | null> {
  const session = await getCurrentSession();
  
  if (!session) {
    return null;
  }
  
  return { username: session.username };
}

/**
 * Check if the current request is authenticated
 */
export function isAuthenticatedRequest(request: NextRequest): boolean {
  const session = getSessionFromRequest(request);
  return session !== null;
}

/**
 * Check if authenticated (for server components)
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getCurrentSession();
  return session !== null;
}
