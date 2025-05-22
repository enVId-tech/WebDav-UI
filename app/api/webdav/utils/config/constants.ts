import os from 'os';
import path from 'path';
import fs from 'fs';

// Cache directories
export const TRANSCODE_CACHE_DIR = path.join(os.tmpdir(), 'video-transcode-cache');
export const IMAGE_CACHE_DIR = path.join(os.tmpdir(), 'image-process-cache');
export const TEXT_CACHE_DIR = path.join(os.tmpdir(), 'text-cache');

// Ensure cache directories exist
if (!fs.existsSync(TEXT_CACHE_DIR)) {
  fs.mkdirSync(TEXT_CACHE_DIR, { recursive: true });
}
if (!fs.existsSync(TRANSCODE_CACHE_DIR)) {
  fs.mkdirSync(TRANSCODE_CACHE_DIR, { recursive: true });
}
if (!fs.existsSync(IMAGE_CACHE_DIR)) {
  fs.mkdirSync(IMAGE_CACHE_DIR, { recursive: true });
}

// HTTP headers
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,OPTIONS',
  'Access-Control-Allow-Headers': 'Range,Content-Type,Authorization,Accept-Encoding',
  'Access-Control-Expose-Headers': 'Content-Range,Accept-Ranges,Content-Length,Content-Type,Content-Encoding',
  'Access-Control-Max-Age': '86400',
  'Timing-Allow-Origin': '*' // Allow client-side performance measurement
};

export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'autoplay=self'
};

// Media settings
export const VIDEO_QUALITY_PRESETS = {
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

export const IMAGE_PREVIEW_SETTINGS = {
  maxWidth: 1920,
  maxHeight: 1080,
  jpegQuality: 85,
  webpQuality: 80,
  avifQuality: 75,
  gifMaxSize: 5 * 1024 * 1024 // 5MB
};

export const AUDIO_SETTINGS = {
  chunkSize: 256 * 1024, // 256KB chunks for audio
  supportedFormats: ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac']
};

export const TEXT_SETTINGS = {
  maxSize: 5 * 1024 * 1024, // 5MB max size for in-browser viewing
  defaultEncoding: 'utf-8',
  supportedFormats: ['txt', 'json', 'xml', 'md', 'js', 'jsx', 'ts', 'tsx', 'css', 'yaml', 'yml', 'html', 'htm', 'csv']
};

export const PDF_SETTINGS = {
  maxSize: 20 * 1024 * 1024, // 20MB max size for in-browser viewing
};

export const DOCUMENT_SETTINGS = {
  maxSize: 15 * 1024 * 1024, // 15MB max size for in-browser viewing
  supportedFormats: ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'pdf']
};
