import "server-only";

import type { ChatMessage } from "../types";

/** Canonical media type for Markdown attachments (.md / .markdown). */
export const MARKDOWN_MIME_TYPE = "text/markdown";

/** Canonical media type for every other plain-text attachment (.txt, code). */
export const PLAIN_TEXT_MIME_TYPE = "text/plain";

/** Canonical media type for comma-separated tables (.csv). */
export const CSV_MIME_TYPE = "text/csv";

/** Canonical media type for tab-separated tables (.tsv). */
export const TSV_MIME_TYPE = "text/tab-separated-values";

/** Media types that are read as UTF-8 text and injected into the prompt. */
export const TEXT_ATTACHMENT_MIME_TYPES = [
  MARKDOWN_MIME_TYPE,
  PLAIN_TEXT_MIME_TYPE,
  CSV_MIME_TYPE,
  TSV_MIME_TYPE,
] as const;

export type TextAttachmentMimeType =
  (typeof TEXT_ATTACHMENT_MIME_TYPES)[number];

/**
 * File extensions accepted as text attachments, mapped to the fenced-code
 * language hint used when the content is shown to the model. Browsers report
 * unreliable MIME types for these (".md" is often empty on Windows, ".ts" is
 * "video/mp2t", ".csv" is "application/vnd.ms-excel" when Excel is installed),
 * so the extension — not the browser type — is authoritative.
 */
const TEXT_EXTENSION_LANGUAGE: Record<string, string> = {
  ".md": "markdown",
  ".markdown": "markdown",
  ".txt": "text",
  ".csv": "csv",
  ".tsv": "tsv",
  ".ts": "ts",
  ".tsx": "tsx",
  ".js": "js",
  ".jsx": "jsx",
  ".json": "json",
  ".css": "css",
  ".html": "html",
};

/** Language hints that carry their own media type; everything else is plain. */
const MIME_TYPE_BY_LANGUAGE: Record<string, TextAttachmentMimeType> = {
  markdown: MARKDOWN_MIME_TYPE,
  csv: CSV_MIME_TYPE,
  tsv: TSV_MIME_TYPE,
};

/** Cap the injected text so a huge file can't blow up the token budget. */
export const MAX_EXTRACTED_CHARS = 200_000;

const TRUNCATION_NOTICE = "[файл обрезан: текст слишком длинный]";

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
  const language = TEXT_EXTENSION_LANGUAGE[extensionOf(filename)];
  if (!language) {
    return;
  }
  return MIME_TYPE_BY_LANGUAGE[language] ?? PLAIN_TEXT_MIME_TYPE;
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

/** UTF-8 byte order mark, as emitted by Excel and Windows editors. */
const UTF8_BOM = [0xef, 0xbb, 0xbf] as const;

const hasUtf8Bom = (bytes: Uint8Array): boolean =>
  bytes.length >= UTF8_BOM.length &&
  UTF8_BOM.every((byte, index) => bytes[index] === byte);

/**
 * Decode an uploaded text file to a string. UTF-8 (with or without BOM) is the
 * norm, but CSV/TXT exported from Russian-locale Excel or Notepad is commonly
 * Windows-1251, which a plain UTF-8 decode turns into "������". Strict UTF-8
 * decoding is tried first and cp1251 is used only when the bytes are not valid
 * UTF-8, so genuine UTF-8 content is never mis-decoded.
 */
export const decodeTextFile = (bytes: ArrayBuffer | Uint8Array): string => {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const body = hasUtf8Bom(view) ? view.subarray(UTF8_BOM.length) : view;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body);
  } catch {
    return new TextDecoder("windows-1251").decode(body);
  }
};

/** True when the file is longer than what the model will actually receive. */
export const isTextAttachmentTruncated = (text: string): boolean =>
  text.length > MAX_EXTRACTED_CHARS;

/**
 * Wrap raw file text for the model: a labelled fenced block so the model can
 * tell the attachment apart from the user's own message, length-capped.
 */
export const formatTextAttachmentForModel = (
  label: string,
  language: string,
  text: string
): string => {
  const body = isTextAttachmentTruncated(text)
    ? `${text.slice(0, MAX_EXTRACTED_CHARS)}\n\n${TRUNCATION_NOTICE}`
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
    // Decode the bytes ourselves rather than via `response.text()` so blobs
    // uploaded before charset normalisation (cp1251 legacy files) still read.
    const text = decodeTextFile(await response.arrayBuffer());
    return formatTextAttachmentForModel(label, languageHintOf(part), text);
  } catch (error) {
    console.error("Failed to read text attachment", part.url, error);
    return `[Не удалось прочитать файл "${label}".]`;
  }
}

/**
 * Replace every Markdown / plain-text / CSV file part with a text part holding
 * the file's content. Providers don't accept arbitrary text files as `file`
 * parts (OpenAI rejects anything but images and PDFs), so the content is
 * inlined on the model-facing message copy only — the persisted user message
 * keeps its file part so the UI still renders the attachment chip.
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
