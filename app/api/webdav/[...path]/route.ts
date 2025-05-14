import { NextRequest, NextResponse } from 'next/server';
import webdavService from "@/lib/webdav-server";
import { lookup } from 'mime-types';

export async function POST(request: NextRequest) {
    try {
        // Extract path, sharePath, and isFile flag from the request body
        const body = await request.json();
        console.log('Request body:', body);

        const { path: requestPath, sharePath, isFile = false } = body;
        const decodedPath = decodeURIComponent(requestPath);

        // Construct base URL with sharePath
        let fullPath = `https://192.168.1.89:30001${sharePath}`;

        // Add the path if it exists and isn't just '/'
        if (decodedPath && decodedPath !== '/') {
            fullPath += decodedPath.startsWith('/') ? decodedPath : `/${decodedPath}`;
        }

        console.log(`Full URL: ${fullPath}, isFile: ${isFile}`);
        webdavService.updateUrl(fullPath);

        if (isFile) {
            // Handle file request
            const fileContent = await webdavService.getFileContents();

            // Return file content with appropriate Content-Type header
            return new NextResponse(fileContent, {
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