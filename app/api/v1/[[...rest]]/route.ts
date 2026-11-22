import { createHandler } from "@/server/api/_kit/create-handler";
import { V1_PREFIX } from "@/server/api/v1/contract";
import openApiDocument from "@/server/api/v1/openapi.snapshot.json" with {
  type: "json",
};
import { v1Router } from "@/server/api/v1/router";

// Every v1 procedure answers through this one function. Streaming chat
// routes, which need a longer limit, get route files of their own.
export const maxDuration = 60;

const handlers = createHandler(v1Router, {
  prefix: V1_PREFIX,
  openApiDocument,
});

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PUT = handlers.PUT;
export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
export const HEAD = handlers.HEAD;
