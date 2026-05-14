import { auth } from "@/app/(auth)/auth";
import { getUserTier } from "@/lib/ai/entitlements";
import { checkImageGenerationQuota } from "@/lib/ai/image-generation-quota";
import { getUserBalance } from "@/lib/ai/token-balance";
import { checkVideoGenerationQuota } from "@/lib/ai/video-generation-quota";
import { getActiveUserSubscription } from "@/lib/db/queries";
import { getUserById } from "@/lib/db/query/user/get-by-id";
import { checkSearchQuota } from "@/lib/search/search-quota";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const userId = session.user.id;

  const [userRecords, subscription, balanceInfo, image, video, search] =
    await Promise.all([
      getUserById(userId),
      getActiveUserSubscription({ userId }),
      getUserBalance(userId),
      checkImageGenerationQuota(userId),
      checkVideoGenerationQuota(userId),
      checkSearchQuota(userId),
    ]);

  const user = userRecords[0];
  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  // hasSurvey is not yet tracked in the DB (see GIPITI-55 follow-up).
  const hasSurvey = false;
  const tier = getUserTier({ emailVerified: user.emailVerified }, hasSurvey);

  return Response.json({
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    currentPlan: balanceInfo?.currentPlan ?? "free",
    tier,
    isTester: user.isTester,
    hasActiveSubscription: subscription !== null,
    tokenBalance: balanceInfo?.balance ?? 0,
    imageGenerations: image.quotaInfo?.remaining ?? 0,
    videoGenerations: video.quotaInfo?.remaining ?? 0,
    webSearches: search.quotaInfo?.remaining ?? 0,
  });
}
