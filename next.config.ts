import createWithVercelToolbar from "@vercel/toolbar/plugins/next";
import type { NextConfig } from "next";

/**
 * Machine-readable discovery links (RFC 8288). An agent that fetches any page
 * gets the entrypoints in the response headers instead of having to probe
 * well-known paths one by one.
 *
 * Emitted as a single comma-separated value on purpose: Next.js lets the last
 * entry win when the same header key is set more than once, so separate `Link`
 * entries would drop all but one relation.
 */
const AGENT_DISCOVERY_LINK_HEADER = [
  '</.well-known/api-catalog>; rel="api-catalog"; type="application/linkset+json"',
  '</openapi.json>; rel="service-desc"; type="application/json"',
  '</models>; rel="service-doc"; type="text/html"',
  '</sitemap.xml>; rel="sitemap"; type="application/xml"',
].join(", ");

/** Everything except API routes, build output and static media. */
const HTML_PAGE_SOURCE = "/((?!api/|_next/|images/|videos/).*)";

const nextConfig: NextConfig = {
  cacheComponents: false,
  // `www.gipiti.ru` used to serve a full 200 mirror of the site, so every page
  // existed on two hostnames and only the ones with a hardcoded canonical were
  // protected from being treated as duplicates. Collapse the apex host at the
  // edge so `www` is never a crawlable surface.
  redirects() {
    return Promise.resolve([
      {
        source: "/:path*",
        has: [{ type: "host" as const, value: "www.gipiti.ru" }],
        destination: "https://gipiti.ru/:path*",
        permanent: true,
      },
    ]);
  },
  headers() {
    return Promise.resolve([
      {
        source: HTML_PAGE_SOURCE,
        headers: [{ key: "Link", value: AGENT_DISCOVERY_LINK_HEADER }],
      },
    ]);
  },
  // Import .svg files as React components (SVGR) — used for provider logos.
  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
  // pdfmake is CJS and pulls in pdfkit's binary font/AFM assets that the bundler
  // mishandles — keep it external so it loads from node_modules at runtime.
  serverExternalPackages: ["pdfmake"],
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
