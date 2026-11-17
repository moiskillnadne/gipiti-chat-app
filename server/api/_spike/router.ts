// SPIKE (GIPITI-231), not for main.
import { implement } from "@orpc/server";

import { auth } from "@/app/(auth)/auth";
import { isTopupEnabled } from "@/lib/flags";

import { spikeContract } from "./contract";

export type SpikeContext = {
  request: Request;
  transport: "http" | "in-process";
};

const os = implement(spikeContract).$context<SpikeContext>();

export const spikeRouter = os.router({
  config: os.config.handler(() => ({
    minSupportedVersion: "1.0.0",
    tier: "enterprise",
    channel: "nightly",
    closed: "a" as const,
  })),

  me: os.me.handler(async ({ context, errors }) => {
    // S5: next-auth's `auth()` reads the request cookies from Next's own
    // request scope, not from `context.request`.
    const session = await auth();
    if (!session?.user?.id) {
      throw errors.UNAUTHORIZED();
    }
    return { userId: session.user.id, via: context.transport };
  }),

  echo: os.echo.handler(({ input }) => ({
    limit: input.limit,
    archived: input.archived ?? null,
    cursor: input.cursor ?? null,
    limitType: typeof input.limit,
  })),

  charge: os.charge.handler(({ input, errors }) => {
    if (input.amount > 100) {
      throw errors.INSUFFICIENT_BALANCE({ data: { reason: "balance_empty" } });
    }
    return { charged: input.amount };
  }),

  boom: os.boom.handler(() => {
    throw new Error("secret internal detail: postgres://user:pass@host/db");
  }),

  chats: {
    turns: {
      stop: os.chats.turns.stop.handler(({ input }) => input),
    },
  },

  files: {
    upload: os.files.upload.handler(({ input }) => ({
      name: input.file.name,
      size: input.file.size,
      type: input.file.type,
    })),
  },

  flags: {
    topup: os.flags.topup.handler(async ({ input }) => ({
      forCookieUser: await isTopupEnabled(),
      forExplicitUser: input.userId
        ? await isTopupEnabled.run({
            identify: { user: { id: input.userId } },
          })
        : false,
    })),
  },
});
