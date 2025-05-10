import { createClient, WebDAVClient } from 'webdav';

export function getWebDAVClient() {
  const webdavUrl = process.env.NEXT_PUBLIC_WEBDAV_URL;

  if (!webdavUrl) {
    throw new Error('WebDAV URL not configured. Please set NEXT_PUBLIC_WEBDAV_URL in .env.local');
  }

  const options: any = {};

  if (process.env.NEXT_PUBLIC_WEBDAV_USERNAME && process.env.NEXT_PUBLIC_WEBDAV_PASSWORD) {
    options.username = process.env.NEXT_PUBLIC_WEBDAV_USERNAME;
    options.password = process.env.NEXT_PUBLIC_WEBDAV_PASSWORD;
  }

  return createClient(webdavUrl, options);
}

export async function getDirectoryContents(path: string = '/', sharePath: string = '/etran') {
  const client = getWebDAVClient();
  const fullPath = path === '/' ? sharePath : `${sharePath}${path}`;

  console.log(`Requesting WebDAV path: ${fullPath}`);

  try {
    return await client.getDirectoryContents(fullPath);
  } catch (error: any) {
    console.error('WebDAV error:', error);
    if (error.status === 404) {
      throw new Error(`Path not found: ${fullPath}`);
    }
    throw error;
  }
}