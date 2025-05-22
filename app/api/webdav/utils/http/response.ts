import { NextRequest } from 'next/server';
import { Readable } from 'stream';
import { corsHeaders, securityHeaders } from '../config/constants';
import { FileStat, ResponseDataDetailed } from 'webdav';

/**
 * Helper function to check if a stat object is detailed
 */
export function isDetailedStat(
  stat: FileStat | ResponseDataDetailed<FileStat>
): stat is ResponseDataDetailed<FileStat> {
  return (stat as ResponseDataDetailed<FileStat>).data !== undefined;
}

/**
 * Convert Node.js ReadableStream to Web ReadableStream
 */
export function nodeStreamToWebReadable(nodeStream: Readable): ReadableStream<Uint8Array> {
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

/**
 * Check if the client supports compression
 */
export function supportsCompression(request: NextRequest): boolean {
  const acceptEncoding = request.headers.get('accept-encoding') || '';
  return acceptEncoding.includes('gzip') &&
    process.env.ENABLE_COMPRESSION === 'true';
}

/**
 * Create standard headers for responses
 */
export function createResponseHeaders(
  mimeType: string,
  fileName: string,
  download: boolean,
  fileSize: number,
  isPartial: boolean = false,
  start: number = 0,
  end: number = 0
): Record<string, string> {
  const headers: Record<string, string> = {
    ...corsHeaders,
    ...securityHeaders,
    'Content-Type': mimeType,
    'Accept-Ranges': 'bytes',
    'Connection': 'keep-alive',
    'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(fileName)}"`
  };

  if (isPartial) {
    headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
    headers['Content-Length'] = String(end - start + 1);
  } else {
    headers['Content-Length'] = String(fileSize);
  }

  return headers;
}

/**
 * Bandwidth estimation based on client hints
 */
export function estimateBandwidth(request: NextRequest): 'low' | 'medium' | 'high' {
  const downlink = request.headers.get('downlink');
  const ect = request.headers.get('ect'); // Effective Connection Type

  if (downlink && !isNaN(Number(downlink))) {
    const mbps = Number(downlink);
    if (mbps < 1) return 'low';
    if (mbps < 5) return 'medium';
    return 'high';
  }

  if (ect === '2g' || ect === 'slow-2g') return 'low';
  if (ect === '3g') return 'medium';

  // Default to medium if we can't determine
  return 'medium';
}

/**
 * Parse range header from request
 */
export function parseRange(
  request: NextRequest,
  fileSize: number
): { start: number, end: number, isPartial: boolean } {
  const rangeHeader = request.headers.get('range');
  let start = 0;
  let end = fileSize - 1;
  let isPartial = false;

  if (rangeHeader && rangeHeader.startsWith('bytes=')) {
    const matches = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
    if (matches) {
      start = parseInt(matches[1], 10);

      if (matches[2]) {
        const requestedEnd = parseInt(matches[2], 10);
        end = Math.min(requestedEnd, fileSize - 1);
      }

      // Validate range
      if (start >= fileSize || start > end || end >= fileSize) {
        return { start: 0, end: fileSize - 1, isPartial: false };
      }

      isPartial = true;
    }
  }

  return { start, end, isPartial };
}

/**
 * Generate streaming hints for different media types
 */
export function getStreamingHints(
  request: NextRequest,
  fileName: string,
  fileSize: number,
  format: string | null,
  bandwidth: 'low' | 'medium' | 'high'
): Record<string, string> {
  const hints: Record<string, string> = {};

  // Add preload hints for video
  if (format === 'mp4' || format === 'webm') {
    // Suggest browser to preload metadata
    hints['Link'] = `<${request.url}>; rel=preload; as=video`;
  } else if (format === 'hls') {
    // For HLS, suggest preloading the playlist
    hints['Link'] = `<${request.url}>; rel=preload; as=fetch`;
  }

  // Add playback hints based on file size and bandwidth
  if (fileSize > 1024 * 1024 * 100 && bandwidth !== 'high') {
    // Large file with limited bandwidth - suggest conservative buffering
    hints['X-Playback-Strategy'] = 'conservative';
  } else if (bandwidth === 'high') {
    // High bandwidth - suggest aggressive preloading
    hints['X-Playback-Strategy'] = 'aggressive';
  }

  return hints;
}

/**
 * Add appropriate cache headers based on content type
 */
export function addCacheHeaders(
  headers: Record<string, string>,
  fileType: 'video' | 'image' | 'audio' | 'other',
  format: string | null = null
): Record<string, string> {
  const result = { ...headers };

  if (fileType === 'image') {
    result['Cache-Control'] = 'public, max-age=86400'; // Cache images for a day
    if (result['Content-Type'] === 'image/svg+xml') {
      // Add security header for SVG files
      result['Content-Security-Policy'] = "script-src 'none'";
    }
  } else if (fileType === 'audio') {
    result['Cache-Control'] = 'public, max-age=3600'; // Cache audio for an hour
  } else if (fileType === 'video') {
    // Format-specific caching
    if (format === 'hls') {
      result['Cache-Control'] = 'public, max-age=86400, immutable';
    } else if (format === 'mp4') {
      result['Cache-Control'] = 'public, max-age=3600';
    } else {
      result['Cache-Control'] = 'public, max-age=1800';
    }

    // Add timing allow origin for performance metrics
    result['Timing-Allow-Origin'] = '*';
  } else {
    result['Cache-Control'] = 'no-cache';
  }

  return result;
}
