import { NextRequest, NextResponse } from 'next/server';
import webdavService from "@/lib/webdav-server";

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
    const extension = path.split('.').pop()?.toLowerCase();

    const mimeTypes: {[key: string]: string} = {
        'pdf': 'application/pdf',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'txt': 'text/plain',
        'html': 'text/html',
        'mp4': 'video/mp4',
        'mp3': 'audio/mpeg',
        // Add more as needed
    };

    return extension && mimeTypes[extension] ? mimeTypes[extension] : 'application/octet-stream';
}

// Helper function to extract filename from path
function getFileName(path: string): string {
    return path.split('/').pop() || 'download';
}