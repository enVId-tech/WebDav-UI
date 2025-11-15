import https from "https";
import http from "http";
import { URL } from "url";

/**
 * Stream a file from WebDAV server with Range support
 * This bypasses the webdav library to make direct HTTP requests with Range headers
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
        try {
            // Construct full URL
            const fullUrl = new URL(filePath, webdavUrl).toString();
            console.log(`Direct Range request to: ${fullUrl} (bytes ${start}-${end})`);
            
            const urlObj = new URL(fullUrl);
            const isHttps = urlObj.protocol === 'https:';
            const httpModule = isHttps ? https : http;
            
            const headers: Record<string, string> = {
                'Range': `bytes=${start}-${end}`
            };
            
            // Add basic auth if credentials provided
            if (username && password) {
                const auth = Buffer.from(`${username}:${password}`).toString('base64');
                headers['Authorization'] = `Basic ${auth}`;
            }
            
            const options = {
                method: 'GET',
                headers: headers,
                // For development - accept self-signed certificates
                rejectUnauthorized: false
            };
            
            const req = httpModule.get(fullUrl, options as any, (res) => {
                // Handle redirects
                if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
                    const redirectUrl = res.headers.location;
                    if (redirectUrl) {
                        console.log(`Following redirect to: ${redirectUrl}`);
                        // Recursively follow redirect
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
                
                const chunks: Buffer[] = [];
                
                res.on('data', (chunk: Buffer) => {
                    chunks.push(chunk);
                });
                
                res.on('end', () => {
                    if (chunks.length === 0) {
                        reject(new Error('No data received from server'));
                        return;
                    }
                    
                    const buffer = Buffer.concat(chunks);
                    console.log(`Received ${buffer.length} bytes (status: ${res.statusCode})`);
                    
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
            
            // Set timeout
            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            req.end();
        } catch (err) {
            console.error('Stream error:', err);
            reject(err);
        }
    });
}
