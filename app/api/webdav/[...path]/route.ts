import { NextRequest, NextResponse } from 'next/server';

// Centralized async function to perform the fetch call
async function proxyRequest(method: string, url: string, headers: Headers, body: any) {
    console.log(`Proxying ${method} request to: ${url}`);
    console.log('Request headers:', Object.fromEntries([...headers.entries()]));
    if (body !== undefined && body !== null) {
        // Be careful logging large bodies
        console.log(`Request body (first 100 chars): ${String(body).substring(0, 100)}${String(body).length > 100 ? '...' : ''}`);
    } else {
        console.log('No request body.');
    }


    try {
        const response = await fetch(url, {
            method,
            headers,
            body, // Use the pre-read body
        });

        console.log(`WebDAV server response: ${response.status} ${response.statusText}`);

        // For success, return response with appropriate headers and body
        // Read the response body once
        const data = await response.arrayBuffer();

        // Create headers for the response back to the client
        const responseHeaders = new Headers(response.headers);
        // Remove headers that fetch or Next.js handles automatically or are not appropriate for proxying back
        ['connection', 'content-length'].forEach(header => responseHeaders.delete(header));


        // Log response body on error for debugging
        if (!response.ok) {
            // Decode error body as text for logging if possible
            try {
                const errorText = new TextDecoder().decode(data);
                console.error('Error response from WebDAV server:', errorText);
            } catch (e) {
                console.error('Error response from WebDAV server (binary or decoding error):', data);
            }
            // Still return the original data and status/headers
            return new NextResponse(data, {
                status: response.status,
                statusText: response.statusText,
                headers: responseHeaders,
            });
        }


        return new NextResponse(data, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders
        });

    } catch (error: any) {
        console.error('WebDAV proxy fetch error:', error);
        return NextResponse.json({ error: error.message || 'WebDAV server error' }, { status: 500 });
    }
}

// Helper to get WebDAV URL and construct full URL
function getWebDavUrl(params: { path: string[] }): string | null {
    const webdavUrl = process.env.WEBDAV_URL;
    if (!webdavUrl) {
        console.error('WEBDAV_URL environment variable is not set');
        return null;
    }
    // Ensure the base URL has a trailing slash if it's just a domain/ip
    // And ensure path starts with a slash. Avoid double slashes.
    const base = webdavUrl.endsWith('/') ? webdavUrl : webdavUrl + '/';
    const path = params.path.join('/');
    return `${base}${path}`;
}

// Helper to prepare common headers including auth
async function prepareHeaders(requestHeaders: Headers): Promise<Headers> {
    const headers = new Headers(requestHeaders);

    // Filter headers that shouldn't be forwarded or are handled by fetch/Next.js
    // These are typically 'Host', 'Connection', and 'Content-Length' (calculated automatically)
    // Add others if necessary based on your server/proxy setup
    ['host', 'connection', 'content-length'].forEach(header => headers.delete(header));


    // Add WebDAV authentication
    const username = process.env.WEBDAV_USERNAME;
    const password = process.env.WEBDAV_PASSWORD;

    if (username && password) {
        const auth = Buffer.from(`${username}:${password}`).toString('base64');
        headers.set('Authorization', `Basic ${auth}`);
    }

    return headers;
}


export async function GET(request: NextRequest, { params }: { params: { path: string[] } }) {
    const fullUrl = getWebDavUrl(params);
    if (!fullUrl) {
        return NextResponse.json({ error: 'WebDAV server not configured' }, { status: 500 });
    }

    // GET requests typically have no body
    const body = null; // Explicitly null or undefined

    const headers = await prepareHeaders(request.headers);

    return await proxyRequest('GET', fullUrl, headers, body);
}

export async function PROPFIND(request: NextRequest, { params }: { params: { path: string[] } }) {
    const fullUrl = getWebDavUrl(params);
    if (!fullUrl) {
        return NextResponse.json({ error: 'WebDAV server not configured' }, { status: 500 });
    }

    let body = null;
    try {
        body = await request.text();
    } catch (e) {
        console.warn('Could not read PROPFIND request body:', e);
    }

    const headers = await prepareHeaders(request.headers);

    // Ensure required headers are set
    headers.set('Content-Type', 'text/xml; charset="utf-8"');
    if (!headers.has('Depth')) {
        headers.set('Depth', '1');
    }

    // Log the final request details for debugging
    console.log('PROPFIND Request Details:', {
        url: fullUrl,
        headers: Object.fromEntries(headers.entries()),
        body: body ? body.substring(0, 100) : 'No body',
    });
    // Add validation for the constructed URL
    if (!fullUrl.startsWith('http')) {
        console.error('Invalid WebDAV URL:', fullUrl);
        return NextResponse.json({ error: 'Invalid WebDAV URL' }, { status: 400 });
    }

    return await proxyRequest('PROPFIND', fullUrl, headers, body);
}

// Add other WebDAV methods as needed (e.g., PUT, DELETE, MKCOL, COPY, MOVE, LOCK, UNLOCK)
// Remember to handle bodies for methods like PUT, COPY (potentially XML body), MOVE (potentially XML body), LOCK (XML body)

/*
export async function PUT(request: NextRequest, { params }: { params: { path: string[] } }) {
    const fullUrl = getWebDavUrl(params);
    if (!fullUrl) {
        return NextResponse.json({ error: 'WebDAV server not configured' }, { status: 500 });
    }

    // PUT requests have a body (the file content). Read it as ArrayBuffer for general file types.
    let body = null;
     try {
        body = await request.arrayBuffer(); // Read body as binary data
        // You might also want to log size/type instead of content for large bodies
     } catch (e) {
        console.error('Error reading PUT request body:', e);
        return NextResponse.json({ error: 'Failed to read request body' }, { status: 400 });
     }

    const headers = await prepareHeaders(request.headers);

    // Content-Type should ideally come from the client request headers and be preserved by prepareHeaders.
    // If not, you might need to infer or set a default here.

    return await proxyRequest('PUT', fullUrl, headers, body);
}
 */

// ... add other methods like DELETE, MKCOL, COPY, MOVE, LOCK, UNLOCK
