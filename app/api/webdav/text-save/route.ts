import { NextRequest, NextResponse } from 'next/server';
import webdavService from '@/lib/webdav-server';
import dotenv from 'dotenv';

dotenv.config();

export async function POST(request: NextRequest) {
  try {
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

    const buffer = Buffer.from(content, 'utf-8');
    await webdavService.uploadFile(relativeFilePath, buffer);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in text-save handler:', error);
    const status = error.status || 500;
    const message = error.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status });
  }
}
