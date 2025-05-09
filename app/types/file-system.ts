export interface FileItem {
  id: string;
  name: string;
  type: 'file';
  size: number;
  lastModified: string;
  extension: string;
  url: string;
}

export interface FolderItem {
  id: string;
  name: string;
  type: 'folder';
  lastModified: string;
  items: (FileItem | FolderItem)[];
}

export type FileSystemItem = FileItem | FolderItem;