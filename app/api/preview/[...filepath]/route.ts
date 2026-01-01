import { NextRequest, NextResponse } from 'next/server';
import webdavService from '@/lib/webdav-server';
import { lookup } from 'mime-types';

/**
 * Secure server-side file preview endpoint
 * Permission checking is handled by middleware in proxy.ts
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filepath: string[] }> }
) {
  try {
    // Await params (Next.js 15+)
    const resolvedParams = await params;
    
    // Build the file path from params
    const filepath = resolvedParams.filepath.join('/');
    const cleanPath = filepath.replace(/^etran\//, '');
    
    // Construct WebDAV file path
    const filePath = `/${cleanPath}`;
    
    // Get file metadata
    const fileName = cleanPath.split('/').pop() || 'file';
    const mimeType = lookup(fileName) || 'application/octet-stream';
    
    // Initialize WebDAV service
    webdavService.updateUrl(process.env.WEBDAV_URL || '');
    
    // Check for Range header (for video/audio streaming)
    const rangeHeader = request.headers.get('range');
    
    if (rangeHeader) {
      // Handle partial content request (for video seeking)
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
      if (match) {
        const start = parseInt(match[1], 10);
        const fileSize = await webdavService.getFileSize(filePath);
        
        // Optimize chunk size
        const isInitialRequest = start === 0;
        const INITIAL_CHUNK_SIZE = 2 * 1024 * 1024; // 2MB
        const STREAMING_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
        const MAX_CHUNK_SIZE = isInitialRequest ? INITIAL_CHUNK_SIZE : STREAMING_CHUNK_SIZE;
        
        const requestedEnd = match[2] ? parseInt(match[2], 10) : fileSize - 1;
        const end = Math.min(requestedEnd, start + MAX_CHUNK_SIZE - 1, fileSize - 1);
        
        // Fetch partial content
        const partialContent = await webdavService.getPartialFileContents(filePath, start, end);
        
        const headers = new Headers();
        headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
        headers.set('Accept-Ranges', 'bytes');
        headers.set('Content-Length', (end - start + 1).toString());
        headers.set('Content-Type', mimeType);
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        
        return new NextResponse(Buffer.from(partialContent), {
          status: 206,
          headers,
        });
      }
    }
    
    // Full file request
    const fileContents = await webdavService.getFileContents(filePath);
    
    const headers = new Headers();
    headers.set('Content-Type', mimeType);
    headers.set('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set('Accept-Ranges', 'bytes');
    
    return new NextResponse(Buffer.from(fileContents), {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error('[preview] Error serving file:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
