import type { FileUIPart } from "ai";

/**
 * A user file part as persisted in `Message_v2.parts`. On top of the AI SDK
 * shape it may carry the legacy `name` (older messages only had this, never
 * `filename`) and the display-only original `size` in bytes.
 */
export type StoredFilePart = FileUIPart & {
  name?: string;
  size?: number;
};

/** Every UI string in the app is Russian (see `lib/i18n/format.ts`). */
const DISPLAY_LOCALE = "ru";

const BYTES_PER_KILOBYTE = 1024;
const BYTES_PER_MEGABYTE = BYTES_PER_KILOBYTE * 1024;

/** Extension badges longer than this are not shown (likely not a real ext). */
const MAX_EXTENSION_BADGE_LENGTH = 5;

const PDF_MEDIA_TYPE = "application/pdf";

const readStringField = (
  part: FileUIPart,
  field: "filename" | "name"
): string | undefined => {
  const value: unknown = (part as StoredFilePart)[field];
  if (typeof value !== "string") {
    return;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

/**
 * The user's name for an attached file: `filename` (AI SDK field, sent since
 * GIPITI-84) or the legacy `name`. `undefined` when neither is set, so the
 * caller can show a localized fallback.
 */
export const getAttachmentDisplayName = (
  part: FileUIPart
): string | undefined =>
  readStringField(part, "filename") ?? readStringField(part, "name");

/** Original file size in bytes, when the part recorded one. */
export const getAttachmentSize = (part: FileUIPart): number | undefined => {
  const value: unknown = (part as StoredFilePart).size;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return;
  }
  return value;
};

export const isImageMediaType = (mediaType: string): boolean =>
  mediaType.startsWith("image/");

export const isPdfMediaType = (mediaType: string): boolean =>
  mediaType === PDF_MEDIA_TYPE;

/**
 * Upper-cased file extension for the card badge ("PDF", "DOCX", "PY"), or
 * `undefined` when the name has no usable extension.
 */
export const getFileExtensionBadge = (
  fileName: string | undefined
): string | undefined => {
  if (!fileName) {
    return;
  }
  const dotIndex = fileName.lastIndexOf(".");
  // A leading dot is a dotfile (".env"), not an extension.
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) {
    return;
  }
  const extension = fileName.slice(dotIndex + 1);
  if (extension.length > MAX_EXTENSION_BADGE_LENGTH) {
    return;
  }
  return extension.toUpperCase();
};

/**
 * Human-readable file size with localized units ("512 Б", "12 кБ", "2,4 МБ").
 * `Intl` supplies the unit names, so nothing here is hardcoded per language.
 */
export const formatFileSize = (
  bytes: number,
  locale: string = DISPLAY_LOCALE
): string => {
  if (bytes < BYTES_PER_KILOBYTE) {
    return new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "byte",
      unitDisplay: "short",
    }).format(bytes);
  }
  const roundedKilobytes = Math.round(bytes / BYTES_PER_KILOBYTE);
  // Compare the rounded value so 1 048 100 B reads "1 МБ", not "1 024 кБ".
  if (roundedKilobytes < BYTES_PER_KILOBYTE) {
    return new Intl.NumberFormat(locale, {
      style: "unit",
      unit: "kilobyte",
      unitDisplay: "short",
    }).format(roundedKilobytes);
  }
  return new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "megabyte",
    unitDisplay: "short",
    maximumFractionDigits: 1,
  }).format(bytes / BYTES_PER_MEGABYTE);
};
