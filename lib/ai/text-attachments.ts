import "server-only";

import type { ChatMessage } from "../types";

/** Canonical media type for Markdown attachments (.md / .markdown). */
export const MARKDOWN_MIME_TYPE = "text/markdown";

/** Canonical media type for every other plain-text attachment (.txt, code). */
export const PLAIN_TEXT_MIME_TYPE = "text/plain";

/** Media types that are read as UTF-8 text and injected into the prompt. */
export const TEXT_ATTACHMENT_MIME_TYPES = [
  MARKDOWN_MIME_TYPE,
  PLAIN_TEXT_MIME_TYPE,
] as const;

export type TextAttachmentMimeType =
  (typeof TEXT_ATTACHMENT_MIME_TYPES)[number];

/**
 * File extensions accepted as text attachments, mapped to the fenced-code
 * language hint used when the content is shown to the model. Browsers report
 * unreliable MIME types for these (".md" is often empty on Windows, ".ts" is
 * "video/mp2t"), so the extension — not the browser type — is authoritative.
 */
const TEXT_EXTENSION_LANGUAGE: Record<string, string> = {
  ".md": "markdown",
  ".markdown": "markdown",
  ".txt": "text",
  ".ts": "ts",
  ".tsx": "tsx",
  ".js": "js",
  ".jsx": "jsx",
  ".json": "json",
  ".css": "css",
  ".html": "html",
};

/** Cap the injected text so a huge file can't blow up the token budget. */
const MAX_EXTRACTED_CHARS = 200_000;

type ChatMessagePart = ChatMessage["parts"][number];

type TextFilePart = {
  type: "file";
  mediaType: string;
  url: string;
  filename?: string;
  name?: string;
};

const extensionOf = (filename: string): string => {
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex === -1 ? "" : filename.slice(dotIndex).toLowerCase();
};

/**
 * Resolve the canonical media type for an uploaded file by its extension.
 * Returns `undefined` when the file is not a supported text attachment.
 */
export const resolveTextAttachmentMediaType = (
  filename: string
): TextAttachmentMimeType | undefined => {
  const extension = extensionOf(filename);
  if (!(extension in TEXT_EXTENSION_LANGUAGE)) {
    return;
  }
  return TEXT_EXTENSION_LANGUAGE[extension] === "markdown"
    ? MARKDOWN_MIME_TYPE
    : PLAIN_TEXT_MIME_TYPE;
};

const isTextFilePart = (
  part: ChatMessagePart
): part is ChatMessagePart & TextFilePart =>
  part.type === "file" &&
  (TEXT_ATTACHMENT_MIME_TYPES as readonly string[]).includes(
    (part as { mediaType?: string }).mediaType ?? ""
  );

const labelOf = (part: TextFilePart): string =>
  part.filename ?? part.name ?? "файл.txt";

const languageHintOf = (part: TextFilePart): string =>
  TEXT_EXTENSION_LANGUAGE[extensionOf(labelOf(part))] ??
  (part.mediaType === MARKDOWN_MIME_TYPE ? "markdown" : "text");

/**
 * Wrap raw file text for the model: a labelled fenced block so the model can
 * tell the attachment apart from the user's own message, length-capped.
 */
export const formatTextAttachmentForModel = (
  label: string,
  language: string,
  text: string
): string => {
  const body =
    text.length > MAX_EXTRACTED_CHARS
      ? `${text.slice(0, MAX_EXTRACTED_CHARS)}\n\n[файл обрезан: текст слишком длинный]`
      : text;
  // A file that itself contains ``` would close the fence early; four
  // backticks keep the wrapper unambiguous for any common Markdown content.
  return `Содержимое файла "${label}":\n\n\`\`\`\`${language}\n${body}\n\`\`\`\``;
};

async function fetchAndFormat(part: TextFilePart): Promise<string> {
  const label = labelOf(part);
  try {
    const response = await fetch(part.url);
    if (!response.ok) {
      return `[Не удалось прочитать файл "${label}".]`;
    }
    const text = await response.text();
    return formatTextAttachmentForModel(label, languageHintOf(part), text);
  } catch (error) {
    console.error("Failed to read text attachment", part.url, error);
    return `[Не удалось прочитать файл "${label}".]`;
  }
}

/**
 * Replace every Markdown / plain-text file part with a text part holding the
 * file's content. Providers don't accept arbitrary text files as `file` parts
 * (OpenAI rejects anything but images and PDFs), so the content is inlined on
 * the model-facing message copy only — the persisted user message keeps its
 * file part so the UI still renders the attachment chip.
 */
export async function attachTextContentForModel(
  messages: ChatMessage[]
): Promise<ChatMessage[]> {
  return await Promise.all(
    messages.map(async (message) => {
      if (!message.parts.some(isTextFilePart)) {
        return message;
      }

      const parts: ChatMessagePart[] = [];
      for (const part of message.parts) {
        if (isTextFilePart(part)) {
          parts.push({ type: "text", text: await fetchAndFormat(part) });
        } else {
          parts.push(part);
        }
      }

      return { ...message, parts };
    })
  );
}
