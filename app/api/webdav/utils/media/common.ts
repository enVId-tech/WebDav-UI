import { Readable } from 'stream';
import https from 'https';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import sharp from 'sharp';
import { spawn } from 'child_process';
import { TRANSCODE_CACHE_DIR, IMAGE_CACHE_DIR, VIDEO_QUALITY_PRESETS } from '../config/constants';

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

/**
 * Create a stream from WebDAV with retry and error handling
 */
export async function createResilientStream(
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

/**
 * Get optimal chunk size for streaming
 */
export function getOptimalChunkSize(
  fileSize: number,
  fileType: 'video' | 'image' | 'audio' | 'other',
  isHls: boolean = false,
  bandwidth: 'low' | 'medium' | 'high' = 'medium',
  format?: string
): number {
  // For audio files, use the audio-specific settings
  if (fileType === 'audio') {
    return Math.min(fileSize, 256 * 1024); // 256KB for audio
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

/**
 * Generate cache key for transcoded videos
 */
export function getTranscodeCacheKey(
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

/**
 * Generate cache key for processed images
 */
export function getImageCacheKey(
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

/**
 * Get quality parameters for media streaming
 */
export function getQualityParams(
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

/**
 * Determine if video should be compressed
 */
export function shouldCompressVideo(
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
