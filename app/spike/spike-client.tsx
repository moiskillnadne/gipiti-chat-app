"use client";

// SPIKE S2 (GIPITI-231), not for main. A browser client for the spike
// contract through OpenAPILink.
import { createORPCClient } from "@orpc/client";
import type { ContractRouterClient } from "@orpc/contract";
import { OpenAPILink } from "@orpc/openapi-client/fetch";
import { useState } from "react";

import { spikeContract } from "@/server/api/_spike/contract";

type SpikeClient = ContractRouterClient<typeof spikeContract>;

const createClient = (): SpikeClient =>
  createORPCClient(
    new OpenAPILink(spikeContract, {
      url: `${window.location.origin}/api/spike`,
    })
  );

export function SpikeClientPanel() {
  const [output, setOutput] = useState("");

  const run = async (
    label: string,
    call: (client: SpikeClient) => Promise<unknown>
  ) => {
    try {
      setOutput(`${label}: ${JSON.stringify(await call(createClient()))}`);
    } catch (error) {
      const details =
        error instanceof Error
          ? { name: error.name, message: error.message, ...(error as object) }
          : error;
      setOutput(`${label} threw: ${JSON.stringify(details)}`);
    }
  };

  return (
    <div>
      <button
        id="spike-config"
        onClick={() => run("config", (c) => c.config())}
        type="button"
      >
        config
      </button>
      <button
        id="spike-echo"
        onClick={() =>
          run("echo", (c) => c.echo({ limit: 7, archived: "true" }))
        }
        type="button"
      >
        echo
      </button>
      <button
        id="spike-me"
        onClick={() => run("me", (c) => c.me())}
        type="button"
      >
        me
      </button>
      <button
        id="spike-charge"
        onClick={() => run("charge", (c) => c.charge({ amount: 500 }))}
        type="button"
      >
        charge
      </button>
      <pre id="spike-output">{output}</pre>
    </div>
  );
}
