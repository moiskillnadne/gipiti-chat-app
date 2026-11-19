/**
 * Regenerate the committed OpenAPI document of `/api/v1`:
 *
 *   pnpm api:spec
 *
 * It reads the contract only (shapes, no handlers), so it needs no database
 * and no environment. `server/api/v1/__tests__/openapi-snapshot.test.ts`
 * fails in `pnpm check` when the file is out of date.
 */
import { writeFileSync } from "node:fs";

import {
  generateOpenApiDocument,
  serializeOpenApiDocument,
} from "@/server/api/_kit/openapi";
import {
  V1_PREFIX,
  V1_TITLE,
  V1_VERSION,
  v1Contract,
} from "@/server/api/v1/contract";

const SNAPSHOT_PATH = "server/api/v1/openapi.snapshot.json";

const run = async (): Promise<void> => {
  const document = await generateOpenApiDocument({
    contract: v1Contract,
    title: V1_TITLE,
    version: V1_VERSION,
    serverUrl: V1_PREFIX,
  });

  writeFileSync(SNAPSHOT_PATH, serializeOpenApiDocument(document));
  console.log(`Wrote ${SNAPSHOT_PATH}`);
};

run().catch((error: unknown) => {
  console.error("Could not generate the OpenAPI document:", error);
  process.exit(1);
});
