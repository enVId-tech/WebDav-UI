import { Readable } from 'stream';
import sharp from 'sharp';
import fs from 'fs';
import { getImageCacheKey, createResilientStream } from './common';
import { IMAGE_PREVIEW_SETTINGS } from '../config/constants';

/**
 * Process image with optimization and resizing
 */
export async function optimizeImage(
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

/**
 * Prepare image optimization
 */
export async function prepareImageOptimization(
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
      const { PassThrough } = require('stream');
      const passThrough = new PassThrough();

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
  } catch (err: any) {
    console.error(`[${requestId}] Image optimization failed:`, err);
    return null;
  }
}

/**
 * Process audio file for optimized streaming
 */
export async function prepareAudioStreaming(
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
  const audioChunkSize = 256 * 1024; // Default chunk size for audio
  if (range.start !== 0 || range.end !== fileSize - 1) {
    options.range = {
      start: range.start,
      end: Math.min(range.start + audioChunkSize - 1, range.end)
    };
  }

  if (debug) console.log(`[${requestId}] Preparing audio stream: format=${format}, range=${range.start}-${range.end}`);

  return createResilientStream(client, path, options);
}
