import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: false,
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
