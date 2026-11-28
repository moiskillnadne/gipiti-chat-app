import { z } from "zod";
import { ChatSDKError } from "@/lib/errors";
import { recordLegacyHit } from "@/server/http/legacy-hit";
import { auth } from "@/server/modules/auth/next-auth";
import { addPromptFavorite } from "@/server/modules/prompts/queries/add-prompt-favorite";
import { removePromptFavorite } from "@/server/modules/prompts/queries/remove-prompt-favorite";

const bodySchema = z.object({
  promptId: z.string().uuid(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }
  // Counted only for a signed-in caller (an old tab); scanners are not.
  recordLegacyHit("POST /api/prompts/favorite");

  try {
    const json = await request.json();
    const { promptId } = bodySchema.parse(json);

    await addPromptFavorite({ userId: session.user.id, promptId });

    return Response.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new ChatSDKError(
        "bad_request:api",
        "Invalid favorite data"
      ).toResponse();
    }
    throw error;
  }
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }
  // Counted only for a signed-in caller (an old tab); scanners are not.
  recordLegacyHit("DELETE /api/prompts/favorite");

  const { searchParams } = new URL(request.url);
  const promptId = searchParams.get("promptId");

  if (!promptId) {
    return new ChatSDKError(
      "bad_request:api",
      "Parameter promptId is required"
    ).toResponse();
  }

  await removePromptFavorite({ userId: session.user.id, promptId });

  return Response.json({ success: true });
}
