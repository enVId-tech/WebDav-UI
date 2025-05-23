// filepath: a:\JS-TS\Web Apps\WebDavUI\app\components\FileExplorer\utils.ts
import { lookup } from "mime-types";

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${sizes[i]}`;
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
};

export const getFileIcon = (filename: string): string => {
  const mimeType = lookup(filename) || 'application/octet-stream';
  const category = mimeType.split('/')[0];
  const specific = mimeType.split('/')[1];

  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('wordprocessing') || mimeType.includes('document')) return '📝';
  if (mimeType.includes('spreadsheet') || specific === 'csv') return '📊';
  if (category === 'image') return '🖼️';
  if (category === 'video') return '🎬';
  if (category === 'audio') return '🎵';
  if (mimeType.includes('compressed') || mimeType.includes('zip') ||
      mimeType.includes('archive')) return '📦';
  return '📄'; // Default icon
};

export const getEnhancedFileIcon = (filename: string): string => {
  const mimeType = lookup(filename) || 'application/octet-stream';
  const category = mimeType.split('/')[0];

  if (mimeType === 'application/pdf') {
    return '<svg width="60" height="60" viewBox="0 0 24 24"><path fill="#e74c3c" d="M12 16h1v-3h-1v3zm-2.5-3h1v3h-1v-3zm5 0h1v3h-1v-3zm4.5-12h-14c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2v-12c0-1.1-.9-2-2-2zm0 14h-10l-2 2v-2h-2v-12h14v12z"/></svg>';
  }
  if (mimeType.includes('wordprocessing') || mimeType.includes('document') ||
      mimeType === 'application/msword' || mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    return '<svg width="60" height="60" viewBox="0 0 24 24"><path fill="#2a5699" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm2 14h-3v-2h3v2zm0-4h-8v-2h8v2zm-6-4V4l6 6h-6z"/></svg>';
  }
  if (mimeType.includes('spreadsheet') || mimeType.includes('csv') ||
      mimeType === 'application/vnd.ms-excel' || mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
    return '<svg width="60" height="60" viewBox="0 0 24 24"><path fill="#1d6f42" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 13h-4v-1h4v1zm3-3H8v-1h8v1zm0-3H8V8h8v1z"/></svg>';
  }
  if (category === 'video') {
    return '<svg width="60" height="60" viewBox="0 0 24 24"><path fill="#8e44ad" d="M4 6h16v12H4V6m15 11V7H5v10h14zM13 8l5 4-5 4V8z"/></svg>';
  }
  if (category === 'audio') {
    return '<svg width="60" height="60" viewBox="0 0 24 24"><path fill="#3498db" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6zm-2 16c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>';
  }
  if (category === 'image') {
    return '<svg width="60" height="60" viewBox="0 0 24 24"><path fill="#27ae60" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
  }
  if (mimeType.includes('compressed') || mimeType.includes('zip') || mimeType.includes('archive')) {
    return '<svg width="60" height="60" viewBox="0 0 24 24"><path fill="#f39c12" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-2 16h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V8h2v2zm0-4h-2V4h2v2zm4 12h-2v-6h2v6z"/></svg>';
  }
  return '<svg width="60" height="60" viewBox="0 0 24 24"><path fill="#95a5a6" d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/></svg>'; // Default file icon
};

