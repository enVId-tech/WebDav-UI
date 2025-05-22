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
import sharp from 'sharp';

// Add cache directory for transcoded segments and processed images
const TRANSCODE_CACHE_DIR = path.join(os.tmpdir(), 'video-transcode-cache');
const IMAGE_CACHE_DIR = path.join(os.tmpdir(), 'image-process-cache');
const TEXT_CACHE_DIR = path.join(os.tmpdir(), 'text-cache');

// Ensure text cache directory exists
if (!fs.existsSync(TEXT_CACHE_DIR)) {
  fs.mkdirSync(TEXT_CACHE_DIR, { recursive: true });
}
if (!fs.existsSync(TRANSCODE_CACHE_DIR)) {
  fs.mkdirSync(TRANSCODE_CACHE_DIR, { recursive: true });
}
if (!fs.existsSync(IMAGE_CACHE_DIR)) {
  fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });
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

// Image optimization settings
const IMAGE_PREVIEW_SETTINGS = {
  maxWidth: 1920,
  maxHeight: 1080,
  jpegQuality: 85,
  webpQuality: 80,
  avifQuality: 75,
  gifMaxSize: 5 * 1024 * 1024 // 5MB
};

// Audio streaming settings
const AUDIO_SETTINGS = {
  chunkSize: 256 * 1024, // 256KB chunks for audio
  supportedFormats: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac']
};

// Text file settings
const TEXT_SETTINGS = {
  maxSize: 5 * 1024 * 1024, // 5MB max size for in-browser viewing
  defaultEncoding: 'utf-8',
  supportedFormats: ['txt', 'json', 'xml', 'md', 'js', 'jsx', 'ts', 'tsx', 'css', 'yaml', 'yml', 'html', 'htm', 'csv']
};

// PDF file settings
const PDF_SETTINGS = {
  maxSize: 20 * 1024 * 1024, // 20MB max size for in-browser viewing
};

// Office document settings
const DOCUMENT_SETTINGS = {
  maxSize: 15 * 1024 * 1024, // 15MB max size for in-browser viewing
  supportedFormats: ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'pdf']
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

// Generate cache key for processed images
function getImageCacheKey(
    filePath: string,
    width: number,
    height: number,
    format: string
): string {
  const hash = crypto.createHash('md5')
      .update(`${filePath}-${width}-${height}-${format}`)
      .digest('hex');
  return path.join(IMAGE_CACHE_DIR, hash);
}

// Process image with optimization and resizing
async function optimizeImage(
    inputStream: Readable,
    format: string,
    maxWidth: number,
    maxHeight: number,
    quality: number
): Promise<{ stream: Readable, format: string, contentType: string }> {
  return new Promise((resolve, reject) => {
    // Collect input stream into a buffer
    const chunks: Buffer[] = [];
    inputStream.on('data', chunk => chunks.push(Buffer.from(chunk)));
    inputStream.on('error', reject);
    inputStream.on('end', async () => {
      try {
        const buffer = Buffer.concat(chunks);
        let outputFormat = format;
        let outputContentType = '';

        let sharpInstance = sharp(buffer);
        const metadata = await sharpInstance.metadata();

        // Resize only if the image is larger than limits
        if ((metadata.width && metadata.width > maxWidth) ||
            (metadata.height && metadata.height > maxHeight)) {
          sharpInstance = sharpInstance.resize({
            width: maxWidth,
            height: maxHeight,
            fit: 'inside',
            withoutEnlargement: true
          });
        }

        // Process based on format
        if (format === 'jpeg' || format === 'jpg') {
          sharpInstance = sharpInstance.jpeg({ quality });
          outputContentType = 'image/jpeg';
        } else if (format === 'webp') {
          sharpInstance = sharpInstance.webp({ quality });
          outputContentType = 'image/webp';
        } else if (format === 'avif') {
          sharpInstance = sharpInstance.avif({ quality });
          outputContentType = 'image/avif';
        } else if (format === 'png') {
          sharpInstance = sharpInstance.png({ compressionLevel: 9 });
          outputContentType = 'image/png';
        } else if (format === 'gif') {
          // Just pass through GIFs for now
          outputContentType = 'image/gif';
        } else {
          // Default to JPEG for unsupported formats
          sharpInstance = sharpInstance.jpeg({ quality });
          outputFormat = 'jpeg';
          outputContentType = 'image/jpeg';
        }

        // Convert to buffer and stream
        const outputBuffer = await sharpInstance.toBuffer();
        const outputStream = Readable.from(outputBuffer);

        resolve({
          stream: outputStream,
          format: outputFormat,
          contentType: outputContentType
        });
      } catch (err) {
        reject(err);
      }
    });
  });
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

// Function to process and optimize images
async function prepareImageOptimization(
    client: any,
    path: string,
    format: string,
    fileSize: number,
    bandwidth: 'low' | 'medium' | 'high',
    debug: boolean,
    requestId: string
): Promise<{ stream: Readable, contentType: string } | null> {
  // Don't optimize small images or SVGs
  if (fileSize < 50 * 1024 || format === 'svg') {
    if (debug) console.log(`[${requestId}] Image optimization skipped: format=${format}, size=${fileSize}`);
    return null;
  }

  // Determine optimal dimensions based on bandwidth
  let maxWidth = IMAGE_PREVIEW_SETTINGS.maxWidth;
  let maxHeight = IMAGE_PREVIEW_SETTINGS.maxHeight;
  let quality = IMAGE_PREVIEW_SETTINGS.jpegQuality;

  if (bandwidth === 'low') {
    maxWidth = 1280;
    maxHeight = 720;
    quality = 75;
  } else if (bandwidth === 'medium') {
    maxWidth = 1600;
    maxHeight = 900;
    quality = 80;
  }

  if (debug) console.log(`[${requestId}] Preparing image optimization: format=${format}, maxWidth=${maxWidth}, maxHeight=${maxHeight}`);

  // Check cache first
  const cacheKey = getImageCacheKey(path, maxWidth, maxHeight, format);
  if (fs.existsSync(cacheKey)) {
    if (debug) console.log(`[${requestId}] Using cached optimized image: ${cacheKey}`);
    const stream = fs.createReadStream(cacheKey);
    const contentType = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
    return { stream, contentType };
  }

  try {
    // Create input stream for the image file
    const inputStream = await createResilientStream(client, path, {});

    // Process image
    if (debug) console.log(`[${requestId}] Starting image optimization`);
    const { stream, contentType } = await optimizeImage(
        inputStream,
        format,
        maxWidth,
        maxHeight,
        quality
    );

    // Cache the result (if possible)
    try {
      const chunks: Buffer[] = [];
      const passThrough = new (require('stream').PassThrough)();

      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        passThrough.write(chunk);
      });

      stream.on('end', () => {
        passThrough.end();
        fs.writeFile(cacheKey, Buffer.concat(chunks), (err) => {
          if (err && debug) console.log(`[${requestId}] Failed to cache image: ${err.message}`);
        });
      });

      return { stream: passThrough, contentType };
    } catch (err: any) {
      // If caching fails, still return the optimized stream
      if (debug) console.log(`[${requestId}] Image cache setup failed: ${err.message}`);
      return { stream, contentType };
    }
  } catch (err) {
    console.error(`[${requestId}] Image optimization failed:`, err);
    return null;
  }
}

// Process audio file for optimized streaming
async function prepareAudioStreaming(
    client: any,
    path: string,
    format: string,
    fileSize: number,
    range: { start: number, end: number },
    debug: boolean,
    requestId: string
): Promise<Readable> {
  // For now, just create a stream with the appropriate range
  // In the future, this could be enhanced with audio transcoding for optimal streaming
  const options: any = {};

  // For audio, we use specific chunk sizes based on format
  const audioChunkSize = AUDIO_SETTINGS.chunkSize;
  if (range.start !== 0 || range.end !== fileSize - 1) {
    options.range = {
      start: range.start,
      end: Math.min(range.start + audioChunkSize - 1, range.end)
    };
  }

  if (debug) console.log(`[${requestId}] Preparing audio stream: format=${format}, range=${range.start}-${range.end}`);

  return createResilientStream(client, path, options);
}

// Text format detection helper
function detectTextFormat(fileName: string, mimeType: string): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (mimeType.startsWith('text/')) return ext || 'txt';
  if (['json', 'xml', 'md', 'js', 'jsx', 'ts', 'tsx', 'css', 'yaml', 'yml', 'html', 'htm', 'csv'].includes(ext)) {
    return ext;
  }

  return null;
}

// Document format detection helper
function detectDocumentFormat(fileName: string, mimeType: string): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'pdf'].includes(ext)) {
    return ext;
  }

  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.includes('wordprocessing') || mimeType.includes('msword')) return 'doc';
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'xls';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'ppt';

  return null;
}

// Generate cache key for text files
function getTextCacheKey(filePath: string, encoding: string): string {
  const hash = crypto.createHash('md5')
      .update(`${filePath}-${encoding}`)
      .digest('hex');
  return path.join(os.tmpdir(), 'text-cache', hash);
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
    fileType: 'video' | 'image' | 'audio' | 'other',
    isHls: boolean = false,
    bandwidth: 'low' | 'medium' | 'high' = 'medium',
    format?: string
): number {
  // For audio files, use the audio-specific settings
  if (fileType === 'audio') {
    return AUDIO_SETTINGS.chunkSize;
  }

  // For images, use smaller chunks
  if (fileType === 'image') {
    return Math.min(fileSize, 1024 * 1024); // Cap at 1MB for images
  }

  if (fileType !== 'video') {
    return Math.min(fileSize, 2 * 1024 * 1024); // Cap at 2MB for non-video
  }

  // Format-specific optimizations for video
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

// Enhanced file type detection
function detectFileType(fileName: string, mimeType: string): 'video' | 'image' | 'audio' | 'other' {
  if (mimeType.startsWith('video/') || mimeType === 'application/mp4') return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';

  // Check extensions for cases where mime type might be incorrect
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(ext || '')) return 'video';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'].includes(ext || '')) return 'image';
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext || '')) return 'audio';

  return 'other';
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

// Image format detection helper
function detectImageFormat(fileName: string, mimeType: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (ext === 'jpg' || ext === 'jpeg' || mimeType === 'image/jpeg') return 'jpeg';
  if (ext === 'png' || mimeType === 'image/png') return 'png';
  if (ext === 'webp' || mimeType === 'image/webp') return 'webp';
  if (ext === 'gif' || mimeType === 'image/gif') return 'gif';
  if (ext === 'svg' || mimeType === 'image/svg+xml') return 'svg';
  if (ext === 'avif' || mimeType === 'image/avif') return 'avif';

  // Default to jpeg for unknown formats
  return 'jpeg';
}

// Audio format detection helper
function detectAudioFormat(fileName: string, mimeType: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (ext === 'mp3' || mimeType === 'audio/mpeg') return 'mp3';
  if (ext === 'wav' || mimeType === 'audio/wav') return 'wav';
  if (ext === 'ogg' || mimeType === 'audio/ogg') return 'ogg';
  if (ext === 'flac' || mimeType === 'audio/flac') return 'flac';
  if (ext === 'm4a' || mimeType === 'audio/mp4') return 'm4a';
  if (ext === 'aac' || mimeType === 'audio/aac') return 'aac';

  // Default to mp3 for unknown formats
  return 'mp3';
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

// Process text content
async function prepareTextContent(
    inputStream: Readable,
    encoding: string = 'utf-8',
    fileSize: number,
    maxSize: number
): Promise<{ stream: Readable, contentType: string }> {
  return new Promise((resolve, reject) => {
    // For large text files, we'll only load the beginning portion
    const chunks: Buffer[] = [];
    let bytesRead = 0;
    const isTruncated = fileSize > maxSize;

    inputStream.on('data', chunk => {
      chunks.push(Buffer.from(chunk));
      bytesRead += chunk.length;

      // Stop reading if we exceed the max size
      if (bytesRead > maxSize && isTruncated) {
        inputStream.destroy();
      }
    });

    inputStream.on('error', reject);

    inputStream.on('end', async () => {
      try {
        let content = Buffer.concat(chunks);

        // Add a warning if the file was truncated
        if (isTruncated && bytesRead > maxSize) {
          const warningMessage = Buffer.from("\n\n--- File truncated due to size limits ---");
          content = Buffer.concat([content, warningMessage]);
        }

        // Convert to Readable stream
        const resultStream = new Readable();
        resultStream.push(content);
        resultStream.push(null); // End of stream

        resolve({
          stream: resultStream,
          contentType: `text/plain; charset=${encoding}`
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}

// Process PDF content
async function preparePDFContent(
    inputStream: Readable,
    fileSize: number
): Promise<{ stream: Readable, contentType: string }> {
  // For PDFs, we just pass through the stream with the proper content type
  return {
    stream: inputStream,
    contentType: 'application/pdf'
  };
}

// Prepare text file for viewing
async function prepareTextViewing(
    client: any,
    path: string,
    fileSize: number,
    debug: boolean,
    requestId: string
): Promise<{ stream: Readable, contentType: string } | null> {
  try {
    // Check if file is too large for direct viewing
    const maxTextSize = TEXT_SETTINGS.maxSize;
    const isTruncated = fileSize > maxTextSize;

    if (debug) {
      console.log(`[${requestId}] Preparing text file: size=${fileSize} bytes, truncated=${isTruncated}`);
    }

    // Generate cache key
    const cacheKey = getTextCacheKey(path, TEXT_SETTINGS.defaultEncoding);

    // Check cache first
    if (fs.existsSync(cacheKey)) {
      if (debug) console.log(`[${requestId}] Using cached text file: ${cacheKey}`);
      const cachedStream = fs.createReadStream(cacheKey);
      return {
        stream: cachedStream,
        contentType: 'text/plain; charset=utf-8'
      };
    }

    // Create input stream
    const fileStream = await createResilientStream(client, path, {});

    // Process the content
    const result = await prepareTextContent(
        fileStream,
        TEXT_SETTINGS.defaultEncoding,
        fileSize,
        maxTextSize
    );

    // Cache the processed text
    const outputStream = fs.createWriteStream(cacheKey);
    result.stream.pipe(outputStream);

    // Create a new stream for the response (since the original was consumed by the cache)
    const responseStream = fs.createReadStream(cacheKey);

    return {
      stream: responseStream,
      contentType: result.contentType
    };
  } catch (err: any) {
    console.error(`[${requestId}] Error preparing text file: ${err.message}`);
    return null;
  }
}

// Prepare PDF for viewing
async function preparePDFViewing(
    client: any,
    path: string,
    fileSize: number,
    debug: boolean,
    requestId: string
): Promise<{ stream: Readable, contentType: string } | null> {
  try {
    // Check if file is too large for browser viewing
    if (fileSize > PDF_SETTINGS.maxSize) {
      if (debug) console.log(`[${requestId}] PDF too large for browser viewing: ${fileSize} bytes`);
      // We'll still return the stream, but frontend should warn about large PDFs
    }

    // Create a stream for the PDF file
    if (debug) console.log(`[${requestId}] Fetching PDF file: ${path}`);
    const fileStream = await createResilientStream(client, path, {});

    // Process the PDF (currently just passing through)
    return await preparePDFContent(fileStream, fileSize);
  } catch (err: any) {
    console.error(`[${requestId}] Error preparing PDF file: ${err.message}`);
    return null;
  }
}

// Prepare document for viewing
async function prepareDocumentViewing(
    client: any,
    path: string,
    format: string,
    fileSize: number,
    debug: boolean,
    requestId: string
): Promise<{ stream: Readable, contentType: string } | null> {
  // For documents, we just stream the file with proper content type
  // The frontend will need to use appropriate viewers
  try {
    // Check if file is too large for browser viewing
    if (fileSize > DOCUMENT_SETTINGS.maxSize) {
      if (debug) console.log(`[${requestId}] Document too large for browser viewing: ${fileSize} bytes`);
      // Still return the stream, but frontend should warn about large documents
    }

    // Only process supported formats
    if (!DOCUMENT_SETTINGS.supportedFormats.includes(format)) {
      if (debug) console.log(`[${requestId}] Unsupported document format: ${format}`);
      return null;
    }

    // Create a stream for the document
    if (debug) console.log(`[${requestId}] Fetching document: ${path}, format: ${format}`);
    const fileStream = await createResilientStream(client, path, {});

    // Determine content type based on format
    let contentType = 'application/octet-stream';
    if (format === 'pdf') contentType = 'application/pdf';
    else if (['doc', 'docx'].includes(format)) contentType = 'application/msword';
    else if (['xls', 'xlsx'].includes(format)) contentType = 'application/vnd.ms-excel';
    else if (['ppt', 'pptx'].includes(format)) contentType = 'application/vnd.ms-powerpoint';
    else if (format === 'odt') contentType = 'application/vnd.oasis.opendocument.text';
    else if (format === 'ods') contentType = 'application/vnd.oasis.opendocument.spreadsheet';
    else if (format === 'odp') contentType = 'application/vnd.oasis.opendocument.presentation';

    return {
      stream: fileStream,
      contentType
    };
  } catch (err: any) {
    console.error(`[${requestId}] Error preparing document: ${err.message}`);
    return null;
  }
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
  // Option for image optimization
  const optimizeImages = searchParams.get('optimizeImages') !== 'false';

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
  const fileType = detectFileType(fileName, mimeType);
  const isVideo = fileType === 'video';
  const isImage = fileType === 'image';
  const isAudio = fileType === 'audio';
  const videoFormat = isVideo ? detectVideoFormat(fileName, mimeType) : null;
  const imageFormat = isImage ? detectImageFormat(fileName, mimeType) : null;
  const audioFormat = isAudio ? detectAudioFormat(fileName, mimeType) : null;
  const textFormat = detectTextFormat(fileName, mimeType);
  const documentFormat = detectDocumentFormat(fileName, mimeType);
  const isPDF = mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf');
  const isText = mimeType.startsWith('text/') || textFormat !== null;
  const isDocument = documentFormat !== null && !isPDF;
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
    } else if (isImage) {
      agentOptions.keepAliveMsecs = 500;
      agentOptions.maxFreeSockets = 8;
    } else if (isAudio) {
      agentOptions.keepAliveMsecs = 1000;
      agentOptions.maxFreeSockets = 4;
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
        fileType,
        videoFormat,
        imageFormat,
        audioFormat,
        workingPath,
        clientBandwidth,
        compressRequested: compress
      });
    }

    // Get quality configuration
    const qualityConfig = getQualityParams(quality, clientBandwidth, videoFormat);

    // Determine optimal chunk size with improved parameters
    const chunkSize = getOptimalChunkSize(fileSize, fileType, isHls, clientBandwidth, videoFormat || undefined);

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

    // Add type-specific headers
    if (isImage) {
      headers['Cache-Control'] = 'public, max-age=86400'; // Cache images for a day
      if (mimeType === 'image/svg+xml') {
        // Add security header for SVG files
        headers['Content-Security-Policy'] = "script-src 'none'";
      }
    } else if (isAudio) {
      headers['Cache-Control'] = 'public, max-age=3600'; // Cache audio for an hour
    } else if (isVideo) {
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
    } else if (isVideo || isAudio) {
      // For video/audio initial requests without range, optimize initial chunk
      const initialChunkSize = isHls ? chunkSize : Math.min(chunkSize / 2, 256 * 1024);
      end = Math.min(initialChunkSize - 1, fileSize - 1);
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
    }

    headers['Content-Length'] = String(end - start + 1);
    headers['Content-Disposition'] = `${download ? 'attachment' : 'inline'}; filename="${encodeURIComponent(fileName)}"`;

    try {
      if (debug) console.log(`[${requestId}] Creating stream for range: ${start}-${end} (${end-start+1} bytes)`);

      let responseStream: Readable | null = null;
      let finalStatus = status;
      let finalHeaders = { ...headers };

      // Media type-specific handling
      if (isVideo && compress) {
        // Video compression
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
          responseStream = stream;

          // Update headers for compressed video
          finalHeaders['Content-Type'] = newMimeType;
          if (compressedSize) {
            finalHeaders['Content-Length'] = String(compressedSize);

            // If this was a range request but we're returning the full file, update headers
            if (status === 206) {
              if (start === 0 && compressedSize <= end - start + 1) {
                finalStatus = 200;
                delete finalHeaders['Content-Range'];
              } else {
                finalHeaders['Content-Range'] = `bytes 0-${compressedSize-1}/${compressedSize}`;
              }
            }
          }

          // Add compression info headers
          finalHeaders['X-Video-Compressed'] = 'true';
          finalHeaders['X-Video-Quality'] = quality;
          finalHeaders['X-Original-Size'] = String(fileSize);

          if (debug) console.log(`[${requestId}] Serving compressed video: quality=${quality}, size=${compressedSize}`);
        }
      } else if (isImage && optimizeImages) {
        // Image optimization
        if (imageFormat && imageFormat !== 'svg') { // Skip SVG optimization
          const imageResult = await prepareImageOptimization(
              client,
              workingPath,
              imageFormat,
              fileSize,
              clientBandwidth,
              debug,
              requestId
          );

          if (imageResult) {
            responseStream = imageResult.stream;
            finalHeaders['Content-Type'] = imageResult.contentType;

            // Dynamic content length will be handled by the compression step
            delete finalHeaders['Content-Length'];

            if (status === 206) {
              // Image optimization processes the whole image, so we change to 200 OK
              finalStatus = 200;
              delete finalHeaders['Content-Range'];
            }

            // Add optimization info
            finalHeaders['X-Image-Optimized'] = 'true';

            if (debug) console.log(`[${requestId}] Serving optimized image: format=${imageFormat}`);
          }
        }
      } else if (isAudio) {
        // Audio streaming optimization
        if (audioFormat) {
          responseStream = await prepareAudioStreaming(
              client,
              workingPath,
              audioFormat,
              fileSize,
              { start, end },
              debug,
              requestId
          );

          // No need to update headers, as we're still serving the original audio
          if (debug) console.log(`[${requestId}] Serving optimized audio stream: format=${audioFormat}`);
        }
      } else if (isText) {
        // Text file viewing
        if (textFormat) {
          const textResult = await prepareTextViewing(
              client,
              workingPath,
              fileSize,
              debug,
              requestId
          );

          if (textResult) {
            responseStream = textResult.stream;
            finalHeaders['Content-Type'] = textResult.contentType;

            // For text we typically return the full content
            if (status === 206) {
              finalStatus = 200;
              delete finalHeaders['Content-Range'];
              delete finalHeaders['Content-Length']; // Will be set by text processor
            }

            if (debug) console.log(`[${requestId}] Serving text file: format=${textFormat}`);
          }
        }
      } else if (isPDF) {
        // PDF file viewing
        const pdfResult = await preparePDFViewing(
            client,
            workingPath,
            fileSize,
            debug,
            requestId
        );

        if (pdfResult) {
          responseStream = pdfResult.stream;
          finalHeaders['Content-Type'] = pdfResult.contentType;

          // Add PDF viewer specific headers
          finalHeaders['X-Content-Type-Options'] = 'nosniff';

          if (debug) console.log(`[${requestId}] Serving PDF file of size ${fileSize} bytes`);
        }
      } else if (isDocument) {
        // Document file viewing
        if (documentFormat) {
          const docResult = await prepareDocumentViewing(
              client,
              workingPath,
              documentFormat,
              fileSize,
              debug,
              requestId
          );

          if (docResult) {
            responseStream = docResult.stream;
            finalHeaders['Content-Type'] = docResult.contentType;

            if (debug) console.log(`[${requestId}] Serving document file: format=${documentFormat}`);
          }
        }
      }

      // If no specialized processing was done, create a standard stream
      if (!responseStream) {
        responseStream = await createResilientStream(client, workingPath, {
          range: { start, end }
        }, 3);
      }

      // Apply compression for non-media content if supported
      const useCompression = supportsCompression(request) &&
          !isVideo && !isImage && !isAudio &&
          (end - start + 1) > 1024;

      if (useCompression) {
        const compressionLevel = (end - start + 1) > 1024 * 1024 ? 4 : 6;
        const gzip = zlib.createGzip({ level: compressionLevel });
        responseStream = responseStream.pipe(gzip);

        finalHeaders['Content-Encoding'] = 'gzip';
        finalHeaders['Vary'] = 'Accept-Encoding';
        delete finalHeaders['Content-Length'];
      }

      // Add detailed monitoring for debug mode
      if (debug) {
        const logInterval = Math.max(500, Math.min(5000, fileSize / 10000));
        let bytesReceived = 0;
        let lastLogTime = Date.now();
        let peakThroughput = 0;
        let minThroughput = Number.MAX_VALUE;

        responseStream.on('data', chunk => {
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

        responseStream.on('end', () => {
          const totalTime = (Date.now() - startTime) / 1000;
          console.log(`[${requestId}] Stream complete: ${totalTime.toFixed(2)}s, Peak: ${peakThroughput.toFixed(2)} KB/s, Min: ${
              minThroughput === Number.MAX_VALUE ? 'N/A' : minThroughput.toFixed(2)
          } KB/s`);
        });
      }

      // Convert Node.js stream to Web stream and return response
      return new Response(nodeStreamToWebReadable(responseStream), {
        status: finalStatus,
        headers: finalHeaders
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

// Helper functions
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