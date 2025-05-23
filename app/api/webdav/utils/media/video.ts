import { Readable } from 'stream';
import { spawn } from 'child_process';
import fs from 'fs';
import { VIDEO_QUALITY_PRESETS } from '../config/constants';
import { getTranscodeCacheKey, createResilientStream } from './common';

// Reference to the ffmpeg availability from common.ts
declare const ffmpegAvailable: boolean;
declare const ffmpegChecking: boolean;

/**
 * Safely check if FFmpeg is available before proceeding
 */
async function ensureFfmpegAvailable(): Promise<boolean> {
  // If we're still checking FFmpeg availability, wait for the check to complete
  if (typeof ffmpegChecking !== 'undefined' && ffmpegChecking) {
    await new Promise<void>((resolve) => {
      // Wait up to 2 seconds for check to complete
      const timeout = setTimeout(() => resolve(), 2000);
      const interval = setInterval(() => {
        if (typeof ffmpegChecking === 'undefined' || !ffmpegChecking) {
          clearInterval(interval);
          clearTimeout(timeout);
          resolve();
        }
      }, 100);
    });
  }

  // Fallback in case the global check didn't work
  if (typeof ffmpegAvailable === 'undefined') {
    try {
      // Simple synchronous check
      const { execSync } = require('child_process');
      execSync('ffmpeg -version', { stdio: 'ignore' });
      return true;
    } catch (e: any) {
      console.warn('FFmpeg not available:', e.message);
      return false;
    }
  }

  return ffmpegAvailable;
}

/**
 * Transcode video segment with ffmpeg
 */
export function transcodeVideoSegment(
  inputStream: Readable,
  quality: 'low' | 'medium' | 'high',
  format: string,
  startByte: number,
  endByte: number,
  fileSize: number
): Promise<{ stream: Readable, fileSize: number }> {
  return new Promise(async (resolve, reject) => {
    // First check if ffmpeg is available
    const ffmpegReady = await ensureFfmpegAvailable();
    if (!ffmpegReady) {
      console.error('FFmpeg is not available for transcoding');
      return reject(new Error('FFmpeg is not installed or not found in PATH'));
    }

    const preset = VIDEO_QUALITY_PRESETS[quality];

    try {
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
      const outputChunks: Buffer[] = [];

      // Handle errors from ffmpeg
      ffmpeg.stderr.on('data', (data) => {
        if (process.env.DEBUG_FFMPEG === 'true') {
          console.log(`[FFMPEG] ${data.toString()}`);
        }
      });

      ffmpeg.stdout.on('data', chunk => {
        outputSize += chunk.length;
        outputChunks.push(chunk);
      });

      ffmpeg.on('error', (err) => {
        console.error('FFmpeg process error:', err);
        reject(err);
      });

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          return reject(new Error(`FFmpeg exited with code ${code}`));
        }

        // Create a readable stream from the collected chunks
        const resultStream = new Readable({
          read() {
            for (const chunk of outputChunks) {
              this.push(chunk);
            }
            this.push(null);
          }
        });

        resolve({
          stream: resultStream,
          fileSize: outputSize
        });
      });

      // Pipe input to ffmpeg
      inputStream.on('error', (err) => {
        console.error('Input stream error:', err);
        ffmpeg.stdin.end();
        reject(err);
      });

      inputStream.pipe(ffmpeg.stdin);
    } catch (err) {
      console.error('Error setting up FFmpeg process:', err);
      reject(err);
    }
  });
}

/**
 * Prepare and handle video compression for streaming
 */
export async function prepareVideoCompression(
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
  try {
    // Check if FFmpeg is available first
    const ffmpegReady = await ensureFfmpegAvailable();
    if (!ffmpegReady) {
      if (debug) console.log(`[${requestId}] FFmpeg not available, skipping video compression`);
      return null;
    }

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
    try {
      const cacheDir = require('path').dirname(cacheKey);
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

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
    } catch (err: any) {
      console.error(`[${requestId}] Error setting up cache:`, err.message);
      // If caching fails, still return the stream
      return {
        stream,
        compressedSize,
        mimeType: format === 'webm' ? 'video/webm' : 'video/mp4'
      };
    }
  } catch (err: any) {
    console.error(`[${requestId}] Video transcoding failed:`, err);
    return null;
  }
}

/**
 * Function imported from original code to maintain functionality
 */
function shouldCompressVideo(
  format: string | null,
  fileSize: number,
  quality: string,
  bandwidth: 'low' | 'medium' | 'high'
): boolean {
  // Check ffmpeg availability (this would be defined globally in the original file)
  let ffmpegAvailable: boolean;
  try {
    // This is a simplified check - the actual implementation would use the global variable
    ffmpegAvailable = fs.existsSync('/usr/bin/ffmpeg') || fs.existsSync('C:\\ffmpeg\\bin\\ffmpeg.exe');
  } catch {
    ffmpegAvailable = false;
  }

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
