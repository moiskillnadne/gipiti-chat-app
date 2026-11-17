// SPIKE (GIPITI-231), not for main.
import { oc } from "@orpc/contract";
import { z } from "zod/v4";

import { openEnumByMeta, openEnumByRegistry } from "./open-enum";

const authErrors = {
  UNAUTHORIZED: { status: 401, message: "Sign in to continue." },
} as const;

const insufficientBalance = {
  INSUFFICIENT_BALANCE: {
    status: 402,
    message: "Top up to continue.",
    data: z.object({ reason: z.string() }),
  },
} as const;

export const spikeContract = {
  config: oc
    .route({ method: "GET", path: "/config", summary: "Public config" })
    .output(
      z.object({
        minSupportedVersion: z.string(),
        tier: openEnumByMeta(["free", "paid"]),
        channel: openEnumByRegistry(["stable", "beta"]),
        closed: z.enum(["a", "b"]),
      })
    ),

  me: oc
    .errors(authErrors)
    .route({ method: "GET", path: "/me", summary: "Current user" })
    .output(z.object({ userId: z.string(), via: z.string() })),

  echo: oc
    .route({ method: "GET", path: "/echo", summary: "Query coercion" })
    .input(
      z.object({
        limit: z.coerce.number().int().min(1).max(100).default(20),
        archived: z.stringbool().optional(),
        cursor: z.string().optional(),
      })
    )
    .output(
      z.object({
        limit: z.number(),
        archived: z.boolean().nullable(),
        cursor: z.string().nullable(),
        limitType: z.string(),
      })
    ),

  charge: oc
    .errors({ ...authErrors, ...insufficientBalance })
    .route({
      method: "POST",
      path: "/charge",
      summary: "Typed error with data",
    })
    .input(z.object({ amount: z.number().int().positive() }))
    .output(z.object({ charged: z.number() })),

  boom: oc
    .route({ method: "GET", path: "/boom", summary: "Unexpected error" })
    .output(z.object({ ok: z.boolean() })),

  chats: {
    turns: {
      stop: oc
        .errors(authErrors)
        .route({
          method: "POST",
          path: "/chats/{chatId}/turns/{turnId}/stop",
          summary: "Stop a turn (S3: must reach the catch-all)",
        })
        .input(z.object({ chatId: z.string(), turnId: z.string() }))
        .output(z.object({ chatId: z.string(), turnId: z.string() })),
    },
  },

  files: {
    upload: oc
      .route({ method: "POST", path: "/files", summary: "S4: File input" })
      .input(z.object({ file: z.file(), note: z.string().optional() }))
      .output(
        z.object({ name: z.string(), size: z.number(), type: z.string() })
      ),
  },

  flags: {
    topup: oc
      .route({ method: "GET", path: "/flags/topup", summary: "S7" })
      .input(z.object({ userId: z.string().optional() }))
      .output(
        z.object({ forCookieUser: z.boolean(), forExplicitUser: z.boolean() })
      ),
  },
};
