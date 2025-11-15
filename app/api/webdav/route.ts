import { NextRequest, NextResponse } from 'next/server';
import webdavService from "@/lib/webdav-server";
import { lookup } from 'mime-types';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Helper function to determine content type
function getContentType(path: string): string {
    return lookup(path) || 'application/octet-stream';
}

// Helper function to extract filename from path
function getFileName(path: string): string {
    return path.split('/').pop() || 'download';
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const requestPath = searchParams.get('path');
        const sharePath = searchParams.get('sharePath');
        const isFile = searchParams.get('isFile') === 'true';
        const download = searchParams.get('download') === 'true';        if (!requestPath || !sharePath) {
            return NextResponse.json({ error: 'Missing path or sharePath parameter' }, { status: 400 });
        }

        const decodedPath = decodeURIComponent(requestPath);        // Properly construct the WebDAV URL to avoid double slashes
        let filePath = '';
        
        // Construct the file path separately for file requests
        if (decodedPath && decodedPath !== '/') {
            const cleanPath = decodedPath.replace(/^\//, ''); // Remove leading slash from decoded path
            filePath += '/' + cleanPath;
        }

        // Clean up any double slashes in the file path
        filePath = filePath.replace(/\/+/g, '/');
        
        console.log(`GET request for file path: ${filePath}, isFile: ${isFile}`);
        
        // For files, keep the WebDAV client at the base URL and pass the file path
        if (isFile) {
            // Ensure WebDAV client is connected to base URL
            webdavService.updateUrl(process.env.WEBDAV_URL || '');
            
            // Check for Range header (for chunked video streaming)
            const rangeHeader = request.headers.get('range');
            
            if (rangeHeader) {
                // Parse the Range header (format: bytes=start-end)
                const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
                if (match) {
                    const start = parseInt(match[1], 10);
                    
                    // Get file size first
                    const fileSize = await webdavService.getFileSize(filePath);
                    
                    // If end is not specified, use file size - 1
                    const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;
                    
                    // Fetch partial content
                    const partialContent = await webdavService.getPartialFileContents(filePath, start, end);
                    
                    const headers = new Headers();
                    headers.set('Content-Type', getContentType(decodedPath));
                    headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`);
                    headers.set('Accept-Ranges', 'bytes');
                    headers.set('Content-Length', String(partialContent.length));
                    
                    if (download) {
                        headers.set('Content-Disposition', `attachment; filename="${getFileName(decodedPath)}"`);
                    } else {
                        headers.set('Content-Disposition', `inline; filename="${getFileName(decodedPath)}"`);
                    }
                    
                    // Return 206 Partial Content
                    return new NextResponse(partialContent, {
                        status: 206,
                        headers: headers,
                    });
                }
            }
            
            // No Range header or invalid format - return full file
            const fileContent = await webdavService.getFileContents(filePath);

            const headers = new Headers();
            headers.set('Content-Type', getContentType(decodedPath));
            headers.set('Accept-Ranges', 'bytes'); // Indicate that range requests are supported
            headers.set('Content-Length', String(fileContent.length));
            
            if (download) {
                headers.set('Content-Disposition', `attachment; filename="${getFileName(decodedPath)}"`);
            } else {
                headers.set('Content-Disposition', `inline; filename="${getFileName(decodedPath)}"`);
            }

            // fileContent is now always a Buffer, which is compatible with NextResponse
            return new NextResponse(fileContent, {
                headers: headers,
            });        } else {
            // Handle directory listing - ensure WebDAV client is at base URL  
            webdavService.updateUrl(process.env.WEBDAV_URL || '');
            
            // Ensure the directory path ends with /
            if (!filePath.endsWith('/')) {
                filePath += '/';
            }
            
            const directoryContents = await webdavService.getDirectoryContents(filePath);
            // Handle directory contents - it should already be an array from our service
            const contentsArray = Array.isArray(directoryContents) ? directoryContents : [];

            const formattedContents = contentsArray.map((item: any) => ({
                name: item.basename,
                type: item.type,
                size: item.size,
                lastModified: new Date(item.lastmod).toLocaleString(), // Ensure lastmod is valid
                filename: item.filename, // Pass along filename
                basename: item.basename, // Pass along basename
                etag: item.etag, // Pass along etag
                lastmod: item.lastmod // Pass along lastmod
            }));
            return NextResponse.json(formattedContents);
        }
    } catch (error: any) {
        console.error('Error in GET /api/webdav handler:', error);
        const status = error.status || 500;
        // Ensure a JSON response for errors
        return NextResponse.json({ error: error.message || 'Internal Server Error', detail: error.toString() }, { status });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log('POST Request body:', body);

        const { path: requestPath, sharePath, isFile = false } = body;

        if (!requestPath || !sharePath) {
            return NextResponse.json({ error: 'Missing path or sharePath in POST body' }, { status: 400 });
        }
        const decodedPath = decodeURIComponent(requestPath);

        let fullPath = `${process.env.WEBDAV_URL}/${sharePath}`;
        if (decodedPath && decodedPath !== '/') {
            fullPath += decodedPath.startsWith('/') ? decodedPath : `/${decodedPath}`;
        }

        console.log(`POST Full URL: ${fullPath}, isFile: ${isFile}`);
        webdavService.updateUrl(fullPath);

        if (isFile) {
            // This part of POST was for fetching file content, GET is more appropriate.
            // However, if some client still uses POST for this, we can keep it.
            // For consistency, it's better to use GET for fetching files.
            // Consider deprecating POST for file fetching if possible.
            console.warn("Warning: File fetching via POST is deprecated. Use GET /api/webdav?path=...&isFile=true");
            const fileContent = await webdavService.getFileContents();
            return new NextResponse(fileContent, {
                headers: {
                    'Content-Type': getContentType(decodedPath),
                    'Content-Disposition': `inline; filename="${getFileName(decodedPath)}"`,
                }
            });
        } else {
            // Handle directory listing for POST
            if (!fullPath.endsWith('/')) {
                fullPath += '/';
                webdavService.updateUrl(fullPath);
            }            const directoryContents = await webdavService.getDirectoryContents();
            // Handle directory contents - it should already be an array from our service
            const contentsArray = Array.isArray(directoryContents) ? directoryContents : [];

            const formattedContents = contentsArray.map((item: any) => ({
                name: item.basename, // Use basename for name
                type: item.type,
                size: item.size,
                lastModified: new Date(item.lastmod).toLocaleString(), // Ensure lastmod is valid
                filename: item.filename,
                basename: item.basename,
                etag: item.etag,
                lastmod: item.lastmod
            }));
            return NextResponse.json(formattedContents);
        }
    } catch (error: any) {
        console.error('Error in POST /api/webdav handler:', error);
        const status = error.status || 500;
         // Ensure a JSON response for errors
        return NextResponse.json({ error: error.message || 'Internal Server Error', detail: error.toString() }, { status });
    }
}

