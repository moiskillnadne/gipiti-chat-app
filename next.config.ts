import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: false,
  // Ship the watermark logo with the chat function bundle so it can be read
  // from the filesystem at runtime (public assets are otherwise CDN-only).
  outputFileTracingIncludes: {
    "/api/chat": ["./public/icons/icon-256.png"],
  },
  experimental: {
    serverActions: {
      allowedOrigins: ["gipiti.ru", "www.gipiti.ru"],
    },
  },
  images: {
    remotePatterns: [
      {
        hostname: "avatar.vercel.sh",
      },
      {
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        hostname: "www.google.com",
      },
    ],
  },
};

export default nextConfig;
