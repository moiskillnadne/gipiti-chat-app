import { FREE_TIER_ENTITLEMENTS } from "../../../ai/entitlements";
import { ChatSDKError } from "../../../errors";
import type { UtmData } from "../../../utm/constants";
import { db } from "../../connection";
import { balance, user } from "../../schema";
import { generateHashedPassword } from "../../utils";

export async function createUser(
  email: string,
  password: string,
  utmData?: UtmData
) {
  const hashedPassword = generateHashedPassword(password);

  try {
    return await db.transaction(async (tx) => {
      const [newUser] = await tx
        .insert(user)
        .values({
          email,
          password: hashedPassword,
          ...(utmData && {
            utmSource: utmData.utmSource,
            utmMedium: utmData.utmMedium,
            utmCampaign: utmData.utmCampaign,
            utmContent: utmData.utmContent,
            utmTerm: utmData.utmTerm,
          }),
        })
        .returning();

      // Create user's balance row. Free plan with Tier 1 entitlements is the default.
      await tx
        .insert(balance)
        .values({
          userId: newUser.id,
          plan: "free",
          tokens: FREE_TIER_ENTITLEMENTS.tier_1.tokenBonus,
          imageGeneration: FREE_TIER_ENTITLEMENTS.tier_1.imageBonus,
          videoGeneration: FREE_TIER_ENTITLEMENTS.tier_1.videoBonus,
          webSearches: FREE_TIER_ENTITLEMENTS.tier_1.searchQuota,
        })
        .onConflictDoNothing({ target: balance.userId });

      return newUser;
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create user");
  }
}
