"use client";

import { type ComponentProps, memo, type ReactNode } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";

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
 * Streamdown's image renderer wraps each `<img>` in a `<div>` (hover overlay +
 * download button). Markdown parses a standalone image into a paragraph, which
 * would nest that `<div>` inside a `<p>` — invalid HTML that triggers a React
 * hydration error. Unwrap image-only paragraphs so the image renders at the
 * block level instead; everything else stays a normal paragraph.
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
        } as ResponseProps["components"]
      }
      defaultOrigin="https://app"
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = "Response";
