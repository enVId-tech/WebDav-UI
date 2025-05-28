import '@testing-library/jest-dom'
import webdavService from '@/lib/webdav-server'

afterEach(() => {
    jest.clearAllMocks();
})

describe("WebDav Server", () => {
    test('Should be singleton instance of class', () => {
        expect(webdavService).toBe(webdavService);
    })

    test('Should run updateUrl and return value', () => {
        const classMethod: boolean = webdavService.updateUrl('https://testUrl.com/main');

        const updateClassMethod: boolean = webdavService.updateUrl('https://testUrl.com/main')

        expect(classMethod).toBeTruthy();
        expect(updateClassMethod).toBeFalsy();
    })
});