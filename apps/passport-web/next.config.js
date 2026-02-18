/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,

    // Only proxy API routes in development (when using a separate backend)
    // In production/Vercel, the app/api/ routes handle everything directly
    async rewrites() {
        if (process.env.NEXT_PUBLIC_API_URL) {
            return [
                {
                    source: '/api/:path*',
                    destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
                },
            ];
        }
        return [];
    },
};

module.exports = nextConfig;
