import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import { resolveTextAttachmentMediaType } from "@/lib/ai/text-attachments";
import { createProjectFile } from "@/lib/db/query/project/create-project-file";
import { getProjectById } from "@/lib/db/query/project/get-project-by-id";
import { getProjectFiles } from "@/lib/db/query/project/get-project-files";
import { ChatSDKError } from "@/lib/errors";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

const SUPPORTED_BINARY_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
];

/**
 * Binary types are trusted from the browser MIME; text files (.txt, .md, .csv)
 * are resolved by extension because browsers report them inconsistently.
 */
const resolveMediaType = (file: Blob, filename: string): string | undefined =>
  SUPPORTED_BINARY_TYPES.includes(file.type)
    ? file.type
    : resolveTextAttachmentMediaType(filename);

const FileSchema = z.object({
  file: z.instanceof(Blob).refine((file) => file.size <= MAX_FILE_BYTES, {
    message: "File size should be less than 25MB",
  }),
  mediaType: z.string({
    message: "Allowed types: PDF, DOC, DOCX, TXT, MD, CSV",
  }),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const { id: projectId } = await params;

  const project = await getProjectById({ id: projectId });
  if (!project || project.userId !== session.user.id) {
    return new ChatSDKError("not_found:api", "Project not found").toResponse();
  }

  const files = await getProjectFiles({ projectId, userId: session.user.id });
  return Response.json(files);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const { id: projectId } = await params;

  const project = await getProjectById({ id: projectId });
  if (!project || project.userId !== session.user.id) {
    return new ChatSDKError("not_found:api", "Project not found").toResponse();
  }

  if (request.body === null) {
    return new Response("Request body is empty", { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const filename = (formData.get("file") as File).name;
    const mediaType = resolveMediaType(file, filename);
    const validated = FileSchema.safeParse({ file, mediaType });
    if (!validated.success) {
      const errorMessage = validated.error.errors
        .map((e) => e.message)
        .join(", ");
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const fileBuffer = await file.arrayBuffer();

    const blobPath = `projects/${projectId}/${Date.now()}-${filename}`;

    const blob = await put(blobPath, fileBuffer, {
      access: "public",
      contentType: validated.data.mediaType,
    });

    const created = await createProjectFile({
      projectId,
      userId: session.user.id,
      name: filename,
      size: file.size,
      mimeType: validated.data.mediaType,
      blobUrl: blob.url,
      pathname: blob.pathname,
    });

    return Response.json(created, { status: 201 });
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
