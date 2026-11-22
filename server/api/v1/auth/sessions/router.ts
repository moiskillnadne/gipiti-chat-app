import { requireAuth } from "@/server/api/_kit/middleware";
import { toAuthSessionDto } from "@/server/api/v1/_mappers/auth";
import { v1 } from "@/server/api/v1/implementer";
import { endSessionById, listSessions } from "@/server/modules/auth/sessions";

export const authSessionsRouter = {
  list: v1.auth.sessions.list.use(requireAuth).handler(async ({ context }) => {
    const { userId, sessionId } = context.principal;
    const sessions = await listSessions(userId);

    return {
      items: sessions.map((session) => toAuthSessionDto(session, sessionId)),
    };
  }),

  revoke: v1.auth.sessions.revoke
    .use(requireAuth)
    .handler(async ({ input, context, errors }) => {
      // Scoped to the caller's account: a session of someone else is "not
      // found", never "not yours".
      const wasEnded = await endSessionById({
        userId: context.principal.userId,
        sessionId: input.sessionId,
      });

      if (!wasEnded) {
        throw errors.NOT_FOUND();
      }
    }),
};
