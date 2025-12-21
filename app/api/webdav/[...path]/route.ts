import { NextRequest, NextResponse } from 'next/server';
import webdavService from "@/lib/webdav-server";
import { lookup } from 'mime-types';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export async function POST(request: NextRequest) {
    try {
        // Extract path, sharePath, and isFile flag from the request body
        const body = await request.json();
        console.log('Request body:', body);

        const { path: requestPath, sharePath, isFile = false } = body;
        const decodedPath = decodeURIComponent(requestPath);

        // Construct base URL with normalized sharePath
        // Ensure we don't have double slashes between base URL and sharePath
        const baseUrl = process.env.WEBDAV_URL || '';
        const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

        // Build the full path carefully to avoid path issues
        let fullPath = `${normalizedBaseUrl}/${sharePath}`;

        // Add the path if it exists and isn't just '/'
        if (decodedPath && decodedPath !== '/') {
            // Ensure we have exactly one slash between paths
            fullPath += decodedPath.startsWith('/') ? decodedPath : `/${decodedPath}`;
        }

        console.log(`Full URL: ${fullPath}, isFile: ${isFile}`);
        webdavService.updateUrl(fullPath);

        if (isFile) {
            // Handle file request
            const fileContent = await webdavService.getFileContents();

            // NextResponse expects a Web BodyInit; convert Node Buffer to Uint8Array for type compatibility
            const responseBody: BodyInit =
                Buffer.isBuffer(fileContent) ? new Uint8Array(fileContent) : (fileContent as unknown as BodyInit);

            // Return file content with appropriate Content-Type header
            return new NextResponse(responseBody, {
                headers: {
                    'Content-Type': getContentType(decodedPath),
                    'Content-Disposition': `inline; filename="${getFileName(decodedPath)}"`,
                }
            });
        } else {
            // Handle directory request - ensure URL ends with trailing slash
            if (!fullPath.endsWith('/')) {
                fullPath += '/';
                webdavService.updateUrl(fullPath);
            }

            // Fetch directory contents
            const directoryContents = await webdavService.getDirectoryContents();

            const formattedContents = directoryContents.map((item: any) => ({
                name: item.basename,
                type: item.type,
                size: item.size,
                lastModified: new Date(item.lastmod).toLocaleString(),
            }));

            return NextResponse.json(formattedContents);
        }
    } catch (error) {
        console.error('Error in POST handler:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// Helper function to determine content type
function getContentType(path: string): string {
    // Uses the mime-types library to look up the appropriate MIME type
    // Falls back to 'application/octet-stream' if no match is found
    return lookup(path) || 'application/octet-stream';
}

// Helper function to extract filename from path
function getFileName(path: string): string {
    return path.split('/').pop() || 'download';
}

