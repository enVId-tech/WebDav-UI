
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from 'webdav';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');
  const sharePath = searchParams.get('sharePath');
  const isFile = searchParams.get('isFile') === 'true';

  if (!path || !sharePath) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  try {
    // Replace with your actual WebDAV server URL and credentials
    const client = createClient("https://192.168.1.89:30001", {
      username: process.env.WEBDAV_USERNAME || "username",
      password: process.env.WEBDAV_PASSWORD || "password",
    });

    // Decode the path parameters to prevent double encoding
    const decodedPath = decodeURIComponent(path);
    const decodedSharePath = decodeURIComponent(sharePath);
    const fullPath = `${decodedSharePath}${decodedPath}`;

    console.log("Accessing WebDAV path:", fullPath);

    if (isFile) {
      // Get file stats first to confirm it exists
      const stats = await client.stat(fullPath);

      if (!stats.exists) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }

      // Get the file stream
      const fileStream = await client.createReadStream(fullPath);

      // Determine mime type
      const mimeType = stats.mime || 'application/octet-stream';

      // Create a streaming response
      return new Response(fileStream, {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `inline; filename="${decodedPath.split('/').pop()}"`,
        },
      });
    } else {
      // Handle directory listing case
      const directoryItems = await client.getDirectoryContents(fullPath);
      return NextResponse.json(directoryItems);
    }
  } catch (error: any) {
    console.error('WebDAV error:', error);
    return NextResponse.json({
      error: error.message,
      details: error.code || 'unknown error'
    }, { status: 500 });
  }
}