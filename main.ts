#!/usr/bin/env node
import { createClient } from 'webdav';
import type { WebDAVClient } from 'webdav';

// Get the WebDAV URL from command line arguments or use a default value
const webdavUrl = process.argv[2] || 'https://webdav.etran.dev/etran/';

// Check if URL is provided
if (!webdavUrl) {
    console.error('Please provide a WebDAV URL');
    console.error('Usage: ts-node main.ts <webdav-url>');
    process.exit(1);
}

console.log(`Connecting to WebDAV server: ${webdavUrl}`);

// Create the WebDAV client
const client: WebDAVClient = createClient(webdavUrl);

async function exploreDirectory(directoryPath = '/'): Promise<void> {
    try {
        console.log(`\nExploring directory: ${directoryPath}`);

        // Get directory contents
        const directoryItems = await client.getDirectoryContents(directoryPath) as WebDAVClient.Stats[];

        if (directoryItems.length === 0) {
            console.log('  (empty directory)');
            return;
        }

        // Display each item
        directoryItems.forEach(item => {
            const itemType = item.type === 'directory' ? 'Dir' : 'File';
            const itemSize = item.type === 'file' ? `(${formatSize(item.size)})` : '';
            const lastMod = new Date(item.lastmod).toLocaleString();

            console.log(`  ${itemType}: ${item.basename} ${itemSize}`);
            console.log(`      Last modified: ${lastMod}`);
        });
    } catch (error: any) {
        console.error(`Error exploring ${directoryPath}:`, error.message);
    }
}

// Helper function to format file sizes
function formatSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
}

// Main function to start exploration
async function main(): Promise<void> {
    try {
        // Check if the WebDAV server is accessible
        const exists = await client.exists('/');
        if (!exists) {
            console.error('Error: Could not access the WebDAV server root');
            process.exit(1);
        }

        // Start exploring from the root
        await exploreDirectory('/');

        console.log('\nWebDAV exploration complete!');
    } catch (error: any) {
        console.error('Error connecting to WebDAV server:', error.message);
        process.exit(1);
    }
}

main();