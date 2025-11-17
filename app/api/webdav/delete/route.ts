import { NextRequest, NextResponse } from 'next/server';
import webdavService from '@/lib/webdav-server';
import { getSessionFromRequest } from '@/lib/session';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export async function POST(request: NextRequest) {
    try {
        // Check authentication
        const session = getSessionFromRequest(request);
        
        if (!session) {
            console.log('[delete] No valid session found');
            return NextResponse.json(
                { error: 'Unauthorized', message: 'Please log in to delete files' },
                { status: 401 }
            );
        }
        
        console.log('[delete] Authenticated user:', session.username);

        const body = await request.json();
        const { path, sharePath } = body; // path is the path of the file within the share, e.g., /folder/file.txt

        if (!path || !sharePath) {
            return NextResponse.json({ error: 'Missing path or sharePath' }, { status: 400 });
        }

        // Extract filename and directory path within the share
        const lastSlashIndex = path.lastIndexOf('/');
        const fileName = path.substring(lastSlashIndex + 1);
        let directoryPathWithinShare = path.substring(0, lastSlashIndex);

        if (directoryPathWithinShare === "") { // If file is at the root of the share (e.g., path was "/file.txt")
            directoryPathWithinShare = "/";
        }

        // Construct the WebDAV client's target directory URL
        let clientTargetDirectoryUrl = `${process.env.WEBDAV_URL}/${sharePath}`;
        if (directoryPathWithinShare && directoryPathWithinShare !== '/') {
            clientTargetDirectoryUrl += directoryPathWithinShare.startsWith('/') ? directoryPathWithinShare : `/${directoryPathWithinShare}`;
        }

        // Ensure the client target directory URL ends with a slash
        if (!clientTargetDirectoryUrl.endsWith('/')) {
            clientTargetDirectoryUrl += '/';
        }

        console.log(`Updating WebDAV client URL to directory: ${clientTargetDirectoryUrl}`);
        webdavService.updateUrl(clientTargetDirectoryUrl);

        // Pass only the filename to deleteFile, as the client is now scoped to the directory
        console.log(`Deleting file "${fileName}" from directory ${clientTargetDirectoryUrl}`);
        await webdavService.deleteFile(fileName);

        return NextResponse.json({ message: 'File deleted successfully' });
    } catch (error: any) {
        console.error('Error in POST handler for delete:', error);
        const status = error.status || 500;
        const message = error.message || 'Internal Server Error';
        let detail = error.detail || (error.response ? JSON.stringify(error.response) : 'No additional details');
        if (error.cause) detail += ` | Cause: ${error.cause}`;

        console.error(`Responding with status: ${status}, message: ${message}, detail: ${detail}`);
        return NextResponse.json({ error: message, detail: detail }, { status });
    }
}

