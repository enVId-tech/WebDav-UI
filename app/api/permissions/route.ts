import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/session';
import {
  getAllPermissions,
  setPathPermission,
  removePathPermission,
  bulkUpdatePermissions,
  PathPermission
} from '@/lib/permissions';

function isAdminSession(session: { username: string; role?: string } | null): boolean {
  if (!session) return false;
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  return session.role === 'admin' || session.username === adminUsername;
}

/**
 * GET /api/permissions - Get all permissions (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    
    if (!isAdminSession(session)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin access required' },
        { status: 403 }
      );
    }
    
    const permissions = await getAllPermissions();
    
    return NextResponse.json({
      success: true,
      permissions
    });
  } catch (error: any) {
    console.error('[permissions] Error getting permissions:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/permissions - Set or update permission for a path (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    
    if (!isAdminSession(session)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin access required' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { permission } = body as { permission: PathPermission };
    
    if (!permission || !permission.path) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Permission object with path is required' },
        { status: 400 }
      );
    }
    
    await setPathPermission(permission);
    
    return NextResponse.json({
      success: true,
      message: 'Permission updated successfully'
    });
  } catch (error: any) {
    console.error('[permissions] Error setting permission:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/permissions - Remove permission for a path (admin only)
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    
    if (!isAdminSession(session)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin access required' },
        { status: 403 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    
    if (!path) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Path parameter is required' },
        { status: 400 }
      );
    }
    
    await removePathPermission(path);
    
    return NextResponse.json({
      success: true,
      message: 'Permission removed successfully'
    });
  } catch (error: any) {
    console.error('[permissions] Error removing permission:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/permissions - Bulk update permissions (admin only)
 */
export async function PUT(request: NextRequest) {
  try {
    const session = getSessionFromRequest(request);
    
    if (!isAdminSession(session)) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'Admin access required' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { paths, updates } = body as {
      paths: string[];
      updates: Partial<Omit<PathPermission, 'path'>>;
    };
    
    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Paths array is required' },
        { status: 400 }
      );
    }
    
    if (!updates) {
      return NextResponse.json(
        { error: 'Bad Request', message: 'Updates object is required' },
        { status: 400 }
      );
    }
    
    await bulkUpdatePermissions(paths, updates);
    
    return NextResponse.json({
      success: true,
      message: `Updated permissions for ${paths.length} path(s)`,
      updatedCount: paths.length
    });
  } catch (error: any) {
    console.error('[permissions] Error bulk updating permissions:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
