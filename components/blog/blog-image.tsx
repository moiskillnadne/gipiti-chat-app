import Image from "next/image";

type BlogImageProps = {
  /** Local image path under `public/`, or undefined to render a striped placeholder. */
  src?: string;
  alt: string;
  /** `sizes` hint for the responsive image; ignored for the placeholder. */
  sizes: string;
  /** Shape class controlling aspect ratio + radius (e.g. "thumb", "cmedia"). */
  shape: string;
  /** Placeholder caption shown when there is no image. */
  placeholderLabel?: string;
};

/**
 * Renders either a cover/thumbnail image (Next.js optimized, `fill`) or the
 * design's striped placeholder. Shared by cards, the featured tile and article
 * covers so image handling is consistent.
 */
export const BlogImage = ({
  src,
  alt,
  sizes,
  shape,
  placeholderLabel,
}: BlogImageProps) => {
  if (!src) {
    return (
      <div className={`ph ${shape}`}>
        {placeholderLabel ? (
          <span className="ph-label">{placeholderLabel}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`blog-img ${shape}`}>
      <Image alt={alt} fill sizes={sizes} src={src} />
    </div>
  );
};
