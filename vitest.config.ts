import { resolve } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "**/__tests__/**/*.test.ts",
      "tests/characterization/**/*.test.ts",
      "tests/architecture/**/*.test.ts",
    ],
    // `.claude/worktrees/*` holds full checkouts of other branches and `.next`
    // holds build output; neither is part of this checkout's test suite.
    exclude: [...configDefaults.exclude, ".claude/**", "**/.next/**"],
    // Measured on demand (`vitest run --coverage`, as CI does). There are no
    // thresholds yet: they are set per `server/` folder as those folders appear.
    // `server/` and `core/` are listed before they exist, so code that moves
    // there does not drop out of the measurement.
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      include: ["app/**", "client/**", "lib/**", "server/**", "core/**"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
