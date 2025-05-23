// filepath: a:\JS-TS\Web Apps\WebDavUI\app\components\FileExplorer\types.ts
export type FileItem = {
  filename: string;
  basename: string;
  type: 'file' | 'directory';
  size: number;
  lastmod: string;
  relativePath?: string;
};

export type FolderNode = {
  name: string;
  path: string;
  children: FolderNode[];
  isExpanded: boolean;
  isLoaded: boolean;
};

