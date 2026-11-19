import { auth } from "@/app/(auth)/auth";
import type { CookieSession } from "@/server/api/_kit/context";
import { createHandler } from "@/server/api/_kit/create-handler";
import { V1_PREFIX } from "@/server/api/v1/contract";
import openApiDocument from "@/server/api/v1/openapi.snapshot.json" with {
  type: "json",
};
import { v1Router } from "@/server/api/v1/router";

// Every v1 procedure answers through this one function. Streaming chat
// routes, which need a longer limit, get route files of their own.
export const maxDuration = 60;

/**
 * The browser session, for callers that send no `Authorization` header. It is
 * passed down because code under `server/` may not import the auth module
 * while that still lives under `app/`.
 */
const getCookieSession = async (): Promise<CookieSession | null> => {
  const session = await auth();
  return session?.user?.id ? { userId: session.user.id } : null;
};

const handlers = createHandler(v1Router, {
  prefix: V1_PREFIX,
  getCookieSession,
  openApiDocument,
});

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PUT = handlers.PUT;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
export const HEAD = handlers.HEAD;
