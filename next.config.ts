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
    },
    eslint: {
        // Disable ESLint during production builds
        ignoreDuringBuilds: true,
    }
};

module.exports = nextConfig;