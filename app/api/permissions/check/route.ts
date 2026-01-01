import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { hasAnonymousAccess, requiresUserLogin } from '@/lib/permissions';

/**
 * POST /api/permissions/check - Check if user has access to a path
 */
export async function POST(request: NextRequest) {
  try {
    const { path } = await request.json() as { path: string };
    
    if (!path) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Path is required' },
        { status: 400 }
      );
    }

    const session = getSessionFromRequest(request);
    const isAdmin = session?.role === 'admin';
    const isGuest = session?.role === 'guest';
    
    // Admin always has access
    if (isAdmin) {
      return NextResponse.json({
        hasAccess: true,
        needsCredentials: false,
        isAuthenticated: true,
        isAdmin: true
      });
    }
    
    // If user is authenticated (with login), check if user credentials exist for this path
    // Authenticated users have access if credentials are configured
    if (isGuest) {
      const userCreds = await requiresUserLogin(path, false);
      return NextResponse.json({
        hasAccess: userCreds, // Authenticated user has access if credentials are configured
        needsCredentials: false,
        isAuthenticated: true,
        isAdmin: false
      });
    }
    
    // For unauthenticated users, check if anonymous access is enabled
    const needsCredentials = await requiresUserLogin(path, false);
    const hasAccess = await hasAnonymousAccess(path, false);
    
    return NextResponse.json({
      hasAccess,
      needsCredentials,
      isAuthenticated: false,
      isAdmin: false
    });
  } catch (error: any) {
    console.error('[permissions/check] Error checking permissions:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
