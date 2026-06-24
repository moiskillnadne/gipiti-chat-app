import createWithVercelToolbar from "@vercel/toolbar/plugins/next";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: false,
  // pdfmake is CJS and pulls in pdfkit's binary font/AFM assets that the bundler
  // mishandles — keep it external so it loads from node_modules at runtime.
  // exceljs is CJS too and pulls in archiver/fast-csv; externalizing avoids the
  // same bundler issues (it needs no asset bundling, unlike pdfmake).
  serverExternalPackages: ["pdfmake", "exceljs"],
  // Ship the watermark logo and the PDF (Roboto, Cyrillic-capable) fonts with the
  // chat function bundle so they can be read from the filesystem at runtime
  // (public/asset files are otherwise CDN-only).
  outputFileTracingIncludes: {
    "/api/chat": [
      "./public/icons/icon-256.png",
      "./assets/fonts/Roboto-Regular.ttf",
      "./assets/fonts/Roboto-Medium.ttf",
      "./assets/fonts/Roboto-Italic.ttf",
      "./assets/fonts/Roboto-MediumItalic.ttf",
    ],
    // The blog reads Markdown files from the repo at build and on ISR
    // revalidation — ship them with the relevant functions.
    "/sitemap.xml": ["./content/blog/**/*.md"],
    "/blog": ["./content/blog/**/*.md"],
    "/blog/[slug]": ["./content/blog/**/*.md"],
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

const withVercelToolbar = createWithVercelToolbar();

export default withVercelToolbar(nextConfig);
