import { lookup } from "mime-types";

/**
 * Detect file type from filename and MIME type
 */
// export function detectFileType(fileName: string, mimeType: string): 'video' | 'image' | 'audio' | 'other' {
//   if (mimeType.startsWith('video/') || mimeType === 'application/mp4') return 'video';
//   if (mimeType.startsWith('image/')) return 'image';
//   if (mimeType.startsWith('audio/')) return 'audio';
//
//   // Check extensions for cases where mime type might be incorrect
//   const ext = fileName.split('.').pop()?.toLowerCase();
//   if (['mp4', 'webm', 'mkv', 'avi', 'mov'].includes(ext || '')) return 'video';
//   if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif'].includes(ext || '')) return 'image';
//   if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(ext || '')) return 'audio';
//
//   return 'other';
// }

/**
 * Detect video format from filename and MIME type
 */
export function detectVideoFormat(fileName: string, mimeType: string): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase();

  if (ext === 'mp4' || mimeType === 'video/mp4') return 'mp4';
  if (ext === 'webm' || mimeType === 'video/webm') return 'webm';
  if (ext === 'mkv') return 'mkv';
  if (ext === 'avi') return 'avi';
  if (ext === 'm3u8' || ext === 'ts') return 'hls';

  return null;
}

/**
 * Detect image format from filename and MIME type
 */
export function detectImageFormat(fileName: string, mimeType: string): string {
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

/**
 * Detect audio format from filename and MIME type
 */
export function detectAudioFormat(fileName: string, mimeType: string): string {
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

/**
 * Detect text format from filename and MIME type
 */
export function detectTextFormat(fileName: string, mimeType: string): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  if (mimeType.startsWith('text/')) return ext || 'txt';
  if (['json', 'xml', 'md', 'js', 'jsx', 'ts', 'tsx', 'css', 'yaml', 'yml', 'html', 'htm', 'csv'].includes(ext)) {
    return ext;
  }

  return null;
}

/**
 * Detect document format from filename and MIME type
 */
export function detectDocumentFormat(fileName: string, mimeType: string): string | null {
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

/**
 * Detect database format from filename and MIME type
 */
export function detectDatabaseFormat(fileName: string, mimeType: string): string | null {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  // SQLite databases
  if (['db', 'sqlite', 'sqlite3', 'db3', 's3db', 'sl3'].includes(ext)) {
    return 'sqlite';
  }

  // Other database formats that might need special handling
  if (['mdb', 'accdb'].includes(ext)) {
    return 'access';
  }

  // Check MIME type
  if (mimeType === 'application/x-sqlite3' || 
      mimeType === 'application/vnd.sqlite3' ||
      mimeType === 'application/x-sqlite-db') {
    return 'sqlite';
  }

  return null;
}
