import { listActiveSubscriptionsWithPrices } from "@/lib/billing/subscriptions";
import { isSubscriptionPurchaseAllowed } from "@/lib/billing/tester-plans";
import { withPrincipal } from "@/server/api/_kit/middleware";
import { toPlanDto } from "@/server/api/v1/_mappers/plan";
import { v1 } from "@/server/api/v1/implementer";
import { getUserById } from "@/server/modules/users/queries/get-by-id";

/** Tester status comes from the `User` row, never from the session. */
const readIsTester = async (userId: string | undefined): Promise<boolean> => {
  if (!userId) {
    return false;
  }
  const user = await getUserById(userId);
  return user?.isTester ?? false;
};

export const plansRouter = {
  list: v1.plans.list.use(withPrincipal).handler(async ({ context }) => {
    const [catalog, isTester] = await Promise.all([
      listActiveSubscriptionsWithPrices(),
      readIsTester(context.principal?.userId),
    ]);

    return {
      items: catalog
        .filter(({ subscription }) =>
          isSubscriptionPurchaseAllowed({ code: subscription.code, isTester })
        )
        .map(toPlanDto),
    };
  }),
};
