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

    constructor(webdavUrl: string) {
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
    updateUrl(newUrl: string): boolean {
        if (newUrl !== this.currentUrl) {
            console.log(`Updating WebDAV client URL from ${this.currentUrl} to ${newUrl}`);
            this.currentUrl = newUrl;
            this.client = this.createClientWithOptions(newUrl);
        }

        return this.currentUrl == newUrl;
    }

    /**
     * Get the current URL of the WebDAV server.
     * @returns {string} The current URL.
     */
    async getDirectoryContents(path: string = '/'): Promise<any[]> {
        return this.client.getDirectoryContents(path);
    }
}

// Singleton instance of WebDavService
const webdavService = new WebDavService(process.env.WEBDAV_URL || "https://webdav.etran.dev/");
export default webdavService;