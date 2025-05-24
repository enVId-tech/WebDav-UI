import { createClient, WebDAVClient } from "webdav";

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
        this.client = createClient(webdavUrl);
        this.currentUrl = webdavUrl;
    }

    private createClientWithOptions(url: string): WebDAVClient {
        return createClient(url, {
            // For development only - disable SSL certificate validation
            httpsAgent: new (require('https').Agent)({
                rejectUnauthorized: false
            })
        });
    }

    /**
     * Get the current URL of the WebDAV server.
     * @param {string} newUrl - The new URL to set.
     * @returns {string} The current URL.
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

    async getFileContents() {
        try {
            const response = await fetch(this.currentUrl, {
                method: 'GET',
                headers: {
                    Authorization: `Basic ${btoa(`${process.env.WEBDAV_USERNAME}:${process.env.WEBDAV_PASSWORD}`)}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
            }

            return await response.arrayBuffer();
        } catch (error) {
            console.error('Error fetching file:', error);
            throw error;
        }
    }

    async uploadFile(filePath: string, data: Buffer | Uint8Array | string): Promise<void> {
        try {
            await this.client.putFileContents(filePath, data, { overwrite: true });
            console.log(`File uploaded successfully to ${filePath}`);
        } catch (error) {
            console.error(`Error uploading file to ${filePath}:`, error);
            throw error;
        }
    }

    async deleteFile(filePath: string): Promise<void> {
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
const webdavService = new WebDavService(process.env.WEBDAV_URL || "https://webdav.etran.dev/");
export default webdavService;

