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
        const download = searchParams.get('download') === 'true';

        if (!requestPath || !sharePath) {
            return NextResponse.json({ error: 'Missing path or sharePath parameter' }, { status: 400 });
        }

        const decodedPath = decodeURIComponent(requestPath);

        let fullWebDavUrl = `${process.env.WEBDAV_URL}/${sharePath}`;
        if (decodedPath && decodedPath !== '/') {
            fullWebDavUrl += decodedPath.startsWith('/') ? decodedPath : `/${decodedPath}`;
        }

        console.log(`GET request for: ${fullWebDavUrl}, isFile: ${isFile}`);
        webdavService.updateUrl(fullWebDavUrl);

        if (isFile) {
            const fileContent = await webdavService.getFileContents();

            const headers = new Headers();
            headers.set('Content-Type', getContentType(decodedPath));
            if (download) {
                headers.set('Content-Disposition', `attachment; filename="${getFileName(decodedPath)}"`);
            } else {
                headers.set('Content-Disposition', `inline; filename="${getFileName(decodedPath)}"`);
            }

            return new NextResponse(fileContent, {
                headers: headers,
            });
        } else {
            // Handle directory listing for GET if needed, ensure trailing slash
            if (!fullWebDavUrl.endsWith('/')) {
                fullWebDavUrl += '/';
                webdavService.updateUrl(fullWebDavUrl);
            }
            const directoryContents = await webdavService.getDirectoryContents();
            // Ensure directoryContents is an array before mapping
            const contentsArray = Array.isArray(directoryContents) ? directoryContents : (directoryContents.data || []);

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
            }
            const directoryContents = await webdavService.getDirectoryContents();
            // Ensure directoryContents is an array before mapping
            const contentsArray = Array.isArray(directoryContents) ? directoryContents : (directoryContents.data || []);

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

