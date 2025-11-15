import https from "https";
import http from "http";
import { URL } from "url";

// Create connection pools for better performance
const httpsAgent = new https.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 30000,
    rejectUnauthorized: false // For development with self-signed certs
});

const httpAgent = new http.Agent({
    keepAlive: true,
    keepAliveMsecs: 30000,
    maxSockets: 50,
    maxFreeSockets: 10,
    timeout: 30000
});

/**
 * Stream a file from WebDAV server with Range support
 * This bypasses the webdav library to make direct HTTP requests with Range headers
 * Uses connection pooling and keep-alive for better performance
 */
export async function streamFileWithRange(
    webdavUrl: string,
    filePath: string,
    start: number,
    end: number,
    username?: string,
    password?: string
): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        
        try {
            // Construct full URL
            const fullUrl = new URL(filePath, webdavUrl).toString();
            
            const urlObj = new URL(fullUrl);
            const isHttps = urlObj.protocol === 'https:';
            const httpModule = isHttps ? https : http;
            const agent = isHttps ? httpsAgent : httpAgent;
            
            const headers: Record<string, string> = {
                'Range': `bytes=${start}-${end}`,
                'Connection': 'keep-alive',
                'Accept-Encoding': 'identity', // Disable compression for video
            };
            
            // Add basic auth if credentials provided
            if (username && password) {
                const auth = Buffer.from(`${username}:${password}`).toString('base64');
                headers['Authorization'] = `Basic ${auth}`;
            }
            
            const options = {
                method: 'GET',
                headers: headers,
                agent: agent
            };
            
            const req = httpModule.get(fullUrl, options as any, (res) => {
                // Handle redirects
                if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
                    const redirectUrl = res.headers.location;
                    if (redirectUrl) {
                        console.log(`Following redirect to: ${redirectUrl}`);
                        streamFileWithRange(redirectUrl, '', start, end, username, password)
                            .then(resolve)
                            .catch(reject);
                        return;
                    }
                }
                
                // Check for authentication errors
                if (res.statusCode === 401 || res.statusCode === 403) {
                    reject(new Error(`Authentication failed: ${res.statusCode} ${res.statusMessage}`));
                    return;
                }
                
                // Check for other errors
                if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
                    reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
                    return;
                }
                
                const chunks: Buffer[] = [];
                let receivedBytes = 0;
                
                res.on('data', (chunk: Buffer) => {
                    chunks.push(chunk);
                    receivedBytes += chunk.length;
                });
                
                res.on('end', () => {
                    if (chunks.length === 0) {
                        reject(new Error('No data received from server'));
                        return;
                    }
                    
                    const buffer = Buffer.concat(chunks);
                    const elapsed = Date.now() - startTime;
                    const speedMBps = (buffer.length / 1024 / 1024) / (elapsed / 1000);
                    
                    console.log(`Streamed ${buffer.length} bytes in ${elapsed}ms (${speedMBps.toFixed(2)} MB/s, status: ${res.statusCode})`);
                    
                    // Check if we got a partial content response
                    if (res.statusCode === 206 || res.statusCode === 200) {
                        resolve(buffer);
                    } else {
                        reject(new Error(`Unexpected status code: ${res.statusCode} ${res.statusMessage}`));
                    }
                });
                
                res.on('error', (err) => {
                    console.error('Response error:', err);
                    reject(err);
                });
            });
            
            req.on('error', (err) => {
                console.error('Request error:', err);
                reject(err);
            });
            
            // Set timeout - increased for larger chunks
            req.setTimeout(60000, () => {
                req.destroy();
                reject(new Error('Request timeout (60s)'));
            });
            
            req.end();
        } catch (err) {
            console.error('Stream error:', err);
            reject(err);
        }
    });
}

/**
 * Clean up connection pools on shutdown
 */
export function destroyAgents() {
    httpsAgent.destroy();
    httpAgent.destroy();
}
