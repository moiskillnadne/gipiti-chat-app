import { resolve } from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/__tests__/**/*.test.ts"],
    // `.claude/worktrees/*` holds full checkouts of other branches and `.next`
    // holds build output; neither is part of this checkout's test suite.
    exclude: [...configDefaults.exclude, ".claude/**", "**/.next/**"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
