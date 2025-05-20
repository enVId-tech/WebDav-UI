import { NextRequest } from 'next/server';
import { createClient, FileStat, ResponseDataDetailed } from 'webdav';
import { Readable } from 'stream';
import https from 'https';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Range,Content-Type',
  'Access-Control-Expose-Headers': 'Content-Range,Accept-Ranges,Content-Length'
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

function nodeStreamToWebReadable(nodeStream: Readable): ReadableStream {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', chunk => controller.enqueue(chunk));
      nodeStream.on('end', () => controller.close());
      nodeStream.on('error', err => controller.error(err));
    }
  });
}

function isDetailedStat(
    stat: FileStat | ResponseDataDetailed<FileStat>
): stat is ResponseDataDetailed<FileStat> {
  return (stat as ResponseDataDetailed<FileStat>).data !== undefined;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawPath = searchParams.get('path');
  const rawShare = searchParams.get('sharePath');
  const isFile = searchParams.get('isFile') === 'true';
  const download = searchParams.get('download') === 'true';

  if (!rawPath || !rawShare) {
    return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const decodedPath = decodeURIComponent(rawPath);
  const decodedShare = decodeURIComponent(rawShare);
  const fullPath = decodedShare.replace(/\/$/, '') + '/' + decodedPath.replace(/^\//, '');

  try {
    const client = createClient('https://192.168.1.89:30001', {
      username: process.env.WEBDAV_USERNAME || 'username',
      password: process.env.WEBDAV_PASSWORD || 'password',
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    });

    if (!isFile) {
      const items = await client.getDirectoryContents(fullPath);
      return new Response(JSON.stringify(items), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const stats = await client.stat(fullPath);
    if (!stats) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const fileStat = isDetailedStat(stats) ? stats.data : stats;
    const size = fileStat.size;
    const rangeHeader = request.headers.get('range') || '';
    let start = 0;
    let end = size - 1;
    let status = 200;

    const headers: Record<string,string> = {
      ...corsHeaders,
      'Content-Type': fileStat.props?.getcontenttype || 'application/octet-stream',
      'Accept-Ranges': 'bytes'
    };

    if (rangeHeader.startsWith('bytes=')) {
      const [, s, e] = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader)!;
      start = parseInt(s, 10);
      if (e) end = parseInt(e, 10);
      if (start > end || end >= size) {
        return new Response(null, { status: 416, headers: corsHeaders });
      }
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
      headers['Content-Length'] = String(end - start + 1);
    } else {
      headers['Content-Length'] = String(size);
    }

    headers['Content-Disposition'] = `${download ? 'attachment' : 'inline'}; filename="${decodedPath.split('/').pop()}"`;

    // use the built-in range option
    const stream = await client.createReadStream(fullPath, { range: { start, end } });

    return new Response(nodeStreamToWebReadable(stream), { status, headers });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}