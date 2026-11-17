// SPIKE S6 (GIPITI-231), not for main. A second version that spreads the
// first, overrides one procedure and drops another. The question is only
// whether this typechecks.
import { oc } from "@orpc/contract";
import { implement } from "@orpc/server";
import { z } from "zod/v4";

import { spikeContract } from "./contract";
import { type SpikeContext, spikeRouter } from "./router";

const { boom: _removedProcedure, ...contractWithoutBoom } = spikeContract;

export const spikeContractV2 = {
  ...contractWithoutBoom,
  // Overridden: a different output shape under the same key and path.
  config: oc
    .route({ method: "GET", path: "/config" })
    .output(
      z.object({
        minSupportedVersion: z.string(),
        features: z.array(z.string()),
      })
    ),
  chats: {
    ...spikeContract.chats,
    // Added: a nested procedure next to the inherited ones.
    list: oc
      .route({ method: "GET", path: "/chats" })
      .output(z.object({ items: z.array(z.string()) })),
  },
};

const os = implement(spikeContractV2).$context<SpikeContext>();

const { boom: _removedHandler, ...routerWithoutBoom } = spikeRouter;

export const spikeRouterV2 = os.router({
  ...routerWithoutBoom,
  config: os.config.handler(() => ({
    minSupportedVersion: "2.0.0",
    features: ["topup"],
  })),
  chats: {
    ...spikeRouter.chats,
    list: os.chats.list.handler(() => ({ items: [] })),
  },
});
