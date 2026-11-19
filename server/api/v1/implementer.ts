import { implement } from "@orpc/server";

import type { InitialContext } from "@/server/api/_kit/context";
import { handleErrors } from "@/server/api/_kit/middleware";
import { v1Contract } from "@/server/api/v1/contract";

/**
 * The typed builder every v1 router file starts from: `v1.me.get.handler(…)`
 * must match the contract, and every procedure goes through `handleErrors`.
 */
export const v1 = implement(v1Contract)
  .$context<InitialContext>()
  .use(handleErrors);
