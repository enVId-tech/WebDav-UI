import { NextRequest, NextResponse } from 'next/server';
import webdavService from '@/lib/webdav-server';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Disable Next.js body parsing to handle FormData
export const config = {
    api: {
        bodyParser: false,
    },
};

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const path = formData.get('path') as string | null; // This is the directory path within the share, e.g., "/" or "/subfolder"
        const sharePath = formData.get('sharePath') as string | null; // e.g., /etran

        if (!file || !path || !sharePath) {
            return NextResponse.json({ error: 'Missing file, path, or sharePath' }, { status: 400 });
        }

        // Construct the WebDAV client's target directory URL
        let clientTargetDirectoryUrl = `${process.env.WEBDAV_URL}/${sharePath}`;
        if (path && path !== '/') { // If path is like "/subfolder"
            clientTargetDirectoryUrl += path.startsWith('/') ? path : `/${path}`;
        }
        // Example: sharePath="/etran", path="/Chau Thai" -> clientTargetDirectoryUrl="https://.../etran/Chau Thai"
        // Example: sharePath="/etran", path="/" -> clientTargetDirectoryUrl="https://.../etran"

        // Ensure the client target directory URL ends with a slash
        if (!clientTargetDirectoryUrl.endsWith('/')) {
            clientTargetDirectoryUrl += '/';
        }
        // Example: "https://.../etran/Chau Thai" -> "https://.../etran/Chau Thai/"
        // Example: "https://.../etran" -> "https://.../etran/"

        console.log(`Updating WebDAV client URL to directory: ${clientTargetDirectoryUrl}`);
        webdavService.updateUrl(clientTargetDirectoryUrl);

        const fileBuffer = Buffer.from(await file.arrayBuffer());

        // Pass only the filename to uploadFile, as the client is now scoped to the directory
        console.log(`Uploading file "${file.name}" to directory ${clientTargetDirectoryUrl}`);
        await webdavService.uploadFile(file.name, fileBuffer);

        return NextResponse.json({ message: 'File uploaded successfully' });
    } catch (error: any) {
        console.error('Error in POST handler for upload:', error);
        const status = error.status || 500; // Use error's status if available (e.g., from WebDAV client)
        const message = error.message || 'Internal Server Error';
        // Include more details from the error if possible, e.g., error.response or error.cause
        let detail = error.detail || (error.response ? JSON.stringify(error.response) : 'No additional details');
        if (error.cause) detail += ` | Cause: ${error.cause}`;

        console.error(`Responding with status: ${status}, message: ${message}, detail: ${detail}`);
        return NextResponse.json({ error: message, detail: detail }, { status });
    }
}

