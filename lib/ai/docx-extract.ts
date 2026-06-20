import "server-only";

import mammoth from "mammoth";
import type { ChatMessage } from "../types";

/** OOXML Word document MIME type. */
export const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Cap the injected text so a huge document can't blow up the token budget. */
const MAX_EXTRACTED_CHARS = 200_000;

const IMG_TAG_PATTERN = /<img[^>]*>/gi;

type ChatMessagePart = ChatMessage["parts"][number];

type DocxFilePart = {
  type: "file";
  mediaType: string;
  url: string;
  filename?: string;
  name?: string;
};

const isDocxFilePart = (
  part: ChatMessagePart
): part is ChatMessagePart & DocxFilePart =>
  part.type === "file" &&
  (part as { mediaType?: string }).mediaType === DOCX_MIME_TYPE;

const labelOf = (part: DocxFilePart): string =>
  part.filename ?? part.name ?? "документ.docx";

/**
 * Extract a .docx buffer into structured HTML the model can read. mammoth keeps
 * headings, lists, tables and bold/italic as HTML tags; embedded images are
 * dropped to a placeholder so they don't bloat the prompt with base64. Output is
 * length-capped.
 */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  // Returning an empty src keeps mammoth from inlining images as base64.
  const dropImages = mammoth.images.imgElement(() =>
    Promise.resolve({ src: "" })
  );
  const result = await mammoth.convertToHtml(
    { buffer },
    { convertImage: dropImages }
  );

  let html = result.value.replace(IMG_TAG_PATTERN, "[изображение]");
  if (html.length > MAX_EXTRACTED_CHARS) {
    html = `${html.slice(0, MAX_EXTRACTED_CHARS)}\n\n[документ обрезан: текст слишком длинный]`;
  }
  return html;
}

async function fetchAndExtract(url: string, label: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return `[Не удалось прочитать файл "${label}".]`;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const text = await extractDocxText(buffer);
    return `Содержимое документа "${label}":\n\n${text}`;
  } catch (error) {
    console.error("Failed to extract DOCX", url, error);
    return `[Не удалось прочитать файл "${label}".]`;
  }
}

/**
 * Replace every .docx file part with a text part holding the document's
 * extracted content, so the model can read Word files (LLM providers can't read
 * .docx natively the way they read PDFs). Operates on the model-facing message
 * copy only — the persisted user message keeps its file part so the UI still
 * renders the attachment chip. Image/PDF file parts are left untouched.
 */
export async function attachDocxContentForModel(
  messages: ChatMessage[]
): Promise<ChatMessage[]> {
  return await Promise.all(
    messages.map(async (message) => {
      if (!message.parts.some(isDocxFilePart)) {
        return message;
      }

      const parts: ChatMessagePart[] = [];
      for (const part of message.parts) {
        if (isDocxFilePart(part)) {
          const text = await fetchAndExtract(part.url, labelOf(part));
          parts.push({ type: "text", text });
        } else {
          parts.push(part);
        }
      }

      return { ...message, parts };
    })
  );
}
