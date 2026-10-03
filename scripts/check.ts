/**
 * One-shot health check of the app: types, lint + formatting, unit tests, and
 * a production build.
 *
 *   pnpm check        # everything
 *   pnpm check:fast   # skip the production build
 *
 * The static checks run in parallel. The build runs only once they pass — a
 * type error would fail the build too, just 30s later and with noisier output.
 * Passing steps print one line; failing steps print their full output, so the
 * report stays short enough for an agent to read after every change.
 */
import { execFileSync, spawn } from "node:child_process";

import { config as loadDotenv } from "dotenv";

type CheckStep = {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
};

type StepResult = {
  step: CheckStep;
  isSuccess: boolean;
  output: string;
  durationMs: number;
};

/** Same precedence `next build` uses: earlier files win. */
const BUILD_ENV_FILES = [
  ".env.production.local",
  ".env.local",
  ".env.production",
  ".env",
];

/**
 * Env vars that modules read at import time while Next collects page data.
 * Fresh worktrees have no `.env*` files, so without these the build fails for
 * reasons unrelated to the code. Used only when the var is set nowhere else.
 */
const BUILD_ENV_PLACEHOLDERS: Record<string, string> = {
  AUTH_SECRET: "placeholder-secret-for-local-build-check",
  RESEND_API_KEY: "re_placeholder",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
};

/**
 * Tracked files the steps rewrite as a side effect: `next build` flips the
 * routes import in `next-env.d.ts` (dev ↔ build) and `tsc` rewrites its
 * incremental cache. Restored afterwards so a check never dirties the tree.
 */
const GENERATED_TRACKED_FILES = ["next-env.d.ts", "tsconfig.tsbuildinfo"];

const isInteractive = Boolean(process.stdout.isTTY);

// Output is captured through a pipe, so children never see a TTY: force colors
// for a human at a terminal, strip them for agents and CI logs.
const colorEnv: Record<string, string> = isInteractive
  ? { FORCE_COLOR: "1" }
  : { NO_COLOR: "1", FORCE_COLOR: "0" };

const formatDuration = (durationMs: number): string =>
  `${(durationMs / 1000).toFixed(1)}s`;

const runStep = (step: CheckStep): Promise<StepResult> => {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const outputChunks: string[] = [];
    const child = spawn(step.command, step.args, {
      env: { ...process.env, ...colorEnv, ...step.env },
    });

    child.stdout.on("data", (chunk: Buffer) =>
      outputChunks.push(chunk.toString())
    );
    child.stderr.on("data", (chunk: Buffer) =>
      outputChunks.push(chunk.toString())
    );

    const finish = (isSuccess: boolean): void => {
      const durationMs = Date.now() - startedAt;
      const output = outputChunks.join("");
      process.stdout.write(
        `${isSuccess ? "✓" : "✗"} ${step.name} (${formatDuration(durationMs)})\n`
      );
      resolve({ step, isSuccess, output, durationMs });
    };

    child.on("error", (error: Error) => {
      outputChunks.push(
        `Failed to start \`${step.command}\`: ${error.message}\n`
      );
      finish(false);
    });
    child.on("close", (exitCode: number | null) => finish(exitCode === 0));
  });
};

/** Real values from `.env*` files and the shell, plus placeholders for the gaps. */
const resolveBuildEnv = (): {
  env: Record<string, string>;
  placeholderKeys: string[];
} => {
  const fileEnv: Record<string, string> = {};
  loadDotenv({ path: BUILD_ENV_FILES, processEnv: fileEnv, quiet: true });

  const placeholderKeys = Object.keys(BUILD_ENV_PLACEHOLDERS).filter(
    (key) => !(process.env[key] || fileEnv[key])
  );
  const placeholders = Object.fromEntries(
    placeholderKeys.map((key) => [key, BUILD_ENV_PLACEHOLDERS[key]])
  );

  return { env: placeholders, placeholderKeys };
};

const isFileUnmodified = (filePath: string): boolean => {
  try {
    execFileSync("git", ["diff", "--quiet", "--", filePath], {
      stdio: "ignore",
    });
    return true;
  } catch {
    // Non-zero exit: modified (or not a git checkout) — leave it alone.
    return false;
  }
};

const restoreFiles = (filePaths: string[]): void => {
  if (filePaths.length === 0) {
    return;
  }
  try {
    execFileSync("git", ["checkout", "--", ...filePaths], { stdio: "ignore" });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `Could not restore ${filePaths.join(", ")}: ${reason}\n`
    );
  }
};

const printFailures = (failedResults: StepResult[]): void => {
  for (const { step, output } of failedResults) {
    process.stdout.write(
      `\n━━━ ${step.name} failed ━━━\n${output.trimEnd()}\n`
    );
  }
};

const main = async (): Promise<void> => {
  const shouldBuild = !process.argv.includes("--skip-build");
  const startedAt = Date.now();
  const cleanGeneratedFiles = GENERATED_TRACKED_FILES.filter(isFileUnmodified);

  const staticSteps: CheckStep[] = [
    { name: "typecheck", command: "pnpm", args: ["--silent", "typecheck"] },
    { name: "lint + format", command: "pnpm", args: ["--silent", "lint"] },
    { name: "unit tests", command: "pnpm", args: ["--silent", "test:unit"] },
  ];

  process.stdout.write(`▶ ${staticSteps.map(({ name }) => name).join(", ")}\n`);
  const results = await Promise.all(staticSteps.map(runStep));
  const hasStaticFailure = results.some(({ isSuccess }) => !isSuccess);

  if (shouldBuild && hasStaticFailure) {
    process.stdout.write("- build skipped: fix the failures above first\n");
  }

  if (shouldBuild && !hasStaticFailure) {
    const { env, placeholderKeys } = resolveBuildEnv();
    const placeholderNote =
      placeholderKeys.length > 0
        ? ` (placeholder env: ${placeholderKeys.join(", ")})`
        : "";

    process.stdout.write(`▶ build${placeholderNote}\n`);
    // Plain `next build`, not `pnpm build` — that one runs DB migrations first.
    results.push(
      await runStep({
        name: "build",
        command: "pnpm",
        args: ["exec", "next", "build"],
        env,
      })
    );
  }

  restoreFiles(cleanGeneratedFiles);

  const failedResults = results.filter(({ isSuccess }) => !isSuccess);
  printFailures(failedResults);

  const totalDuration = formatDuration(Date.now() - startedAt);
  if (failedResults.length > 0) {
    const failedNames = failedResults.map(({ step }) => step.name).join(", ");
    process.stdout.write(
      `\n✗ check failed in ${totalDuration}: ${failedNames}\n`
    );
    process.exitCode = 1;
    return;
  }

  const scope = shouldBuild ? "all checks" : "all checks except build";
  process.stdout.write(`\n✓ ${scope} passed in ${totalDuration}\n`);
};

main().catch((error: unknown) => {
  process.stderr.write(
    `check script crashed: ${error instanceof Error ? error.stack : error}\n`
  );
  process.exitCode = 1;
});
