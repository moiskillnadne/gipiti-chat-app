import { requireAuth } from "@/server/api/_kit/middleware";
import { v1 } from "@/server/api/v1/implementer";
import { loadMe } from "@/server/api/v1/me/load-me";

export const meRouter = {
  get: v1.me.get.use(requireAuth).handler(async ({ context, errors }) => {
    const me = await loadMe(context.principal.userId);

    // The account behind the session is gone.
    if (!me) {
      throw errors.UNAUTHORIZED();
    }

    return me;
  }),
};
