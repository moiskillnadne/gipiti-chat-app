import { authRouter } from "@/server/api/v1/auth/router";
import { configRouter } from "@/server/api/v1/config/router";
import { v1 } from "@/server/api/v1/implementer";
import { meRouter } from "@/server/api/v1/me/router";
import { modelsRouter } from "@/server/api/v1/models/router";
import { plansRouter } from "@/server/api/v1/plans/router";

/** The implementation of `v1Contract`; a missing procedure is a type error. */
export const v1Router = v1.router({
  config: configRouter,
  models: modelsRouter,
  plans: plansRouter,
  me: meRouter,
  auth: authRouter,
});
