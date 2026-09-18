import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import { resolveTextAttachmentMediaType } from "@/lib/ai/text-attachments";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

// Binary types are validated by the browser-reported MIME type. Text files
// (.md, .txt, code) are validated by extension instead — see
// `resolveTextAttachmentMediaType` for why the browser type can't be trusted.
const SUPPORTED_BINARY_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const UNSUPPORTED_TYPE_MESSAGE =
  "File type should be JPEG, PNG, PDF, DOCX, MD, TXT, or a code file";

const FileSchema = z.object({
  file: z.instanceof(Blob).refine((file) => file.size <= MAX_FILE_BYTES, {
    message: "File size should be less than 10MB",
  }),
  filename: z.string().min(1),
});

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

    // Blob has no name; the File subclass the browser sends does.
    const filename = file instanceof File ? file.name : "";
    const validatedFile = FileSchema.safeParse({ file, filename });

    if (!validatedFile.success) {
      const errorMessage = validatedFile.error.errors
        .map((error) => error.message)
        .join(", ");

      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const mediaType = resolveMediaType(file, filename);
    if (!mediaType) {
      return NextResponse.json(
        { error: UNSUPPORTED_TYPE_MESSAGE },
        { status: 400 }
      );
    }

    const fileBuffer = await file.arrayBuffer();

    try {
      // Pin the stored content type so text files come back as text/markdown
      // or text/plain regardless of what the browser reported on upload.
      const data = await put(filename, fileBuffer, {
        access: "public",
        contentType: mediaType,
      });

      return NextResponse.json(data);
    } catch (_error) {
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
