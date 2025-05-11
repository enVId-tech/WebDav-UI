// lib/webdav-client.ts
export async function getDirectoryContents(path = '/', sharePath = '/etran') {
  try {
    // Normalize path handling - important for WebDAV
    const normalizedPath = sharePath + (path === '/' ? '' : path);

    console.log(`Requesting WebDAV directory: ${normalizedPath}`);

    // Add detailed logging for debugging
    console.log('Normalized Path:', normalizedPath);
    console.log('PROPFIND Request Body:', `<?xml version="1.0" encoding="utf-8"?>\n<D:propfind xmlns:D="DAV:">\n  <D:allprop/>\n</D:propfind>`);
    console.log('Request Headers:', {
      'Content-Type': 'application/xml',
      'Depth': '1'
    });
    // Log the full request URL
    console.log('Request URL:', `/api/webdav${normalizedPath}`);

    // Adjusted PROPFIND request body to ensure compliance with WebDAV standards
    const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:">
  <D:prop>
    <D:displayname/>
    <D:getcontentlength/>
    <D:getlastmodified/>
    <D:resourcetype/>
  </D:prop>
</D:propfind>`;

    console.log('Adjusted PROPFIND Request Body:', propfindBody);

    const response = await fetch(`/api/webdav${normalizedPath}`, {
      method: 'PROPFIND',
      headers: {
        'Content-Type': 'application/xml',
        'Depth': '1'
      },
      body: propfindBody
    });

    // Log response headers and body for debugging
    if (!response.ok) {
      const text = await response.text();
      console.error(`WebDAV error (${response.status}):`, text);
      console.error('Response Headers:', Object.fromEntries(response.headers.entries()));
      if (!text) {
        console.error('Empty response body received.');
      }
      throw new Error(`Server returned ${response.status}: ${response.statusText}`);
    }

    // Process XML response here
    const xmlText = await response.text();
    console.log(`WebDAV response received (${xmlText.length} bytes)`);

    // Return placeholder data while debugging
    return [
      {
        filename: normalizedPath + "/example-folder",
        basename: "example-folder",
        lastmod: new Date().toISOString(),
        size: 0,
        type: "directory"
      }
    ];
  } catch (error: any) {
    console.error('WebDAV client error:', error);
    throw new Error(`WebDAV error: ${error.message || 'Unknown error'}`);
  }
}

