import { getBalance } from "@/lib/billing/balance";
import { getActiveUserSubscription } from "@/lib/db/query/subscription/get-active-user-subscription";
import { requireAuth } from "@/server/api/_kit/middleware";
import { toMeDto } from "@/server/api/v1/_mappers/me";
import { v1 } from "@/server/api/v1/implementer";
import { isTopupEnabled } from "@/server/flags";
import { getUserById } from "@/server/modules/users/queries/get-by-id";

export const meRouter = {
  get: v1.me.get.use(requireAuth).handler(async ({ context, errors }) => {
    const { userId } = context.principal;

    // Read from the database on every call: the session holds a snapshot
    // taken at login. The flag is evaluated for this user explicitly, since
    // a caller of this API is not always identified by a cookie.
    const [user, activeSubscription, balance, isTopupOn] = await Promise.all([
      getUserById(userId),
      getActiveUserSubscription({ userId }),
      getBalance(userId),
      isTopupEnabled.run({ identify: { user: { id: userId } } }),
    ]);

    // The account behind the session is gone.
    if (!user) {
      throw errors.UNAUTHORIZED();
    }

    return toMeDto({
      user,
      hasActiveSubscription: activeSubscription !== null,
      balance,
      isTopupEnabled: isTopupOn,
    });
  }),
};
