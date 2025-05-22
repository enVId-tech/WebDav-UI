import { Readable } from 'stream';
import { spawn } from 'child_process';
import fs from 'fs';
import { VIDEO_QUALITY_PRESETS } from '../config/constants';
import { getTranscodeCacheKey, createResilientStream } from './common';

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
  // Determine if we should compress this video (imported from original function)
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
