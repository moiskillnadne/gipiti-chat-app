"use client";

import type { FileUIPart } from "ai";
import Image from "next/image";

import {
  formatFileSize,
  getAttachmentDisplayName,
  getAttachmentSize,
  getFileExtensionBadge,
  isImageMediaType,
  isPdfMediaType,
} from "@/lib/attachments/attachment-display";
import { downloadFromUrl } from "@/lib/download";
import { useTranslations } from "@/lib/i18n/translate";

import { DocumentCard, DocumentIconTile } from "./elements/document-preview";
import { useMediaLightbox } from "./elements/media-lightbox-provider";
import { toast } from "./toast";

const IMAGE_THUMBNAIL_SIZE = 64;

/** Badge for files whose name has no usable extension. */
const GENERIC_FILE_BADGE = "FILE";

const ImageAttachment = ({
  url,
  displayName,
}: {
  url: string;
  displayName: string;
}) => {
  const t = useTranslations("chat.media");
  const lightbox = useMediaLightbox();

  const thumbnail = (
    <Image
      alt={displayName}
      className="size-full object-cover"
      height={IMAGE_THUMBNAIL_SIZE}
      src={url}
      width={IMAGE_THUMBNAIL_SIZE}
    />
  );

  return (
    <div
      className="relative size-16 shrink-0 overflow-hidden rounded-lg border bg-muted"
      title={displayName}
    >
      {lightbox ? (
        <button
          aria-label={t("openImage")}
          className="block size-full cursor-zoom-in"
          onClick={() => lightbox.openMedia(url)}
          type="button"
        >
          {thumbnail}
        </button>
      ) : (
        thumbnail
      )}
    </div>
  );
};

const FileAttachment = ({
  part,
  displayName,
}: {
  part: FileUIPart;
  displayName: string;
}) => {
  const t = useTranslations("chat.media");
  const tMessages = useTranslations("chat.messages");
  const size = getAttachmentSize(part);
  const badge = getFileExtensionBadge(displayName) ?? GENERIC_FILE_BADGE;
  const meta =
    size === undefined ? badge : `${badge} · ${formatFileSize(size)}`;

  const handleDownload = async (): Promise<void> => {
    try {
      await downloadFromUrl(part.url, displayName, displayName);
    } catch (error) {
      console.error("Attachment download failed:", { url: part.url, error });
      toast({ type: "error", description: tMessages("downloadFileError") });
    }
  };

  return (
    <DocumentCard
      className="w-[320px] max-w-full"
      downloadLabel={t("downloadFile")}
      href={part.url}
      icon={<DocumentIconTile isPdf={isPdfMediaType(part.mediaType)} />}
      meta={meta}
      onDownload={handleDownload}
      openLabel={t("open")}
      title={displayName}
    />
  );
};

/**
 * Files attached to a user message: images as lightbox thumbnails, every
 * other type (PDF, DOCX, text, CSV…) as a document card with the original
 * file name, size, and open/download actions.
 */
export const MessageAttachments = ({
  parts,
}: {
  parts: readonly FileUIPart[];
}) => {
  const t = useTranslations("chat.media");

  if (parts.length === 0) {
    return null;
  }

  return (
    <div
      className="flex flex-row flex-wrap justify-end gap-2"
      data-testid="message-attachments"
    >
      {parts.map((part) => {
        const displayName =
          getAttachmentDisplayName(part) ?? t("attachmentFallbackName");
        return isImageMediaType(part.mediaType) ? (
          <ImageAttachment
            displayName={displayName}
            key={part.url}
            url={part.url}
          />
        ) : (
          <FileAttachment
            displayName={displayName}
            key={part.url}
            part={part}
          />
        );
      })}
    </div>
  );
};
