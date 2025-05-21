import { NextRequest } from 'next/server';
import { Readable } from 'stream';
import https from 'https';
import { lookup } from "mime-types";
import webdavService from '@/lib/webdav-server';
import { createClient, FileStat, ResponseDataDetailed } from 'webdav';
import zlib from 'zlib';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import os from 'os';

// Add cache directory for transcoded segments
const TRANSCODE_CACHE_DIR = path.join(os.tmpdir(), 'video-transcode-cache');
// Ensure cache directory exists
if (!fs.existsSync(TRANSCODE_CACHE_DIR)) {
  fs.mkdirSync(TRANSCODE_CACHE_DIR, { recursive: true });
}

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

// Video compression quality presets
const VIDEO_QUALITY_PRESETS = {
  low: {
    videoBitrate: '500k',
    scale: '640:-2',
    audioBitrate: '64k',
    preset: 'veryfast'
  },
  medium: {
    videoBitrate: '1000k',
    scale: '854:-2',
    audioBitrate: '96k',
    preset: 'faster'
  },
  high: {
    videoBitrate: '2500k',
    scale: '1280:-2',
    audioBitrate: '128k',
    preset: 'fast'
  },
  original: null
};

// Check if ffmpeg is available (for video transcoding)
let ffmpegAvailable = false;
try {
  const proc = spawn('ffmpeg', ['-version']);
  proc.on('close', (code) => {
    ffmpegAvailable = code === 0;
    console.log(`FFmpeg availability: ${ffmpegAvailable ? 'YES' : 'NO'}`);
  });
} catch (e) {
  console.warn('FFmpeg check failed, video transcoding will be disabled');
}

// Function to determine if video should be compressed
function shouldCompressVideo(
    format: string | null,
    fileSize: number,
    quality: string,
    bandwidth: 'low' | 'medium' | 'high'
): boolean {
  // Don't compress if ffmpeg is unavailable
  if (!ffmpegAvailable) return false;

  // Don't compress HLS - it's already optimized
  if (format === 'hls') return false;

  // Don't compress if explicitly requested original quality
  if (quality === 'original') return false;

  // Only compress supported formats
  const supportedFormats = ['mp4', 'webm', 'mkv', 'avi'];
  if (!format || !supportedFormats.includes(format)) return false;

  // Compress large videos when bandwidth is limited
  if (fileSize > 20 * 1024 * 1024 && bandwidth !== 'high') return true;

  // Compress when explicitly requested
  if (quality === 'low' || quality === 'medium') return true;

  return false;
}

// Generate cache key for transcoded videos
function getTranscodeCacheKey(
    filePath: string,
    quality: string,
    start: number,
    end: number
): string {
  const hash = crypto.createHash('md5')
      .update(`${filePath}-${quality}-${start}-${end}`)
      .digest('hex');
  return path.join(TRANSCODE_CACHE_DIR, hash);
}

// Transcode video segment with ffmpeg
function transcodeVideoSegment(
    inputStream: Readable,
    quality: 'low' | 'medium' | 'high',
    format: string,
    startByte: number,
    endByte: number,
    fileSize: number
): Promise<{ stream: Readable, fileSize: number }> {
  return new Promise((resolve, reject) => {
    const preset = VIDEO_QUALITY_PRESETS[quality];

    // Create ffmpeg process
    const ffmpeg = spawn('ffmpeg', [
      '-i', 'pipe:0',              // Input from stdin
      '-c:v', 'libx264',           // Video codec
      '-b:v', preset.videoBitrate, // Video bitrate
      '-c:a', 'aac',               // Audio codec
      '-b:a', preset.audioBitrate, // Audio bitrate
      '-vf', `scale=${preset.scale}`, // Scale video
      '-preset', preset.preset,    // Encoding speed/compression ratio
      '-movflags', 'frag_keyframe+empty_moov+faststart', // Optimize for streaming
      '-f', format === 'webm' ? 'webm' : 'mp4', // Output format
      '-y',                        // Overwrite output
      'pipe:1'                     // Output to stdout
    ]);

    let outputSize = 0;
    ffmpeg.stderr.on('data', (data) => {
      if (process.env.DEBUG_FFMPEG === 'true') {
        console.log(`[FFMPEG] ${data.toString()}`);
      }
    });

    ffmpeg.stdout.on('data', chunk => {
      outputSize += chunk.length;
    });

    ffmpeg.on('error', (err) => {
      reject(err);
    });

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    // Pipe input to ffmpeg
    inputStream.pipe(ffmpeg.stdin);

    // Return the output stream
    resolve({
      stream: ffmpeg.stdout,
      fileSize: Math.round(fileSize * 0.6) // Estimate compressed size
    });
  });
}

// Function to check and prepare video compression
async function prepareVideoCompression(
    client: any,
    path: string,
    quality: string,
    format: string | null,
    bandwidth: 'low' | 'medium' | 'high',
    fileSize: number,
    range: { start: number, end: number },
    debug: boolean,
    requestId: string
): Promise<{ stream: Readable, compressedSize: number, mimeType: string } | null> {
  // Determine if we should compress this video
  if (!shouldCompressVideo(format, fileSize, quality, bandwidth)) {
    if (debug) console.log(`[${requestId}] Video compression skipped: format=${format}, size=${fileSize}, quality=${quality}`);
    return null;
  }

  // Select quality preset based on request and bandwidth
  let selectedQuality: 'low' | 'medium' | 'high';
  if (quality === 'low') {
    selectedQuality = 'low';
  } else if (quality === 'medium') {
    selectedQuality = 'medium';
  } else if (quality === 'auto') {
    // Auto-select based on bandwidth
    selectedQuality = bandwidth === 'low' ? 'low' : (bandwidth === 'medium' ? 'medium' : 'high');
  } else {
    selectedQuality = 'high';
  }

  if (debug) console.log(`[${requestId}] Preparing video compression: quality=${selectedQuality}`);

  // Check cache first
  const cacheKey = getTranscodeCacheKey(path, selectedQuality, range.start, range.end);
  if (fs.existsSync(cacheKey)) {
    if (debug) console.log(`[${requestId}] Using cached transcoded segment: ${cacheKey}`);
    const stats = fs.statSync(cacheKey);
    const stream = fs.createReadStream(cacheKey);
    return {
      stream,
      compressedSize: stats.size,
      mimeType: format === 'webm' ? 'video/webm' : 'video/mp4'
    };
  }

  try {
    // Create input stream for full file (we need complete file for transcoding)
    const inputStream = await createResilientStream(client, path, {});

    // Start transcoding
    if (debug) console.log(`[${requestId}] Starting video transcoding with quality=${selectedQuality}`);
    const { stream, fileSize: compressedSize } = await transcodeVideoSegment(
        inputStream,
        selectedQuality,
        format || 'mp4',
        range.start,
        range.end,
        fileSize
    );

    // Cache the result (in background)
    const outputStream = stream;
    const cacheStream = fs.createWriteStream(cacheKey);

    // Create a PassThrough stream to duplicate the data
    const { PassThrough } = require('stream');
    const passThrough = new PassThrough();

    outputStream.pipe(passThrough);
    passThrough.pipe(cacheStream);

    return {
      stream: passThrough,
      compressedSize,
      mimeType: format === 'webm' ? 'video/webm' : 'video/mp4'
    };
  } catch (err) {
    console.error(`[${requestId}] Video transcoding failed:`, err);
    return null;
  }
}

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
    result.initialBuffer = 10000; // Longer initial buffer for low bandwidth
  } else if (quality === 'auto') {
    // Adaptive based on bandwidth and format
    if (bandwidth === 'high') {
      result.priority = 'quality';
      result.initialBuffer = 3000;
    } else {
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
  // Add compress parameter, default to true
  const compress = searchParams.get('compress') !== 'false';

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
      maxSockets: isVideo ? 4 : 10,
      timeout: isVideo ? 120000 : 60000,
    };

    // Further optimize keepalive settings based on content
    if (isVideo) {
      agentOptions.keepAliveMsecs = 5000;
      agentOptions.maxFreeSockets = 2;
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
        clientBandwidth,
        compressRequested: compress
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
        headers['Cache-Control'] = 'public, max-age=86400, immutable';
      } else if (videoFormat === 'mp4') {
        headers['Cache-Control'] = 'public, max-age=3600';
      } else {
        headers['Cache-Control'] = 'public, max-age=1800';
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
          const requestedEnd = parseInt(matches[2], 10);
          end = Math.min(requestedEnd, fileSize - 1);
        } else {
          // If no end specified, limit chunk size based on content type
          end = Math.min(start + chunkSize - 1, fileSize - 1);
        }

        // Validate range
        if (start >= fileSize || start > end || end >= fileSize) {
          return new Response(JSON.stringify({
            error: 'Range Not Satisfiable',
            fileSize
          }), {
            status: 416,
            headers: {
              ...corsHeaders,
              ...securityHeaders,
              'Content-Type': 'application/json',
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

    try {
      if (debug) console.log(`[${requestId}] Creating stream for range: ${start}-${end} (${end-start+1} bytes)`);

      // Check if video compression should be applied
      if (isVideo && compress) {
        const compressionResult = await prepareVideoCompression(
            client,
            workingPath,
            quality,
            videoFormat,
            clientBandwidth,
            fileSize,
            { start, end },
            debug,
            requestId
        );

        if (compressionResult) {
          const { stream, compressedSize, mimeType: newMimeType } = compressionResult;

          // Update headers for compressed video
          headers['Content-Type'] = newMimeType;
          if (compressedSize) {
            // For compressed videos, we often return the full file instead of a range
            // because transcoding operates on the entire video
            headers['Content-Length'] = String(compressedSize);

            // If this was a range request but we're returning the full file, update headers
            if (status === 206) {
              // Either keep 206 status and update range, or switch to 200 if returning full file
              if (start === 0 && compressedSize <= end - start + 1) {
                // We're returning full file, switch to 200 OK
                status = 200;
                delete headers['Content-Range'];
              } else {
                // Update content range for compressed size
                headers['Content-Range'] = `bytes 0-${compressedSize-1}/${compressedSize}`;
              }
            }
          }

          // Add compression info headers
          headers['X-Video-Compressed'] = 'true';
          headers['X-Video-Quality'] = quality;
          headers['X-Original-Size'] = String(fileSize);

          if (debug) console.log(`[${requestId}] Serving compressed video: quality=${quality}, size=${compressedSize}`);

          // Return compressed video stream
          return new Response(nodeStreamToWebReadable(stream), {
            status,
            headers
          });
        } else if (debug) {
          console.log(`[${requestId}] Video compression not applied, falling back to standard streaming`);
        }
      }

      // Standard (non-compressed) stream handling
      const stream = await createResilientStream(client, workingPath, {
        range: { start, end }
      }, 3);

      // Add adaptive monitoring for larger files
      if (debug) {
        const logInterval = Math.max(500, Math.min(5000, fileSize / 10000));
        let bytesReceived = 0;
        let lastLogTime = Date.now();
        let peakThroughput = 0;
        let minThroughput = Number.MAX_VALUE;

        stream.on('data', chunk => {
          bytesReceived += chunk.length;
          const now = Date.now();
          const elapsed = now - lastLogTime;

          if (elapsed >= logInterval) {
            const throughputKBps = (bytesReceived / elapsed) * 1000 / 1024;
            peakThroughput = Math.max(peakThroughput, throughputKBps);
            if (throughputKBps > 0) minThroughput = Math.min(minThroughput, throughputKBps);

            console.log(`[${requestId}] Streaming progress: ${bytesReceived} bytes, ${throughputKBps.toFixed(2)} KB/s`);
            bytesReceived = 0;
            lastLogTime = now;
          }
        });

        stream.on('end', () => {
          const totalTime = (Date.now() - startTime) / 1000;
          console.log(`[${requestId}] Stream complete: ${totalTime.toFixed(2)}s, Peak: ${peakThroughput.toFixed(2)} KB/s, Min: ${
              minThroughput === Number.MAX_VALUE ? 'N/A' : minThroughput.toFixed(2)
          } KB/s`);
        });
      }

      // Apply compression for non-video content if supported
      let responseStream = stream;
      const useCompression = supportsCompression(request) &&
          !isVideo &&
          (end - start + 1) > 1024;

      if (useCompression) {
        const compressionLevel = (end - start + 1) > 1024 * 1024 ? 4 : 6;
        const gzip = zlib.createGzip({ level: compressionLevel });
        responseStream = stream.pipe(gzip);

        headers['Content-Encoding'] = 'gzip';
        headers['Vary'] = 'Accept-Encoding';
        delete headers['Content-Length'];
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