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
        const baseUrl = process.env.WEBDAV_URL || '';
        const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

        // Build the full path
        // We construct the full URL to the target folder
        let fullPath = `${normalizedBaseUrl}/${sharePath}`;

        if (decodedPath && decodedPath !== '/') {
            const cleanPath = decodedPath.startsWith('/') ? decodedPath.substring(1) : decodedPath;
            fullPath += `/${cleanPath}`;
        }

        console.log(`Full URL: ${fullPath}, isFile: ${isFile}`);
        
        // Update service to point to the specific folder/file
        webdavService.updateUrl(fullPath);

        if (isFile) {
            // Handle file request
            const fileContent = await webdavService.getFileContents();

            // NextResponse expects a Web BodyInit; convert Node Buffer to Uint8Array for type compatibility
            const responseBody: BodyInit =
                Buffer.isBuffer(fileContent) ? new Uint8Array(fileContent) : (fileContent as unknown as BodyInit);

            // Return file content with appropriate Content-Type header
            const fileName = getFileName(decodedPath);
            return new NextResponse(responseBody, {
                headers: {
                    'Content-Type': getContentType(decodedPath),
                    'Content-Disposition': `inline; filename="${fileName.replace(/[^\x20-\x7E]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
                }
            });
        } else {
            // Handle directory request
            // When the client is pointed to the folder, we request the root of that folder
            
            // Ensure URL ends with trailing slash for directory requests if not already
            if (!fullPath.endsWith('/')) {
                webdavService.updateUrl(fullPath + '/');
            }

            // Fetch directory contents of the current URL
            const directoryContents = await webdavService.getDirectoryContents('/');

            const formattedContents = directoryContents
                .filter((item: any) => {
                    return true;
                })
                .map((item: any) => ({
                name: item.basename,
                type: item.type,
                size: item.size,
                lastModified: item.lastmod,
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

