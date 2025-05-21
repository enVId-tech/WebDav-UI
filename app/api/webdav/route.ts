import { NextRequest } from 'next/server';
import { Readable } from 'stream';
import https from 'https';
import { lookup } from "mime-types";
import webdavService from '@/lib/webdav-server';
import { createClient, FileStat, ResponseDataDetailed } from 'webdav';
import zlib from 'zlib';

// Enhanced headers optimized for video streaming
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
  'Access-Control-Allow-Headers': 'Range,Content-Type,Authorization,Accept-Encoding',
  'Access-Control-Expose-Headers': 'Content-Range,Accept-Ranges,Content-Length,Content-Type,Content-Encoding',
  'Access-Control-Max-Age': '86400',
  'Timing-Allow-Origin': '*' // Allow client-side performance measurement
};

// Security headers to protect content
const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'autoplay=self'
};

// Bandwidth estimation based on client hints
function estimateBandwidth(request: NextRequest): 'low' | 'medium' | 'high' {
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

// Improved chunk size calculation with bandwidth consideration
function getOptimalChunkSize(
    fileSize: number,
    isVideo: boolean,
    isHls: boolean = false,
    bandwidth: 'low' | 'medium' | 'high' = 'medium',
    format?: string
): number {
  if (!isVideo) return Math.min(fileSize, 2 * 1024 * 1024); // Cap at 2MB for non-video

  // Format-specific optimizations
  if (isHls) return 128 * 1024; // HLS segments
  if (format === 'mp4' && bandwidth === 'high') return 2 * 1024 * 1024; // MP4 streaming

  // Bandwidth-aware chunk sizing
  const sizeMap = {
    low: {
      small: 128 * 1024,      // 128KB
      medium: 256 * 1024,     // 256KB
      large: 512 * 1024,      // 512KB
      xlarge: 1024 * 1024     // 1MB
    },
    medium: {
      small: 256 * 1024,      // 256KB
      medium: 512 * 1024,     // 512KB
      large: 1024 * 1024,     // 1MB
      xlarge: 2 * 1024 * 1024 // 2MB
    },
    high: {
      small: 512 * 1024,      // 512KB
      medium: 1024 * 1024,    // 1MB
      large: 2 * 1024 * 1024, // 2MB
      xlarge: 4 * 1024 * 1024 // 4MB
    }
  };

  // Choose size based on file size and bandwidth
  if (fileSize > 1024 * 1024 * 1024) return sizeMap[bandwidth].xlarge;
  if (fileSize > 100 * 1024 * 1024) return sizeMap[bandwidth].large;
  if (fileSize > 20 * 1024 * 1024) return sizeMap[bandwidth].medium;
  return sizeMap[bandwidth].small;
}

// Backpressure-aware stream handling
async function createResilientStream(
    client: any,
    path: string,
    options: any,
    maxRetries = 3,
    retryDelay = 1000
): Promise<Readable> {
  let attempts = 0;
  let lastError: Error | null = null;

  while (attempts < maxRetries) {
    try {
      const stream = await client.createReadStream(path, options);
      let isActive = false;
      let lastDataTime = Date.now();

      // Handle backpressure and stalled connections
      const watchdog = setInterval(() => {
        const now = Date.now();
        // If we've been inactive for too long but stream is supposed to be active
        if (isActive && now - lastDataTime > 15000) {
          console.warn('Stream stalled - destroying connection');
          clearInterval(watchdog);
          stream.destroy(new Error('Stream stalled'));
        }
      }, 5000);

      // Track activity
      stream.on('data', () => {
        isActive = true;
        lastDataTime = Date.now();
      });

      stream.on('end', () => {
        isActive = false;
        clearInterval(watchdog);
      });

      stream.on('error', () => {
        clearInterval(watchdog);
      });

      // Add memory usage tracking for large streams
      if (options.range && (options.range.end - options.range.start) > 10 * 1024 * 1024) {
        let totalBytes = 0;
        stream.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          // Log memory stats every 10MB
          if (totalBytes % (10 * 1024 * 1024) === 0) {
            const memUsage = process.memoryUsage();
            console.log(`Memory usage after ${totalBytes/(1024*1024)}MB: RSS=${Math.round(memUsage.rss/1024/1024)}MB, Heap=${Math.round(memUsage.heapUsed/1024/1024)}MB`);
          }
        });
      }

      return stream;
    } catch (err: any) {
      lastError = err;
      attempts++;
      console.warn(`Stream creation attempt ${attempts}/${maxRetries} failed: ${err.message}`);

      // Exponential backoff with jitter for retry
      const jitter = Math.random() * 200;
      const delay = retryDelay * Math.pow(1.5, attempts - 1) + jitter;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error('Failed to create stream after multiple attempts');
}

// Format detection helper
function detectVideoFormat(fileName: string, mimeType: string): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase();

  if (ext === 'mp4' || mimeType === 'video/mp4') return 'mp4';
  if (ext === 'webm' || mimeType === 'video/webm') return 'webm';
  if (ext === 'mkv') return 'mkv';
  if (ext === 'avi') return 'avi';
  if (ext === 'm3u8' || ext === 'ts') return 'hls';

  return null;
}

// Adaptive quality selection based on client capabilities and bandwidth
function getQualityParams(
    quality: string,
    bandwidth: 'low' | 'medium' | 'high',
    format: string | null
): { priority: 'speed' | 'quality', initialBuffer: number } {
  // Default values
  let result = { priority: 'quality' as const, initialBuffer: 5000 };

  if (quality === 'low' || bandwidth === 'low') {
    result.priority = 'speed';
    result.initialBuffer = 10000; // Longer initial buffer for low bandwidth
  } else if (quality === 'auto') {
    // Adaptive based on bandwidth and format
    if (bandwidth === 'high') {
      result.priority = 'quality';
      result.initialBuffer = 3000;
    } else {
      result.priority = 'speed';
      result.initialBuffer = 5000;
    }
  }

  // Format-specific adjustments
  if (format === 'hls') {
    // HLS needs smaller buffer since it's already segmented
    result.initialBuffer = Math.max(2000, result.initialBuffer / 2);
  }

  return result;
}

// Generate adaptive streaming hints
function getStreamingHints(
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

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log('WebDAV request received:', request.url);

  // Enhanced request tracking with ID
  const requestId = Math.random().toString(36).substring(2, 10);
  console.log(`[${requestId}] Processing request: ${request.url}`);

  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get('path');
  const rawShare = searchParams.get('sharePath');
  const isFile = searchParams.get('isFile') === 'true';
  const download = searchParams.get('download') === 'true';
  const debug = searchParams.get('debug') === 'true';
  const quality = searchParams.get('quality') || 'auto';

  if (!rawPath || !rawShare) {
    return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
      status: 400,
      headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Bandwidth estimation
  const clientBandwidth = estimateBandwidth(request);
  if (debug) console.log(`[${requestId}] Estimated client bandwidth: ${clientBandwidth}`);

  // Path processing logic
  const decodedPath = decodeURIComponent(rawPath);
  const decodedShare = decodeURIComponent(rawShare);
  const cleanedPath = decodedPath.replace(/^etran\//i, '');
  const fullPath = `${decodedShare.replace(/\/$/, '')}/${cleanedPath.replace(/^\//, '')}`;

  const fileName = cleanedPath.split('/').pop() || 'file';
  const mimeType = lookup(fileName) || 'application/octet-stream';
  const isVideo = mimeType.startsWith('video/') || mimeType === 'application/mp4';
  const videoFormat = isVideo ? detectVideoFormat(fileName, mimeType) : null;
  const isHls = videoFormat === 'hls';

  try {
    // Enhanced client with optimized settings based on content type
    const serverUrl = process.env.WEBDAV_URL || 'https://192.168.1.89:30001';

    // Adjust agent settings based on content type
    const agentOptions: https.AgentOptions = {
      rejectUnauthorized: false,
      keepAlive: true,
      maxSockets: isVideo ? 4 : 10, // Fewer concurrent sockets for video to prevent overload
      timeout: isVideo ? 120000 : 60000, // Longer timeout for video
    };

    // Further optimize keepalive settings based on content
    if (isVideo) {
      agentOptions.keepAliveMsecs = 5000; // Longer keepalive for video
      agentOptions.maxFreeSockets = 2;    // Keep fewer idle sockets
    } else {
      agentOptions.keepAliveMsecs = 1000;
      agentOptions.maxFreeSockets = 5;
    }

    const client = createClient(serverUrl, {
      username: process.env.WEBDAV_USERNAME || '',
      password: process.env.WEBDAV_PASSWORD || '',
      httpsAgent: new https.Agent(agentOptions)
    });

    // Directory listing handling
    if (!isFile) {
      webdavService.updateUrl(serverUrl);
      console.log(`[${requestId}] Fetching directory: ${fullPath}`);
      const items = await webdavService.getDirectoryContents(fullPath);
      return new Response(JSON.stringify(items), {
        status: 200,
        headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
      });
    }

    // File path resolution with enhanced path handling
    let stats = null;
    let workingPath = '';
    // Add more path variants to try - handle Windows/Unix path differences
    const pathVariants = [
      fullPath,
      cleanedPath,
      fullPath.replace(/^\/+/, ''),
      fullPath.replace(/\//g, '\\'),
      cleanedPath.replace(/\//g, '\\')
    ];

    for (const path of pathVariants) {
      try {
        if (debug) console.log(`[${requestId}] Trying path: ${path}`);
        stats = await client.stat(path);
        workingPath = path;
        if (debug) console.log(`[${requestId}] Path success: ${path}`);
        break;
      } catch (err: any) {
        if (debug) console.log(`[${requestId}] Path failed: ${path}, Error: ${err.message}`);
      }
    }

    if (!stats) {
      console.error(`[${requestId}] File not found after trying multiple paths`);
      return new Response(JSON.stringify({
        error: 'File not found',
        triedPaths: pathVariants
      }), {
        status: 404,
        headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get file size
    const fileSize = isDetailedStat(stats) ? stats.data.size : stats.size;

    if (debug) {
      console.log(`[${requestId}] File stats:`, {
        fileName,
        fileSize,
        mimeType,
        videoFormat,
        workingPath,
        clientBandwidth
      });
    }

    // Get quality configuration
    const qualityConfig = getQualityParams(quality, clientBandwidth, videoFormat);

    // Determine optimal chunk size with improved parameters
    const chunkSize = getOptimalChunkSize(fileSize, isVideo, isHls, clientBandwidth, videoFormat || undefined);

    // Parse range header with enhanced validation
    const rangeHeader = request.headers.get('range');
    let start = 0;
    let end = fileSize - 1;
    let status = 200;

    // Core headers
    const headers: Record<string, string> = {
      ...corsHeaders,
      ...securityHeaders,
      'Content-Type': mimeType,
      'Accept-Ranges': 'bytes',
      'Connection': 'keep-alive'
    };

    // Add optimized caching and video streaming headers
    if (isVideo) {
      // Format-specific caching
      if (isHls) {
        headers['Cache-Control'] = 'public, max-age=86400, immutable'; // HLS segments are immutable
      } else if (videoFormat === 'mp4') {
        headers['Cache-Control'] = 'public, max-age=3600'; // 1 hour for MP4
      } else {
        headers['Cache-Control'] = 'public, max-age=1800'; // 30 min for other formats
      }

      // Add streaming hints
      const streamingHints = getStreamingHints(request, fileName, fileSize, videoFormat, clientBandwidth);
      Object.assign(headers, streamingHints);

      // Add timing allow origin for performance metrics
      headers['Timing-Allow-Origin'] = '*';
    } else {
      headers['Cache-Control'] = 'no-cache';
    }

    // Process range requests with enhanced validation
    if (rangeHeader && rangeHeader.startsWith('bytes=')) {
      const matches = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader);
      if (matches) {
        start = parseInt(matches[1], 10);

        // Handle end range with more intelligence
        if (matches[2]) {
          end = parseInt(matches[2], 10);
        } else {
          // Smart chunk sizing - smaller for initial chunks, larger for later chunks
          const isInitialChunk = start === 0;
          let calculatedChunkSize = chunkSize;

          if (isInitialChunk && isVideo) {
            // Smaller initial chunk for faster startup
            calculatedChunkSize = Math.min(chunkSize, 256 * 1024);
          } else if (start > fileSize / 2) {
            // Larger chunks for later parts of the file
            calculatedChunkSize = chunkSize * 1.5;
          }

          end = Math.min(start + calculatedChunkSize - 1, fileSize - 1);
        }

        // Validate range
        if (start >= fileSize || start > end || end >= fileSize) {
          return new Response(null, {
            status: 416, // Range Not Satisfiable
            headers: {
              ...corsHeaders,
              ...securityHeaders,
              'Content-Range': `bytes */${fileSize}`
            }
          });
        }

        status = 206; // Partial Content
        headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
      }
    } else if (isVideo) {
      // For video initial requests without range, optimize initial chunk
      const initialChunkSize = isHls ? chunkSize : Math.min(chunkSize / 2, 256 * 1024);
      end = Math.min(initialChunkSize - 1, fileSize - 1);
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
    }

    headers['Content-Length'] = String(end - start + 1);
    headers['Content-Disposition'] = `${download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(fileName)}"`;

    // Compression handling with format awareness
    const useCompression = supportsCompression(request) &&
        !isVideo && // Skip for all video formats
        (end - start + 1) > 1024; // Only compress responses larger than 1KB

    if (useCompression) {
      headers['Content-Encoding'] = 'gzip';
      headers['Vary'] = 'Accept-Encoding';
      delete headers['Content-Length']; // Will be set by compression
    }

    try {
      if (debug) console.log(`[${requestId}] Creating stream for range: ${start}-${end} (${end-start+1} bytes)`);

      // Use enhanced stream creation with backpressure awareness
      const stream = await createResilientStream(client, workingPath, {
        range: { start, end }
      }, 3);

      // Add adaptive monitoring based on file size
      if (debug) {
        const logInterval = Math.max(500, Math.min(5000, fileSize / 10000));
        let bytesReceived = 0;
        let lastLogTime = Date.now();
        let peakThroughput = 0;
        let minThroughput = Number.MAX_VALUE;

        stream.on('data', chunk => {
          bytesReceived += chunk.length;
          const now = Date.now();

          if (now - lastLogTime > logInterval) {
            const elapsed = (now - startTime) / 1000;
            const chunkElapsed = (now - lastLogTime) / 1000;
            const totalThroughput = bytesReceived / elapsed / 1024; // KB/s
            const chunkThroughput = chunk.length / chunkElapsed / 1024; // KB/s

            peakThroughput = Math.max(peakThroughput, chunkThroughput);
            if (chunkThroughput > 0) minThroughput = Math.min(minThroughput, chunkThroughput);

            console.log(`[${requestId}] Stream progress: ${bytesReceived}/${end - start + 1} bytes (${Math.round(bytesReceived/(end-start+1)*100)}%)`);
            console.log(`[${requestId}] Throughput: current=${chunkThroughput.toFixed(2)} KB/s, avg=${totalThroughput.toFixed(2)} KB/s, peak=${peakThroughput.toFixed(2)} KB/s`);

            lastLogTime = now;
          }
        });

        stream.on('end', () => {
          const totalTime = (Date.now() - startTime) / 1000;
          const avgThroughput = bytesReceived / totalTime / 1024;
          console.log(`[${requestId}] Stream completed in ${totalTime.toFixed(2)}s`);
          console.log(`[${requestId}] Statistics: size=${bytesReceived} bytes, avg=${avgThroughput.toFixed(2)} KB/s, peak=${peakThroughput.toFixed(2)} KB/s, min=${minThroughput === Number.MAX_VALUE ? 'N/A' : minThroughput.toFixed(2)} KB/s`);
        });
      }

      // Apply compression if needed, with optimized settings
      let responseStream = stream;
      if (useCompression) {
        const compressionLevel = (end - start + 1) > 1024 * 1024 ? 4 : 6; // Lower compression level for larger files
        const gzip = zlib.createGzip({ level: compressionLevel });
        responseStream = stream.pipe(gzip);
      }

      // Convert Node.js stream to Web stream and return response
      return new Response(nodeStreamToWebReadable(responseStream), {
        status,
        headers
      });

    } catch (streamErr: any) {
      console.error(`[${requestId}] Stream creation error:`, streamErr.message);
      return new Response(JSON.stringify({
        error: 'Stream error',
        message: streamErr.message
      }), {
        status: 500,
        headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
      });
    }
  } catch (err: any) {
    console.error(`[${requestId}] General error:`, err.message);
    return new Response(JSON.stringify({
      error: 'Server error',
      message: err.message
    }), {
      status: 500,
      headers: { ...corsHeaders, ...securityHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Helper functions remain the same
function isDetailedStat(
    stat: FileStat | ResponseDataDetailed<FileStat>
): stat is ResponseDataDetailed<FileStat> {
  return (stat as ResponseDataDetailed<FileStat>).data !== undefined;
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

function supportsCompression(request: NextRequest): boolean {
  const acceptEncoding = request.headers.get('accept-encoding') || '';
  return acceptEncoding.includes('gzip') &&
      process.env.ENABLE_COMPRESSION === 'true';
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...corsHeaders, ...securityHeaders } });
}