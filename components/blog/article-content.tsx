"use client";

import type { ComponentProps, ReactNode } from "react";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import type { BundledTheme } from "shiki";
import { Response } from "@/components/elements/response";

type ArticleContentProps = {
  content: string;
};

type ArticleImageProps = ComponentProps<"img">;
type ArticleVideoProps = ComponentProps<"video">;

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

/**
 * Extend the default (GitHub) sanitize schema to permit a locally-hosted
 * `<video>` used for usage demos — only the `src`/`poster` attributes pass, and
 * both are re-validated against the local prefixes in `ArticleVideo` (fail
 * closed). Playback behaviour (muted/loop/autoplay) is hard-coded in the
 * component, never taken from the Markdown, so an author cannot inject audio or
 * arbitrary media attributes.
 */
const SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "video"],
  attributes: {
    ...defaultSchema.attributes,
    video: ["src", "poster"],
  },
  protocols: {
    ...defaultSchema.protocols,
    poster: ["http", "https"],
  },
};

const REHYPE_PLUGINS: ComponentProps<typeof Response>["rehypePlugins"] = [
  [rehypeSanitize, SANITIZE_SCHEMA],
];

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

/**
 * Renders a usage-demo `<video>` as a muted, looping, autoplaying clip (a
 * lightweight GIF replacement). `src` and `poster` are re-validated against the
 * allowed local prefixes here (fail closed), so an author cannot point the tag
 * at a remote/tracking URL even though the sanitize schema permits the tag.
 */
const ArticleVideo = ({ src, poster }: ArticleVideoProps): ReactNode => {
  if (typeof src !== "string" || !isAllowedImageSrc(src)) {
    return null;
  }

  const safePoster =
    typeof poster === "string" && isAllowedImageSrc(poster)
      ? poster
      : undefined;

  return (
    <video
      autoPlay
      controls
      loop
      muted
      playsInline
      poster={safePoster}
      preload="metadata"
      src={src}
    />
  );
};

const ARTICLE_COMPONENTS = {
  img: ArticleImage,
  video: ArticleVideo,
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
