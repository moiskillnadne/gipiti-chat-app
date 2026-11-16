/**
 * Fails when a branch changes an existing characterization test in anything
 * but its module specifiers.
 *
 *   pnpm check:characterization-diff              # against origin/main
 *   pnpm check:characterization-diff origin/next  # against another base
 *
 * The tests under `tests/characterization/` pin behaviour while code moves, so
 * a move must leave their assertions alone. New test files and everything in
 * `tests/characterization/targets/` are free to change. A pull request that
 * changes pinned behaviour on purpose carries the `characterization-change`
 * label, and CI then skips this check.
 */
import { execFileSync } from "node:child_process";

import {
  CHARACTERIZATION_DIR,
  type DiffViolation,
  type FileVersions,
  findDiffViolations,
  parseNameStatus,
} from "./lib/characterization-diff";

const DEFAULT_BASE_REF = "origin/main";

class GitCommandError extends Error {
  constructor(args: string[], cause: unknown) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    super(`git ${args.join(" ")} failed: ${reason}`);
    this.name = "GitCommandError";
  }
}

const runGit = (args: string[]): string => {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (error) {
    throw new GitCommandError(args, error);
  }
};

const printViolations = (
  violations: DiffViolation[],
  baseRef: string
): void => {
  const lines = violations.map(({ path, reason }) => `  ${path}: ${reason}`);
  process.stdout.write(
    [
      `✗ characterization tests changed beyond module specifiers (vs ${baseRef}):`,
      ...lines,
      "",
      "A move may only change import / vi.mock specifiers in these files.",
      "If the pinned behaviour changes on purpose, say so in the PR body and",
      "add the `characterization-change` label to the pull request.",
      "",
    ].join("\n")
  );
};

const main = (): void => {
  const baseRef = process.argv[2] ?? DEFAULT_BASE_REF;
  // The merge base, not the tip of the base branch: only this branch's own
  // changes count, whatever landed on the base branch meanwhile.
  const mergeBase = runGit(["merge-base", baseRef, "HEAD"]).trim();

  const changes = parseNameStatus(
    runGit([
      "diff",
      "--name-status",
      "--find-renames",
      mergeBase,
      "HEAD",
      "--",
      CHARACTERIZATION_DIR,
    ])
  );

  const readVersions = (path: string): FileVersions => ({
    before: runGit(["show", `${mergeBase}:${path}`]),
    after: runGit(["show", `HEAD:${path}`]),
  });

  const violations = findDiffViolations(changes, readVersions);
  if (violations.length > 0) {
    printViolations(violations, baseRef);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `✓ characterization tests: ${changes.length} changed file(s), assertions untouched\n`
  );
};

try {
  main();
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  process.stderr.write(`characterization diff check crashed: ${reason}\n`);
  process.exitCode = 1;
}
