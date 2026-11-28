import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

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

const SNAPSHOT_PATH = join(
  process.cwd(),
  "server/api/v1/openapi.snapshot.json"
);

describe("the committed OpenAPI document of /api/v1", () => {
  it("matches the contract; run `pnpm api:spec` after changing a contract", async () => {
    // Arrange
    const committed = readFileSync(SNAPSHOT_PATH, "utf8");

    // Act
    const generated = serializeOpenApiDocument(
      await generateOpenApiDocument({
        contract: v1Contract,
        title: V1_TITLE,
        version: V1_VERSION,
        serverUrl: V1_PREFIX,
      })
    );

    // Assert
    expect(generated).toBe(committed);
  });

  it("describes no closed enum in a response", () => {
    // Arrange: a response enum would break released native clients the day
    // a value is added (see `_kit/open-enum.ts`).
    const document = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));

    // Act
    const responseSchemas = Object.values<Record<string, unknown>>(
      document.paths
    ).flatMap((operations) =>
      Object.values(operations as Record<string, { responses: unknown }>).map(
        (operation) => JSON.stringify(operation.responses)
      )
    );

    // Assert
    expect(
      responseSchemas.filter((schema) => schema.includes('"enum"'))
    ).toEqual([]);
  });
});

describe("who may call each operation of /api/v1", () => {
  it("is declared on every operation, so a new endpoint cannot forget it", () => {
    // Arrange
    const document = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
    const operations = Object.entries<Record<string, { security?: unknown }>>(
      document.paths
    ).flatMap(([path, methods]) =>
      Object.entries(methods).map(([method, operation]) => ({
        name: `${method.toUpperCase()} ${path}`,
        security: operation.security,
      }))
    );

    // Act
    const undeclared = operations
      .filter(({ security }) => !Array.isArray(security))
      .map(({ name }) => name);

    // Assert
    expect(operations.length).toBeGreaterThan(0);
    expect(undeclared).toEqual([]);
  });
});
