import { NextRequest, NextResponse } from 'next/server';
import webdavService from "@/lib/webdav-server";

export async function POST(request: NextRequest, { params }: { params: { path: string[] } }) {
    try {
        // Extract both path and sharePath from the request body
        const body = await request.json();
        console.log('Request body:', body);

        const { path: requestPath, sharePath } = body;

        // Decode the URL-encoded path if needed
        const decodedPath = decodeURIComponent(requestPath);

        // Construct base URL with sharePath
        let fullPath = `https://192.168.1.89:28955${sharePath}`;

        // Add the path if it exists and isn't just '/'
        if (decodedPath && decodedPath !== '/') {
            // Ensure we don't double up on slashes
            fullPath += decodedPath.startsWith('/') ? decodedPath : `/${decodedPath}`;
        }

        // Ensure URL ends with trailing slash for directory
        if (!fullPath.endsWith('/')) {
            fullPath += '/';
        }

        console.log(`Full update URL: ${fullPath}`);
        webdavService.updateUrl(fullPath);

        // Fetch directory contents
        const directoryContents = await webdavService.getDirectoryContents();

        const formattedContents = directoryContents.map((item: any) => ({
            name: item.basename,
            type: item.type,
            size: item.size,
            lastModified: new Date(item.lastmod).toLocaleString(),
        }));

        return NextResponse.json(formattedContents);
    } catch (error) {
        console.error('Error in POST handler:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}