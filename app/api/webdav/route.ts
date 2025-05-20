import { NextRequest, NextResponse } from 'next/server';
import { createClient, FileStat, ResponseDataDetailed } from 'webdav';
import { Readable } from 'stream';
import https from 'https';

function nodeStreamToWebReadable(nodeStream: Readable): ReadableStream {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => controller.enqueue(chunk));
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', (err) => controller.error(err));
    },
  });
}

function isDetailedStat(
    stat: FileStat | ResponseDataDetailed<FileStat>
): stat is ResponseDataDetailed<FileStat> {
  return (stat as ResponseDataDetailed<FileStat>).data !== undefined;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');
  const sharePath = searchParams.get('sharePath');
  const isFile = searchParams.get('isFile') === 'true';

  if (!path || !sharePath) {
    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
  }

  try {
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });
    const client = createClient('https://192.168.1.89:30001', {
      username: process.env.WEBDAV_USERNAME || 'username',
      password: process.env.WEBDAV_PASSWORD || 'password',
      httpsAgent,
    });

    const decodedPath = decodeURIComponent(path);
    const decodedSharePath = decodeURIComponent(sharePath);
    const fullPath = `${decodedSharePath}${decodedPath}`;

    if (isFile) {
      const stats = await client.stat(fullPath);
      if (!stats) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }

      const fileStat = isDetailedStat(stats) ? stats.data : stats;
      const fileStream = await client.createReadStream(fullPath);
      const mimeType = fileStat.props?.getcontenttype || 'application/octet-stream';

      return new Response(nodeStreamToWebReadable(fileStream), {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `inline; filename="${decodedPath.split('/').pop()}"`,
        },
      });
    } else {
      const directoryItems = await client.getDirectoryContents(fullPath);
      return NextResponse.json(directoryItems);
    }
  } catch (error: any) {
    console.error('WebDAV error:', error);
    return NextResponse.json(
        { error: error.message, details: error.code || 'unknown error' },
        { status: 500 }
    );
  }
}