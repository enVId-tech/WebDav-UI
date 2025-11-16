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
    private fileSizeCache: Map<string, { size: number; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    
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
        try {
            const contents = await this.client.getDirectoryContents(path);
            return Array.isArray(contents) ? contents : contents.data; // Ensure it returns an array
        } catch (error: any) {
            // If directory doesn't exist (404), return empty array instead of throwing
            if (error.status === 404 || error.response?.status === 404) {
                console.log(`Directory not found: ${path}, returning empty array`);
                return [];
            }
            // For other errors, throw them
            throw error;
        }
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
            
            // Check cache first
            const cached = this.fileSizeCache.get(pathToFetch);
            if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
                console.log(`Using cached file size for ${pathToFetch}: ${cached.size} bytes`);
                return cached.size;
            }
            
            console.log(`Getting file size for path: ${pathToFetch}`);
            
            // Use stat to get file information
            const stat = await this.client.stat(pathToFetch);
            const statData = 'data' in stat ? stat.data : stat;
            const size = statData.size;
            
            // Cache the result
            this.fileSizeCache.set(pathToFetch, { size, timestamp: Date.now() });
            
            // Clean up old cache entries (keep cache size reasonable)
            if (this.fileSizeCache.size > 100) {
                const now = Date.now();
                for (const [key, value] of this.fileSizeCache.entries()) {
                    if (now - value.timestamp > this.CACHE_TTL) {
                        this.fileSizeCache.delete(key);
                    }
                }
            }
            
            return size;
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
        const pathToFetch = this.normalizeFilePath(filePath);
        const rangeSize = end - start + 1;
        
        try {
            // Use direct HTTP request with Range header for true chunked streaming
            const baseUrl = process.env.WEBDAV_URL || '';
            
            // Extract credentials from URL if present
            const urlObj = new URL(baseUrl);
            const username = urlObj.username || undefined;
            const password = urlObj.password || undefined;
            
            const buffer = await streamFileWithRange(baseUrl, pathToFetch, start, end, username, password);
            return buffer;
        } catch (streamError: any) {
            console.error(`Direct streaming failed for ${pathToFetch} (${rangeSize} bytes):`, streamError.message);
            
            // Fallback: fetch full file and slice
            // Only do this for smaller ranges to avoid memory issues
            const MAX_FALLBACK_SIZE = 20 * 1024 * 1024; // 20MB max for fallback
            
            if (rangeSize > MAX_FALLBACK_SIZE) {
                throw new Error(`Range too large for fallback (${(rangeSize / 1024 / 1024).toFixed(2)} MB). Direct streaming failed: ${streamError.message}`);
            }
            
            console.log(`Attempting fallback for ${(rangeSize / 1024 / 1024).toFixed(2)} MB range...`);
            
            try {
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
                console.log(`Fallback successful: returned ${slice.length} bytes from ${buffer.length} byte file`);
                
                return slice;
            } catch (fallbackError: any) {
                console.error('Fallback also failed:', fallbackError.message);
                throw new Error(`Both direct streaming and fallback failed. Last error: ${fallbackError.message}`);
            }
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

