import { NextRequest } from 'next/server';
import { Readable } from 'stream';
import https from 'https';
import { lookup } from "mime-types";
import webdavService from '@/lib/webdav-server';
import { createClient, FileStat, ResponseDataDetailed } from 'webdav';

// Enhanced CORS headers for better streaming support
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
  'Access-Control-Allow-Headers': 'Range,Content-Type,Authorization',
  'Access-Control-Expose-Headers': 'Content-Range,Accept-Ranges,Content-Length,Content-Type',
  'Access-Control-Max-Age': '86400'
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

// Improved stream conversion with error handling and type safety
function nodeStreamToWebReadable(nodeStream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', chunk => {
        try {
          // Ensure chunk is a Uint8Array for browser compatibility
          const typedChunk = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
          controller.enqueue(typedChunk);
        } catch (e) {
          console.error('Error processing stream chunk:', e);
          controller.error(e);
        }
      });

      nodeStream.on('end', () => {
        try {
          controller.close();
        } catch (e) {
          console.error('Error closing stream controller:', e);
        }
      });

      nodeStream.on('error', err => {
        console.error('Stream error event:', err);
        controller.error(err);
      });
    },
    cancel() {
      console.log('Stream canceled by consumer');
      nodeStream.destroy();
    }
  });
}

function isDetailedStat(
    stat: FileStat | ResponseDataDetailed<FileStat>
): stat is ResponseDataDetailed<FileStat> {
  return (stat as ResponseDataDetailed<FileStat>).data !== undefined;
}

export async function GET(request: NextRequest) {
  console.log('WebDAV request received:', request.url);

  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get('path');
  const rawShare = searchParams.get('sharePath');
  const isFile = searchParams.get('isFile') === 'true';
  const download = searchParams.get('download') === 'true';
  const debug = searchParams.get('debug') === 'true';

  if (!rawPath || !rawShare) {
    console.error('Missing parameters:', { path: rawPath, share: rawShare });
    return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const decodedPath = decodeURIComponent(rawPath);
  const decodedShare = decodeURIComponent(rawShare);

  // Fix path construction to prevent duplication
  // Remove any leading 'etran/' from decodedPath to prevent duplication
  const cleanedPath = decodedPath.replace(/^etran\//i, '');

  // Construct the full path properly, ensuring no double slashes
  const fullPath = decodedShare.replace(/\/$/, '') + '/' + cleanedPath.replace(/^\//, '');

  const fileName = cleanedPath.split('/').pop() || 'file';
  const mimeType = lookup(fileName) || 'application/octet-stream';
  const isVideo = mimeType.startsWith('video/') || mimeType === 'application/mp4';

  console.log('Request details:', {
    originalPath: decodedPath,
    cleanedPath,
    fullPath,
    fileName,
    mimeType,
    isVideo,
    rangeHeader: request.headers.get('range')
  });

  try {
    // Using a fixed server URL for WebDAV
    const serverUrl = 'https://192.168.1.89:30001';

    // Create WebDAV client with optimized settings
    const client = createClient(serverUrl, {
      username: process.env.WEBDAV_USERNAME || '',
      password: process.env.WEBDAV_PASSWORD || '',
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
        keepAlive: true,
        timeout: 60000 // 60 second timeout
      })
    });

    if (!isFile) {
      // Handle directory listing
      webdavService.updateUrl(serverUrl);
      const items = await webdavService.getDirectoryContents(fullPath);
      return new Response(JSON.stringify(items), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get file stats to determine size
    console.log('Getting file stats for:', fullPath);

    // Add extra error handling for the stat call
    let stats;
    try {
      stats = await client.stat(fullPath);
    } catch (statErr: any) {
      console.error('Error getting file stats:', statErr.message);

      // Try alternative path formats if the first attempt fails
      const altPath = fullPath.replace('/etran/', '/');
      console.log('Trying alternative path:', altPath);

      try {
        stats = await client.stat(altPath);
        console.log('Found file using alternative path');
      } catch (altErr) {
        console.error('Alternative path also failed');
        return new Response(JSON.stringify({
          error: 'File not found',
          message: 'Unable to locate file on server',
          fullPath,
          altPath
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (!stats) {
      console.error('File not found:', fullPath);
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const fileStat = isDetailedStat(stats) ? stats.data : stats;
    const size = fileStat.size;
    console.log('File stats:', { fileName, size, mimeType });

    // Optimized chunk sizes for different content types
    const CHUNK_SIZE = isVideo
        ? (size > 100 * 1024 * 1024 ? 2 * 1024 * 1024 : 1024 * 1024) // 2MB for large videos, 1MB for smaller
        : size;

    // Parse range header
    const rangeHeader = request.headers.get('range');
    let start = 0;
    let end = Math.min(size - 1, start + CHUNK_SIZE - 1);
    let status = 200;

    const headers: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': isVideo ? 'public, max-age=3600' : 'no-cache'
    };

    // Handle range requests
    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const matches = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);

      if (matches) {
        const startMatch = matches[1];
        const endMatch = matches[2];

        start = parseInt(startMatch, 10);
        end = endMatch ? parseInt(endMatch, 10) : Math.min(start + CHUNK_SIZE - 1, size - 1);

        console.log('Range request details:', { start, end, size, length: end - start + 1 });

        if (start > end || start >= size) {
          console.warn('Invalid range request:', { start, end, size });
          return new Response(null, {
            status: 416, // Range Not Satisfiable
            headers: {
              ...corsHeaders,
              'Content-Range': `bytes */${size}`
            }
          });
        }

        status = 206; // Partial Content
        headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
      } else {
        console.warn('Malformed range header:', rangeHeader);
      }
    }

    headers['Content-Length'] = String(end - start + 1);
    headers['Content-Disposition'] = `${download ? 'attachment' : 'inline'}; filename="${fileName}"`;

    console.log('Streaming response with headers:', {
      status,
      rangeHeader: headers['Content-Range'],
      contentLength: headers['Content-Length']
    });

    try {
      // Create stream with proper range using the same path that worked for stat
      const stream = await client.createReadStream(fullPath, {
        range: { start, end }
      });

      // Add logging for stream events in debug mode
      if (debug) {
        let bytesReceived = 0;
        stream.on('data', chunk => {
          bytesReceived += chunk.length;
          if (bytesReceived % (256 * 1024) === 0 || bytesReceived === end - start + 1) {
            console.log(`Stream progress: ${bytesReceived}/${end - start + 1} bytes (${Math.round(bytesReceived/(end-start+1)*100)}%)`);
          }
        });

        stream.on('end', () => console.log('Stream ended successfully'));
        stream.on('error', err => console.error('Stream error:', err));
      }

      // Convert Node.js stream to Web stream
      const webStream = nodeStreamToWebReadable(stream);
      return new Response(webStream, { status, headers });

    } catch (streamErr: any) {
      console.error('Error creating stream:', streamErr);
      return new Response(JSON.stringify({
        error: 'Stream error',
        message: streamErr.message,
        stack: debug ? streamErr.stack : undefined
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (err: any) {
    console.error('General error serving file:', err);
    return new Response(JSON.stringify({
      error: 'Server error',
      message: err.message,
      stack: debug ? err.stack : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}