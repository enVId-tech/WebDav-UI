import { NextRequest } from 'next/server';
import { Readable } from 'stream';
import https from 'https';
import { lookup } from "mime-types";
import webdavService from '@/lib/webdav-server';
import { createClient } from 'webdav';
import zlib from 'zlib';

// Import utility modules
import {
  corsHeaders,
  securityHeaders
} from './utils/config/constants';

import {
  detectFileType,
  detectVideoFormat,
  detectImageFormat,
  detectAudioFormat,
  detectTextFormat,
  detectDocumentFormat
} from './utils/file/detection';

import {
  nodeStreamToWebReadable,
  supportsCompression,
  isDetailedStat,
  estimateBandwidth,
  createResponseHeaders,
  parseRange,
  addCacheHeaders,
  getStreamingHints
} from './utils/http/response';

import {
  createResilientStream,
  getOptimalChunkSize,
  getQualityParams
} from './utils/media/common';

import {
  prepareVideoCompression
} from './utils/media/video';

import {
  prepareImageOptimization,
  prepareAudioStreaming
} from './utils/media/image-audio';

import {
  prepareTextViewing,
  preparePDFViewing,
  prepareDocumentViewing
} from './utils/text';

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
    const { start, end, isPartial } = parseRange(request, fileSize);
    let status = isPartial ? 206 : 200;

    // Core headers
    let headers = createResponseHeaders(
      mimeType,
      fileName,
      download,
      fileSize,
      isPartial,
      start,
      end
    );

    // Add content type specific headers
    headers = addCacheHeaders(headers, fileType, isVideo ? videoFormat : null);

    // For video, add streaming hints
    if (isVideo) {
      const streamingHints = getStreamingHints(request, fileName, fileSize, videoFormat, clientBandwidth);
      Object.assign(headers, streamingHints);
    }

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

export function OPTIONS() {
  return new Response(null, { status: 204, headers: { ...corsHeaders, ...securityHeaders } });
}

