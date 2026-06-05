import { auth } from "@/app/(auth)/auth";
import { getActivePrompts } from "@/lib/db/query/prompt/get-active-prompts";
import { getFavoritePromptIds } from "@/lib/db/query/prompt/get-favorite-prompt-ids";
import type { PromptsResponse } from "@/lib/types";

export async function GET() {
  const session = await auth();

  const userId = session?.user?.id;

  const [prompts, favoriteIds] = await Promise.all([
    getActivePrompts(),
    userId ? getFavoritePromptIds({ userId }) : Promise.resolve<string[]>([]),
  ]);

  return Response.json({ prompts, favoriteIds } satisfies PromptsResponse);
}
