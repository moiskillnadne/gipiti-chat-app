"use client";

import { type ComponentProps, memo, type ReactNode } from "react";
import { Streamdown } from "streamdown";
import { useTranslations } from "@/lib/i18n/translate";
import { cn } from "@/lib/utils";
import { useMediaLightbox } from "./media-lightbox-provider";

type ResponseProps = ComponentProps<typeof Streamdown>;

/**
 * Minimal shape of the hast node react-markdown passes to custom components.
 * Only the fields the paragraph-unwrap logic reads are modeled.
 */
type MarkdownHastNode = {
  type: string;
  tagName?: string;
  value?: string;
  children?: MarkdownHastNode[];
};

type MarkdownParagraphProps = ComponentProps<"p"> & {
  node?: MarkdownHastNode;
};

type MarkdownImageProps = ComponentProps<"img"> & {
  node?: MarkdownHastNode;
};

const isWhitespaceTextNode = (node: MarkdownHastNode): boolean =>
  node.type === "text" && (node.value ?? "").trim().length === 0;

/**
 * True when a paragraph's only meaningful children are images (whitespace text
 * nodes are ignored). Mirrors rehype-unwrap-images' unwrap condition.
 */
const containsOnlyImages = (node: MarkdownHastNode | undefined): boolean => {
  const children = node?.children;

  if (!children?.length) {
    return false;
  }

  let hasImage = false;

  for (const child of children) {
    if (child.type === "element" && child.tagName === "img") {
      hasImage = true;
      continue;
    }

    if (isWhitespaceTextNode(child)) {
      continue;
    }

    return false;
  }

  return hasImage;
};

/**
 * Markdown parses a standalone image into a paragraph. Unwrap image-only
 * paragraphs so the image renders at the block level (it used to be wrapped in
 * a `<div>`, which is invalid inside `<p>`); everything else stays a normal
 * paragraph.
 */
const MarkdownParagraph = ({
  node,
  children,
  ...props
}: MarkdownParagraphProps): ReactNode => {
  if (containsOnlyImages(node)) {
    return <>{children}</>;
  }

  return <p {...props}>{children}</p>;
};

/**
 * Markdown image that opens the fullscreen lightbox on click. Replaces
 * Streamdown's default renderer (hover overlay + download button) — download
 * now lives in the lightbox. Renders a plain image outside a lightbox provider.
 */
const MarkdownImage = ({
  node: _node,
  src,
  alt,
  className,
  ...props
}: MarkdownImageProps): ReactNode => {
  const t = useTranslations("chat.media");
  const lightbox = useMediaLightbox();
  const imageClassName = cn("max-w-full rounded-lg", className);

  if (typeof src !== "string" || !src) {
    return null;
  }

  const image = (
    // biome-ignore lint/performance/noImgElement: arbitrary markdown image URL, no Next loader
    // biome-ignore lint/nursery/useImageSize: dimensions unknown
    <img alt={alt ?? ""} className={imageClassName} src={src} {...props} />
  );

  if (!lightbox) {
    return image;
  }

  return (
    <button
      aria-label={t("openImage")}
      className="my-4 block max-w-full cursor-zoom-in"
      onClick={() =>
        lightbox.openMedia(src, { mediaType: "image", prompt: alt })
      }
      type="button"
    >
      {image}
    </button>
  );
};

export const Response = memo(
  ({ className, components, ...props }: ResponseProps) => (
    <Streamdown
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_code]:whitespace-pre-wrap [&_code]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto",
        className
      )}
      components={
        {
          ...(components as Record<string, unknown>),
          think: () => null,
          p: MarkdownParagraph,
          img: MarkdownImage,
        } as ResponseProps["components"]
      }
      defaultOrigin="https://app"
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";
