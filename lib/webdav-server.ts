import { createClient, WebDAVClient } from "webdav";
import https from "https";
import { streamFileWithRange } from "./webdav-stream";

/**
 * WebDAV Service
 * This service provides methods to interact with a WebDAV server.
 * It uses the `webdav` package to create a client and perform operations.
 *
 * @class WebDavService
 * @constructor
 * @param {string} webdavUrl - The URL of the WebDAV server.
 */
class WebDavService {
    private client: WebDAVClient;
    private currentUrl: string;    
    
    public constructor(webdavUrl: string) {
        this.client = this.createClientWithOptions(webdavUrl);
        this.currentUrl = webdavUrl;
    }    
    
    private createClientWithOptions(url: string): WebDAVClient {
        return createClient(url, {
            // For development only - disable SSL certificate validation
            httpsAgent: new https.Agent({
                rejectUnauthorized: false
            })
        });
    }

    /**
     * Get the current URL of the WebDAV server.
     * @param {string} newUrl - The new URL to set.
     * @returns {boolean} - Whether the URL has successfully updated
     */
    public updateUrl(newUrl: string): boolean {
        if (newUrl !== this.currentUrl) {
            console.log(`Updating WebDAV client URL from ${this.currentUrl} to ${newUrl}`);
            this.currentUrl = newUrl;
            this.client = this.createClientWithOptions(newUrl);
        }

        return this.currentUrl == newUrl;
    }

    /**
     * Get the current directory contents from the WebDAV server.
     * @param {string} path - The path to the directory. Defaults to '/'.
     */
    public async getDirectoryContents(path: string = '/'): Promise<any[]> {
        const contents = await this.client.getDirectoryContents(path);
        return Array.isArray(contents) ? contents : contents.data; // Ensure it returns an array
    }

    async getFileContents(filePath?: string): Promise<Buffer> {
        try {
            // If a specific file path is provided, use it. Otherwise, use currentUrl
            let pathToFetch: string;
            
            if (filePath) {
                pathToFetch = filePath;
            } else {
                // Extract the path from the current URL
                const baseUrl = process.env.WEBDAV_URL || "https://webdav.etran.dev/";
                let extractedPath = this.currentUrl;
                
                if (this.currentUrl.startsWith(baseUrl)) {
                    extractedPath = this.currentUrl.substring(baseUrl.length);
                } else {
                    // If the URL doesn't start with base URL, try to extract path from URL object
                    const url = new URL(this.currentUrl);
                    extractedPath = url.pathname;
                }
                
                pathToFetch = extractedPath;
            }
            
            // Clean up the path: remove double slashes and ensure single leading slash
            pathToFetch = pathToFetch.replace(/\/+/g, '/'); // Replace multiple slashes with single slash
            
            // Ensure the path starts with /
            if (!pathToFetch.startsWith('/')) {
                pathToFetch = '/' + pathToFetch;
            }
            
            console.log(`Fetching file with path: ${pathToFetch}`);            // Use the webdav client's getFileContents method with the extracted path
            const contents = await this.client.getFileContents(pathToFetch);
            
            // Always return a Buffer for consistency
            if (contents instanceof ArrayBuffer) {
                return Buffer.from(contents);
            } else if (contents instanceof Buffer) {
                return contents;
            } else if (contents && typeof contents === 'object' && 'buffer' in contents) {
                // Handle ArrayBufferLike types by converting to Buffer
                return Buffer.from(contents.buffer instanceof ArrayBuffer ? contents.buffer : contents as any);
            } else {
                // If it's a string, convert to Buffer
                return Buffer.from(contents as string, 'utf-8');
            }
        } catch (error) {
            console.error('Error fetching file:', error);
            throw error;
        }
    }

    /**
     * Get the size of a file in bytes
     * @param {string} filePath - The path to the file
     * @returns {Promise<number>} - The file size in bytes
     */
    async getFileSize(filePath?: string): Promise<number> {
        try {
            let pathToFetch = this.normalizeFilePath(filePath);
            console.log(`Getting file size for path: ${pathToFetch}`);
            
            // Use stat to get file information
            const stat = await this.client.stat(pathToFetch);
            const statData = 'data' in stat ? stat.data : stat;
            return statData.size;
        } catch (error) {
            console.error('Error getting file size:', error);
            throw error;
        }
    }

    /**
     * Get partial file contents (for Range requests)
     * @param {string} filePath - The path to the file
     * @param {number} start - Start byte position
     * @param {number} end - End byte position
     * @returns {Promise<Buffer>} - The partial file contents
     */
    async getPartialFileContents(filePath: string | undefined, start: number, end: number): Promise<Buffer> {
        try {
            let pathToFetch = this.normalizeFilePath(filePath);
            console.log(`Fetching partial content for ${pathToFetch}: bytes ${start}-${end}`);
            
            // Use direct HTTP request with Range header for true chunked streaming
            try {
                const baseUrl = process.env.WEBDAV_URL || '';
                // Extract credentials from URL if present
                const urlObj = new URL(baseUrl);
                const username = urlObj.username || undefined;
                const password = urlObj.password || undefined;
                
                const buffer = await streamFileWithRange(baseUrl, pathToFetch, start, end, username, password);
                console.log(`Direct stream returned ${buffer.length} bytes`);
                return buffer;
            } catch (streamError: any) {
                console.error('Direct streaming failed, falling back to full download:', streamError.message);
                
                // Fallback: fetch full file and slice
                // Only do this for smaller ranges to avoid memory issues
                const rangeSize = end - start + 1;
                const MAX_FALLBACK_SIZE = 50 * 1024 * 1024; // 50MB max for fallback
                
                if (rangeSize > MAX_FALLBACK_SIZE) {
                    throw new Error(`Range too large for fallback (${rangeSize} bytes). Direct streaming failed: ${streamError.message}`);
                }
                
                console.log('Falling back to full file download and slicing...');
                const contents = await this.client.getFileContents(pathToFetch);
                
                // Convert to Buffer
                let buffer: Buffer;
                if (contents instanceof ArrayBuffer) {
                    buffer = Buffer.from(contents);
                } else if (contents instanceof Buffer) {
                    buffer = contents;
                } else if (contents && typeof contents === 'object' && 'buffer' in contents) {
                    buffer = Buffer.from(contents.buffer instanceof ArrayBuffer ? contents.buffer : contents as any);
                } else {
                    buffer = Buffer.from(contents as string, 'utf-8');
                }
                
                // Slice to the requested range
                const slice = buffer.slice(start, end + 1);
                console.log(`Returned ${slice.length} bytes from buffer (total: ${buffer.length})`);
                
                return slice;
            }
        } catch (error) {
            console.error('Error fetching partial file contents:', error);
            throw error;
        }
    }

    /**
     * Normalize and extract file path from currentUrl or provided path
     * @param {string} filePath - Optional file path
     * @returns {string} - Normalized file path
     */
    private normalizeFilePath(filePath?: string): string {
        let pathToFetch: string;
        
        if (filePath) {
            pathToFetch = filePath;
        } else {
            // Extract the path from the current URL
            const baseUrl = process.env.WEBDAV_URL || "https://webdav.etran.dev/";
            let extractedPath = this.currentUrl;
            
            if (this.currentUrl.startsWith(baseUrl)) {
                extractedPath = this.currentUrl.substring(baseUrl.length);
            } else {
                const url = new URL(this.currentUrl);
                extractedPath = url.pathname;
            }
            
            pathToFetch = extractedPath;
        }
        
        // Clean up the path: remove double slashes and ensure single leading slash
        pathToFetch = pathToFetch.replace(/\/+/g, '/');
        
        // Ensure the path starts with /
        if (!pathToFetch.startsWith('/')) {
            pathToFetch = '/' + pathToFetch;
        }
        
        return pathToFetch;
    }
    
    public async uploadFile(filePath: string, data: Buffer | string): Promise<void> {
        try {
            await this.client.putFileContents(filePath, data, { overwrite: true });
            console.log(`File uploaded successfully to ${filePath}`);
        } catch (error) {
            console.error(`Error uploading file to ${filePath}:`, error);
            throw error;
        }
    }

    public async deleteFile(filePath: string): Promise<void> {
        try {
            await this.client.deleteFile(filePath);
            console.log(`File deleted successfully from ${filePath}`);
        } catch (error) {
            console.error(`Error deleting file from ${filePath}:`, error);
            throw error;
        }
    }
}

// Singleton instance of WebDavService
const webdavService = new WebDavService(process.env.WEBDAV_URL || "https://example.com/");
export default webdavService;

