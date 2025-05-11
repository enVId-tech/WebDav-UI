// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
    // Fix your rewrites configuration
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