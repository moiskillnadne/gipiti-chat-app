import { del } from "@vercel/blob";

import { auth } from "@/app/(auth)/auth";
import { deleteProjectFileRecord } from "@/lib/db/query/project/delete-project-file-record";
import { getProjectFileById } from "@/lib/db/query/project/get-project-file-by-id";
import { ChatSDKError } from "@/lib/errors";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const { id: projectId, fileId } = await params;

  const file = await getProjectFileById({ id: fileId });
  if (
    !file ||
    file.userId !== session.user.id ||
    file.projectId !== projectId
  ) {
    return new ChatSDKError("not_found:api", "File not found").toResponse();
  }

  try {
    await del(file.blobUrl);
  } catch {
    // Best-effort blob cleanup; still remove DB row.
  }

  await deleteProjectFileRecord({ id: fileId, userId: session.user.id });
  return Response.json({ success: true });
}
