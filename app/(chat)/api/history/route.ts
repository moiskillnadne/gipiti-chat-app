import type { NextRequest } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { handleRouteError } from "@/lib/api/handle-route-error";
import { deleteAllChatsByUserId } from "@/lib/db/query/chat/delete-all-chats-by-user-id";
import { getChatsByUserId } from "@/lib/db/query/chat/get-chats-by-user-id";
import { ChatSDKError } from "@/lib/errors";

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

  try {
    const result = await deleteAllChatsByUserId({ userId: session.user.id });

    return Response.json(result, { status: 200 });
  } catch (error) {
    return handleRouteError(error);
  }
}
