import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { addPromptFavorite } from "@/lib/db/query/prompt/add-prompt-favorite";
import { removePromptFavorite } from "@/lib/db/query/prompt/remove-prompt-favorite";
import { ChatSDKError } from "@/lib/errors";

const bodySchema = z.object({
  promptId: z.string().uuid(),
});

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

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
