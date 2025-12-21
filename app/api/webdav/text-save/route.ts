import { NextRequest, NextResponse } from 'next/server';
import webdavService from '@/lib/webdav-server';
import { getSessionFromRequest } from '@/lib/session';
import dotenv from 'dotenv';

dotenv.config();

export async function POST(request: NextRequest) {
  try {
    // Check authentication using request object
    const session = getSessionFromRequest(request);
    
    if (!session) {
      console.log('[text-save] No valid session found');
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Please log in to save files' },
        { status: 401 }
      );
    }
    
    console.log('[text-save] Authenticated user:', session.username);

    const { path, sharePath, content } = await request.json();

    if (!path || !sharePath) {
      return NextResponse.json({ error: 'Missing path or sharePath' }, { status: 400 });
    }

    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid content' }, { status: 400 });
    }

    const decodedPath = decodeURIComponent(path);

    // Derive a file path relative to the WebDAV root, similar to other routes
    // sharePath is already like `/etran`; decodedPath is the path within the share
    let relativeFilePath = `${sharePath}`;
    if (decodedPath && decodedPath !== '/') {
      relativeFilePath += decodedPath.startsWith('/') ? decodedPath : `/${decodedPath}`;
    }

    console.log('[text-save] Writing to path:', relativeFilePath);
    console.log('[text-save] Content length:', content.length, 'bytes');

    const buffer = Buffer.from(content, 'utf-8');
    await webdavService.uploadFile(relativeFilePath, buffer);

    console.log('[text-save] File saved successfully');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in text-save handler:', error);
    
    // Handle specific error codes
    const status = error.status || error.response?.status || 500;
    let message = error.message || 'Internal Server Error';
    
    // Provide more helpful error messages for common issues
    if (status === 409) {
      message = 'File conflict - the file may be locked or there may be a permission issue. Please try again.';
    } else if (status === 401 || status === 403) {
      message = 'Unauthorized - you do not have permission to save this file.';
    } else if (status === 404) {
      message = 'File or directory not found.';
    }
    
    return NextResponse.json({ 
      error: message,
      details: error.message,
      status 
    }, { status });
  }
}
