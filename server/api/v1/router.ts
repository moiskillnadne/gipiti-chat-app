import { authRouter } from "@/server/api/v1/auth/router";
import { chatsRouter } from "@/server/api/v1/chats/router";
import { configRouter } from "@/server/api/v1/config/router";
import { v1 } from "@/server/api/v1/implementer";
import { meRouter } from "@/server/api/v1/me/router";
import { modelsRouter } from "@/server/api/v1/models/router";
import { plansRouter } from "@/server/api/v1/plans/router";
import { projectsRouter } from "@/server/api/v1/projects/router";
import { promptsRouter } from "@/server/api/v1/prompts/router";

/** The implementation of `v1Contract`; a missing procedure is a type error. */
export const v1Router = v1.router({
  config: configRouter,
  models: modelsRouter,
  plans: plansRouter,
  prompts: promptsRouter,
  chats: chatsRouter,
  projects: projectsRouter,
  me: meRouter,
  auth: authRouter,
});
