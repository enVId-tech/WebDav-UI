import '@testing-library/jest-dom'
import { getDirectoryContents } from '@/lib/webdav-client'

// Tests the webdav-client.ts file for the WebDav Client
describe('WebDAV Client', () => {
    test("Should return valid value", async () => {
        const dirContents = await getDirectoryContents();

        expect(dirContents).not.toBe(Error)
    })
})