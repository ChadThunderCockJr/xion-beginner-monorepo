import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@xion-beginner/xion-config", "@xion-beginner/ui"],
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              // Default: only allow from self
              "default-src 'self'",
              // Scripts: self + inline for Next.js hydration
              "script-src 'self' 'unsafe-inline'",
              // Styles: self + inline for Tailwind CSS
              "style-src 'self' 'unsafe-inline'",
              // Images: self, data URLs, and blob URLs
              "img-src 'self' data: blob:",
              // Fonts: self and common font CDNs
              "font-src 'self' data:",
              // Connect: API calls to XION, Crossmint, Vercel
              "connect-src 'self' https://*.burnt.com https://*.crossmint.com https://*.vercel.com https://*.vercel-storage.com wss://*.burnt.com",
              // Frames: allow Crossmint and Abstraxion iframes
              "frame-src 'self' https://*.crossmint.com https://*.burnt.com",
              // Form actions
              "form-action 'self'",
              // Base URI
              "base-uri 'self'",
              // Object source (Flash, etc.)
              "object-src 'none'",
            ].join("; "),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Permissions-Policy",
            value: "geolocation=(), camera=(), microphone=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
