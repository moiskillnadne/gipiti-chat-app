// SPIKE S2 + S5 (GIPITI-231), not for main.
import { createRouterClient } from "@orpc/server";
import { headers } from "next/headers";

import { spikeRouter } from "@/server/api/_spike/router";

import { SpikeClientPanel } from "./spike-client";

export const dynamic = "force-dynamic";

export default async function SpikePage() {
  // S5: the in-process caller. `auth()` inside the procedure reads Next's
  // request scope, so the synthesized Request only has to satisfy the type.
  const requestHeaders = await headers();
  const serverCaller = createRouterClient(spikeRouter, {
    context: {
      request: new Request("http://in-process.invalid/", {
        headers: requestHeaders,
      }),
      transport: "in-process",
    },
  });

  const me = await serverCaller
    .me()
    .then((value) => ({ ok: true as const, value }))
    .catch((error: { code?: string; status?: number }) => ({
      ok: false as const,
      code: error.code,
      status: error.status,
    }));

  return (
    <main>
      <h1>oRPC spike</h1>
      <pre id="spike-rsc-me">{JSON.stringify(me)}</pre>
      <SpikeClientPanel />
    </main>
  );
}
