import { requireAuth } from "@/server/api/_kit/middleware";
import { toSubscriptionDto } from "@/server/api/v1/_mappers/billing";
import { v1 } from "@/server/api/v1/implementer";
import { getSubscriptionSummary } from "@/server/modules/subscription/get-subscription-summary";

export const meSubscriptionRouter = {
  get: v1.me.subscription.get.use(requireAuth).handler(async ({ context }) => {
    const summary = await getSubscriptionSummary({
      userId: context.principal.userId,
    });

    return { subscription: summary ? toSubscriptionDto(summary) : null };
  }),
};
