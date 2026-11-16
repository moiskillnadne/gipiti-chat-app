import { resolve } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: [
      "**/__tests__/**/*.test.ts",
      "tests/characterization/**/*.test.ts",
    ],
    // `.claude/worktrees/*` holds full checkouts of other branches and `.next`
    // holds build output; neither is part of this checkout's test suite.
    exclude: [...configDefaults.exclude, ".claude/**", "**/.next/**"],
    // Measured on demand (`vitest run --coverage`, as CI does). There are no
    // thresholds yet: they are set per `server/` folder as those folders appear.
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary"],
      include: ["app/**", "lib/**"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
