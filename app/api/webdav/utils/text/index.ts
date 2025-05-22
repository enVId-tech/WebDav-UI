import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { createResilientStream } from '../media/common';
import { TEXT_SETTINGS, PDF_SETTINGS, DOCUMENT_SETTINGS, TEXT_CACHE_DIR } from '../config/constants';

/**
 * Generate cache key for text files
 */
export function getTextCacheKey(filePath: string, encoding: string): string {
  const hash = crypto.createHash('md5')
    .update(`${filePath}-${encoding}`)
    .digest('hex');
  return path.join(TEXT_CACHE_DIR, hash);
}

/**
 * Process text content
 */
export async function prepareTextContent(
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

/**
 * Process PDF content
 */
export async function preparePDFContent(
  inputStream: Readable,
  fileSize: number
): Promise<{ stream: Readable, contentType: string }> {
  // For PDFs, we just pass through the stream with the proper content type
  return {
    stream: inputStream,
    contentType: 'application/pdf'
  };
}

/**
 * Prepare text file for viewing
 */
export async function prepareTextViewing(
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

/**
 * Prepare PDF for viewing
 */
export async function preparePDFViewing(
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

/**
 * Prepare document for viewing
 */
export async function prepareDocumentViewing(
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
