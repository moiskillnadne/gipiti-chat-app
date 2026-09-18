import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import {
  decodeTextFile,
  isTextAttachmentTruncated,
  resolveTextAttachmentMediaType,
} from "@/lib/ai/text-attachments";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

// Binary types are validated by the browser-reported MIME type. Text files
// (.md, .txt, .csv, code) are validated by extension instead — see
// `resolveTextAttachmentMediaType` for why the browser type can't be trusted.
const SUPPORTED_BINARY_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

/** Machine-readable failure reasons the composer maps to localized copy. */
export type UploadErrorCode =
  | "file_too_large"
  | "unsupported_type"
  | "upload_failed";

export type UploadErrorBody = {
  /** English fallback for clients without a translation for `code`. */
  error: string;
  code: UploadErrorCode;
};

const errorResponse = (
  code: UploadErrorCode,
  error: string,
  status: number
): NextResponse<UploadErrorBody> =>
  NextResponse.json({ error, code }, { status });

/**
 * Resolve the media type the attachment is stored and sent to chat with, or
 * `undefined` when the file is not supported.
 */
const resolveMediaType = (file: Blob, filename: string): string | undefined => {
  if (SUPPORTED_BINARY_TYPES.includes(file.type)) {
    return file.type;
  }
  return resolveTextAttachmentMediaType(filename);
};

type PreparedUpload = {
  body: ArrayBuffer | Buffer;
  /** True when the model will only see the first part of the file. */
  isTruncated: boolean;
};

/**
 * Text attachments are normalised to UTF-8 on upload: a Windows-1251 CSV from
 * Russian-locale Excel is re-encoded and a BOM is dropped, so every consumer
 * (the model inliner, the "open" link) can treat the blob as plain UTF-8.
 */
const prepareUpload = (
  bytes: ArrayBuffer,
  isTextAttachment: boolean
): PreparedUpload => {
  if (!isTextAttachment) {
    return { body: bytes, isTruncated: false };
  }
  const text = decodeTextFile(bytes);
  return {
    body: Buffer.from(text, "utf8"),
    isTruncated: isTextAttachmentTruncated(text),
  };
};

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return errorResponse(
        "file_too_large",
        "File size should be less than 10MB",
        400
      );
    }

    // Blob has no name; the File subclass the browser sends does.
    const filename = file instanceof File ? file.name : "";
    const mediaType = filename ? resolveMediaType(file, filename) : undefined;
    if (!mediaType) {
      return errorResponse(
        "unsupported_type",
        "File type should be JPEG, PNG, PDF, DOCX, MD, TXT, CSV, or a code file",
        400
      );
    }

    const isTextAttachment = !SUPPORTED_BINARY_TYPES.includes(mediaType);
    const { body, isTruncated } = prepareUpload(
      await file.arrayBuffer(),
      isTextAttachment
    );

    try {
      // Pin the stored content type so text files come back as text/markdown,
      // text/plain or text/csv regardless of what the browser reported.
      const data = await put(filename, body, {
        access: "public",
        contentType: mediaType,
      });

      return NextResponse.json({ ...data, isTruncated });
    } catch (_error) {
      return errorResponse("upload_failed", "Upload failed", 500);
    }
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
