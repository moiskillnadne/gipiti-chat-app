"use client";

import type { ComponentProps, ReactNode } from "react";
import rehypeSanitize from "rehype-sanitize";
import type { BundledTheme } from "shiki";
import { Response } from "@/components/elements/response";

type ArticleContentProps = {
  content: string;
};

type ArticleImageProps = ComponentProps<"img">;

/**
 * The blog renders Markdown from an external author. Streamdown bundles
 * `rehype-raw` (raw HTML passthrough) and only hardens URLs — it does NOT strip
 * dangerous tags — so a `<script>`/`<iframe>`/`onerror` in the body would
 * otherwise execute. `rehype-sanitize` runs after `rehype-raw` (Streamdown
 * appends user rehype plugins last) and removes them. The tightened link/image
 * prefixes add URL-level protection (no `data:`/`javascript:`).
 */
const ALLOWED_IMAGE_PREFIXES = ["/", "https://gipiti.ru/"];
const ALLOWED_LINK_PREFIXES = ["/", "https://", "mailto:"];
const REHYPE_PLUGINS = [rehypeSanitize];

const isAllowedImageSrc = (src: string): boolean =>
  ALLOWED_IMAGE_PREFIXES.some((prefix) => src.startsWith(prefix));

/**
 * Renders article body images as plain, static `<img>` elements — without
 * Streamdown's hover overlay and download button. The src is re-validated
 * against the allowed prefixes here (fail closed), so an external author still
 * cannot embed a remote/tracking image even though this replaces Streamdown's
 * own (URL-hardened) image renderer.
 */
const ArticleImage = ({ src, alt, title }: ArticleImageProps): ReactNode => {
  if (typeof src !== "string" || !isAllowedImageSrc(src)) {
    return null;
  }

  return (
    // biome-ignore lint/performance/noImgElement: a plain <img> intentionally avoids Streamdown's download overlay
    // biome-ignore lint/nursery/useImageSize: markdown body images have no known intrinsic dimensions
    <img
      alt={alt ?? ""}
      decoding="async"
      loading="lazy"
      src={src}
      title={title}
    />
  );
};

const ARTICLE_COMPONENTS = {
  img: ArticleImage,
};
// Force a dark Shiki theme for both color schemes — the blog is always dark.
const SHIKI_THEME: [BundledTheme, BundledTheme] = [
  "github-dark",
  "github-dark",
];

/**
 * The single Markdown renderer shared by the production article page and the
 * author preview tool. Because both import this component, their output is
 * byte-identical (same plugins, highlighting, security posture).
 */
export const ArticleContent = ({ content }: ArticleContentProps) => (
  <div className="article-body">
    <Response
      allowedImagePrefixes={ALLOWED_IMAGE_PREFIXES}
      allowedLinkPrefixes={ALLOWED_LINK_PREFIXES}
      components={ARTICLE_COMPONENTS}
      defaultOrigin="https://gipiti.ru"
      parseIncompleteMarkdown={false}
      rehypePlugins={REHYPE_PLUGINS}
      shikiTheme={SHIKI_THEME}
    >
      {content}
    </Response>
  </div>
);
