import type { NextRequest } from "next/server";
import { ChatSDKError } from "@/lib/errors";
import { handleRouteError } from "@/server/http/handle-route-error";
import { recordLegacyHit } from "@/server/http/legacy-hit";
import { auth } from "@/server/modules/auth/next-auth";
import { deleteAllChatsByUserId } from "@/server/modules/chat/queries/delete-all-chats-by-user-id";
import { getChatsByUserId } from "@/server/modules/chat/queries/get-chats-by-user-id";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const limit = Number.parseInt(searchParams.get("limit") || "10", 10);
  const startingAfter = searchParams.get("starting_after");
  const endingBefore = searchParams.get("ending_before");

  if (startingAfter && endingBefore) {
    return new ChatSDKError(
      "bad_request:api",
      "Only one of starting_after or ending_before can be provided."
    ).toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  recordLegacyHit("GET /api/history");

  try {
    const chats = await getChatsByUserId({
      id: session.user.id,
      limit,
      startingAfter,
      endingBefore,
    });

    return Response.json(chats);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE() {
  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  recordLegacyHit("DELETE /api/history");

  try {
    const result = await deleteAllChatsByUserId({ userId: session.user.id });

    return Response.json(result, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
