/**
 * Integration tests: real Postgres, no module-path mocks.
 *
 *   pnpm test:integration
 *
 * Kept apart from `vitest.config.ts` on purpose, so `vitest run` and
 * `pnpm check` can never start a test that touches a database.
 */
import { resolve } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

import { resolveTestDatabase } from "./tests/integration/test-database-url";

const testDatabase = resolveTestDatabase();

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/__integration__/**/*.test.ts"],
    exclude: [...configDefaults.exclude, ".claude/**", "**/.next/**"],
    globalSetup: ["tests/integration/global-setup.ts"],
    // One database is shared by every file, and each file resets its tables.
    fileParallelism: false,
    env: {
      // `server/db/connection.ts` reads POSTGRES_URL once, at import.
      POSTGRES_URL: testDatabase.connectionString,
      CLOUDPAYMENTS_PUBLIC_ID: "pk_integration_test",
      CLOUDPAYMENTS_API_SECRET: "integration-test-api-secret",
    },
  },
  resolve: {
    alias: {
      "server-only": resolve(
        __dirname,
        "tests/integration/server-only-stub.ts"
      ),
      "@": resolve(__dirname, "."),
    },
  },
});
