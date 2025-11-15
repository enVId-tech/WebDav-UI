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
  '360p': {
    videoBitrate: '400k',
    audioBitrate: '64k',
    width: 640,
    height: 360,
    scale: '640:360',
    preset: 'veryfast',
    crf: 28,
    label: '360p (Low)'
  },
  '480p': {
    videoBitrate: '800k',
    audioBitrate: '96k',
    width: 854,
    height: 480,
    scale: '854:480',
    preset: 'fast',
    crf: 25,
    label: '480p (Medium)'
  },
  '720p': {
    videoBitrate: '1800k',
    audioBitrate: '128k',
    width: 1280,
    height: 720,
    scale: '1280:720',
    preset: 'medium',
    crf: 23,
    label: '720p (HD)'
  },
  '1080p': {
    videoBitrate: '3500k',
    audioBitrate: '192k',
    width: 1920,
    height: 1080,
    scale: '1920:1080',
    preset: 'medium',
    crf: 21,
    label: '1080p (Full HD)'
  },
  original: {
    label: 'Original Quality'
  }
} as const;

export type VideoQuality = keyof typeof VIDEO_QUALITY_PRESETS;

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
