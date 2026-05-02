import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import {
  createProjectFile,
  getProjectById,
  getProjectFiles,
} from "@/lib/db/queries";
import { ChatSDKError } from "@/lib/errors";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

const SUPPORTED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
];

const FileSchema = z.object({
  file: z
    .instanceof(Blob)
    .refine((file) => file.size <= MAX_FILE_BYTES, {
      message: "File size should be less than 25MB",
    })
    .refine((file) => SUPPORTED_FILE_TYPES.includes(file.type), {
      message: "Allowed types: PDF, DOC, DOCX, TXT, MD",
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

    const validated = FileSchema.safeParse({ file });
    if (!validated.success) {
      const errorMessage = validated.error.errors
        .map((e) => e.message)
        .join(", ");
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }

    const filename = (formData.get("file") as File).name;
    const fileBuffer = await file.arrayBuffer();

    const blobPath = `projects/${projectId}/${Date.now()}-${filename}`;

    const blob = await put(blobPath, fileBuffer, {
      access: "public",
      contentType: file.type,
    });

    const created = await createProjectFile({
      projectId,
      userId: session.user.id,
      name: filename,
      size: file.size,
      mimeType: file.type,
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
