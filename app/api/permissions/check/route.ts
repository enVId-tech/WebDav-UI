import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import { hasGuestAccess, requiresGuestCredentials } from '@/lib/permissions';

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
    
    // If user is authenticated as guest, check if guest credentials exist for this path
    // Authenticated guests have access if credentials are configured
    if (isGuest) {
      const guestCreds = await requiresGuestCredentials(path, false);
      return NextResponse.json({
        hasAccess: guestCreds, // Authenticated guest has access if credentials are configured
        needsCredentials: false,
        isAuthenticated: true,
        isAdmin: false
      });
    }
    
    // For unauthenticated users, check if guest access is enabled
    const needsCredentials = await requiresGuestCredentials(path, false);
    const hasAccess = await hasGuestAccess(path, false);
    
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
