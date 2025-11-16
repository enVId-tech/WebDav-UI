import { NextRequest, NextResponse } from 'next/server';
import webdavService from '@/lib/webdav-server';
import dotenv from 'dotenv';

dotenv.config();

export async function POST(request: NextRequest) {
  try {
    const { path, sharePath, content } = await request.json();

    if (!path || !sharePath) {
      return NextResponse.json({ error: 'Missing path or sharePath' }, { status: 400 });
    }

    if (typeof content !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid content' }, { status: 400 });
    }

    const baseUrl = process.env.WEBDAV_URL || '';
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

    const decodedPath = decodeURIComponent(path);

    let targetUrl = `${normalizedBaseUrl}/${sharePath}`;
    if (decodedPath && decodedPath !== '/') {
      targetUrl += decodedPath.startsWith('/') ? decodedPath : `/${decodedPath}`;
    }

    console.log('[text-save] Writing to URL:', targetUrl);
    webdavService.updateUrl(targetUrl);

    const buffer = Buffer.from(content, 'utf-8');
    await webdavService.putFileContents(buffer, { overwrite: true });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in text-save handler:', error);
    const status = error.status || 500;
    const message = error.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status });
  }
}
