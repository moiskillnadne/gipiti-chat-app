import { configContract } from "@/server/api/v1/config/contract";
import { meContract } from "@/server/api/v1/me/contract";
import { modelsContract } from "@/server/api/v1/models/contract";
import { plansContract } from "@/server/api/v1/plans/contract";

/**
 * Everything `/api/v1` offers. Later this is the one file client code may
 * import from `server/` (through `client/shared/api/contract`), so it and
 * what it imports hold shapes only: `zod` and `@orpc/contract`, no server
 * code.
 */
export const v1Contract = {
  config: configContract,
  models: modelsContract,
  plans: plansContract,
  me: meContract,
};

export const V1_PREFIX = "/api/v1";
export const V1_TITLE = "GIPITI API";
export const V1_VERSION = "1.0.0";
