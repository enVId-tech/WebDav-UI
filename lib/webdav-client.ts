type DirectoryItem = {
    filename: string;
    basename: string;
    type: 'file' | 'directory';
    size: number;
    lastmod: string;
}

export async function getDirectoryContents(path = '/', sharePath = '/etran'): Promise<DirectoryItem[]> {
  try {
    console.log(`Path: ${path}`);
    console.log(`Share Path: ${sharePath}`);

    const request = await fetch(`/api/webdav/${sharePath}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ path, sharePath }),
    });

    if (!request.ok) {
      throw new Error(`Failed to fetch directory contents: ${request.statusText}`);
    }

    const data = await request.json();

    console.log('Directory contents:', data);

    // Map the response to the expected format
    return data.map((item: any) => ({
      filename: item.name,
      basename: item.name,
      type: item.type,
      size: item.size,
      lastmod: new Date(item.lastModified).toLocaleString(),
    }));
  } catch (error: any) {
    console.error('WebDAV client error:', error);
    throw new Error(`WebDAV error: ${error.message || 'Unknown error'}`);
  }
}

