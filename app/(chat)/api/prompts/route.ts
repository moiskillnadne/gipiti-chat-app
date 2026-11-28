import type { PromptsResponse } from "@/lib/types";
import { recordLegacyHit } from "@/server/http/legacy-hit";
import { auth } from "@/server/modules/auth/next-auth";
import { getActivePrompts } from "@/server/modules/prompts/queries/get-active-prompts";
import { getFavoritePromptIds } from "@/server/modules/prompts/queries/get-favorite-prompt-ids";

export async function GET() {
  const session = await auth();

  const userId = session?.user?.id;

  // Only a signed-in caller is an old tab; a scanner is not counted.
  if (userId) {
    recordLegacyHit("GET /api/prompts");
  }

  const [prompts, favoriteIds] = await Promise.all([
    getActivePrompts(),
    userId ? getFavoritePromptIds({ userId }) : Promise.resolve<string[]>([]),
  ]);

  return Response.json({ prompts, favoriteIds } satisfies PromptsResponse);
}
