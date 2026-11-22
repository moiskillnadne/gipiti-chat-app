import { getActivePrompts } from "@/lib/db/query/prompt/get-active-prompts";
import { getFavoritePromptIds } from "@/lib/db/query/prompt/get-favorite-prompt-ids";
import type { PromptsResponse } from "@/lib/types";
import { auth } from "@/server/modules/auth/next-auth";

export async function GET() {
  const session = await auth();

  const userId = session?.user?.id;

  const [prompts, favoriteIds] = await Promise.all([
    getActivePrompts(),
    userId ? getFavoritePromptIds({ userId }) : Promise.resolve<string[]>([]),
  ]);

  return Response.json({ prompts, favoriteIds } satisfies PromptsResponse);
}
