// SPIKE (GIPITI-231), not for main.
import { OpenAPIGenerator } from "@orpc/openapi";
import {
  JSON_SCHEMA_OUTPUT_REGISTRY,
  ZodToJsonSchemaConverter,
} from "@orpc/zod/zod4";

import { spikeContract } from "./contract";
import { OPEN_ENUM_VALUES } from "./open-enum";

// Variant B of the open enum: the registry entry lives here, outside the
// contract zone.
for (const [schema, values] of OPEN_ENUM_VALUES) {
  JSON_SCHEMA_OUTPUT_REGISTRY.add(schema, {
    type: "string",
    description: "Open set; unknown values may appear.",
    "x-known-values": [...values],
  } as never);
}

const generator = new OpenAPIGenerator({
  schemaConverters: [new ZodToJsonSchemaConverter()],
});

export const generateSpikeSpec = () =>
  generator.generate(spikeContract, {
    info: { title: "Spike", version: "0.0.0" },
    servers: [{ url: "/api/spike" }],
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
    security: [{ bearerAuth: [] }],
    // S1: does a hand-written path object merge with the generated ones?
    paths: {
      "/chats/{chatId}/turns": {
        post: { summary: "Raw SSE turn (hand-written)", responses: {} },
      },
    },
  });
