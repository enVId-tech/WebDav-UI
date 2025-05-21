import { NextRequest } from 'next/server';
import { Readable } from 'stream';
import https from 'https';
import { lookup } from "mime-types";
import webdavService from '@/lib/webdav-server';
import { createClient, FileStat, ResponseDataDetailed } from 'webdav';

// Enhanced headers optimized for video streaming
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

function nodeStreamToWebReadable(nodeStream: Readable): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', chunk => {
        try {
          const typedChunk = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
          controller.enqueue(typedChunk);
        } catch (e) {
          console.error('Error processing stream chunk:', e);
          controller.error(e);
        }
      });

      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', err => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    }
  });
}

function isDetailedStat(
    stat: FileStat | ResponseDataDetailed<FileStat>
): stat is ResponseDataDetailed<FileStat> {
  return (stat as ResponseDataDetailed<FileStat>).data !== undefined;
}

// Get file size from stat result, handling both response types
function getFileSize(stat: FileStat | ResponseDataDetailed<FileStat>): number {
  if (isDetailedStat(stat)) {
    return stat.data.size;
  }
  return stat.size;
}

// Dynamic chunk size based on file size and content type
function getOptimalChunkSize(fileSize: number, isVideo: boolean): number {
  if (!isVideo) return fileSize; // Full file for non-video content

  // For videos, use smaller chunks for better streaming
  if (fileSize > 100 * 1024 * 1024) return 1024 * 1024; // 1MB for large videos
  if (fileSize > 20 * 1024 * 1024) return 512 * 1024;   // 512KB for medium videos
  return 256 * 1024;                                    // 256KB for small videos
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
    return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Properly decode path components
  const decodedPath = decodeURIComponent(rawPath);
  const decodedShare = decodeURIComponent(rawShare);

  // Remove any leading 'etran/' from the path to prevent duplication
  const cleanedPath = decodedPath.replace(/^etran\//i, '');

  // Construct server path (don't use URL encoding here - that's for HTTP requests)
  const fullPath = `${decodedShare.replace(/\/$/, '')}/${cleanedPath.replace(/^\//, '')}`;

  if (debug) {
    console.log('Path components:', {
      rawPath,
      decodedPath,
      cleanedPath,
      fullPath
    });
  }

  const fileName = cleanedPath.split('/').pop() || 'file';
  const mimeType = lookup(fileName) || 'application/octet-stream';
  const isVideo = mimeType.startsWith('video/') || mimeType === 'application/mp4';

  try {
    // Create WebDAV client with appropriate configuration
    const serverUrl = process.env.WEBDAV_URL || 'https://192.168.1.89:30001';

    const client = createClient(serverUrl, {
      username: process.env.WEBDAV_USERNAME || '',
      password: process.env.WEBDAV_PASSWORD || '',
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
        keepAlive: true,
        timeout: 60000
      })
    });

    // For directory listings, use the webdavService
    if (!isFile) {
      webdavService.updateUrl(serverUrl);
      const items = await webdavService.getDirectoryContents(fullPath);
      return new Response(JSON.stringify(items), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Try multiple path variants to find the file
    let stats = null;
    let workingPath = '';
    const pathVariants = [
      fullPath,                          // Standard path with share prefix
      cleanedPath,                       // Path without share prefix
      fullPath.replace(/^\/+/, '')       // Path with leading slashes removed
    ];

    for (const path of pathVariants) {
      try {
        if (debug) console.log('Trying path:', path);
        stats = await client.stat(path);
        workingPath = path;
        if (debug) console.log('Path success:', path);
        break;
      } catch (err: any) {
        if (debug) console.log('Path failed:', path, err.message);
      }
    }

    if (!stats) {
      console.error('File not found after trying multiple paths');
      return new Response(JSON.stringify({
        error: 'File not found',
        triedPaths: pathVariants
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get file size using the helper function to fix the TypeScript error
    const fileSize = getFileSize(stats);

    if (debug) {
      console.log('File stats:', {
        fileName,
        fileSize,
        mimeType,
        workingPath
      });
    }

    // Determine optimal chunk size based on file type and size
    const chunkSize = getOptimalChunkSize(fileSize, isVideo);

    // Parse range header
    const rangeHeader = request.headers.get('range');
    let start = 0;
    let end = fileSize - 1;
    let status = 200;

    // Optimize headers for streaming
    const headers: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
      'Connection': 'keep-alive'
    };

    // Add optimized caching for videos
    if (isVideo) {
      headers['Cache-Control'] = 'public, max-age=3600';
    } else {
      headers['Cache-Control'] = 'no-cache';
    }

    // Process range requests for partial content
    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const matches = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
      if (matches) {
        start = parseInt(matches[1], 10);
        end = matches[2] ? parseInt(matches[2], 10) : Math.min(start + chunkSize - 1, fileSize - 1);

        if (start >= fileSize || start > end) {
          return new Response(null, {
            status: 416, // Range Not Satisfiable
            headers: {
              ...corsHeaders,
              'Content-Range': `bytes */${fileSize}`
            }
          });
        }

        status = 206; // Partial Content
        headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
      }
    } else if (isVideo) {
      // For video initial requests without range, send only first chunk
      end = Math.min(chunkSize - 1, fileSize - 1);
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
    }

    headers['Content-Length'] = String(end - start + 1);
    headers['Content-Disposition'] = `${download ? 'attachment' : 'inline'}; filename="${fileName}"`;

    if (debug) {
      console.log('Streaming response:', {
        status,
        contentRange: headers['Content-Range'],
        contentLength: headers['Content-Length'],
        chunkSize
      });
    }

    try {
      // Create stream using the working path
      const stream = await client.createReadStream(workingPath, {
        range: { start, end }
      });

      // Add minimal logging for monitoring
      if (debug) {
        let bytesReceived = 0;
        let lastLogTime = Date.now();

        stream.on('data', chunk => {
          bytesReceived += chunk.length;
          const now = Date.now();

          // Log every ~2 seconds or at completion
          if (now - lastLogTime > 2000 || bytesReceived >= end - start + 1) {
            console.log(`Stream progress: ${bytesReceived}/${end - start + 1} bytes (${Math.round(bytesReceived/(end-start+1)*100)}%)`);
            lastLogTime = now;
          }
        });

        stream.on('end', () => console.log('Stream ended successfully'));
      }

      // Convert Node.js stream to Web stream and return response
      return new Response(nodeStreamToWebReadable(stream), {
        status,
        headers
      });

    } catch (streamErr: any) {
      console.error('Stream creation error:', streamErr.message);
      return new Response(JSON.stringify({
        error: 'Stream error',
        message: streamErr.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } catch (err: any) {
    console.error('General error:', err.message);
    return new Response(JSON.stringify({
      error: 'Server error',
      message: err.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}