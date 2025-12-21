// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
    async rewrites() {
        return [
            {
                source: '/webdav/:path*',
                destination: '/api/webdav/:path*',
            },
        ];
    }
};

module.exports = nextConfig;