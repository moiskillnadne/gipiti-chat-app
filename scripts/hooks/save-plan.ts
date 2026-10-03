import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";

import {
  buildPlanFileName,
  extractPlanTitle,
  renderPlanDocument,
  slugifyTitle,
} from "./plan-file";

/**
 * Claude Code `PostToolUse` hook for `ExitPlanMode` (wired in `.claude/settings.json`).
 * Fires only when the user approves a plan, and saves it to
 * `docs/plans/YYYY-MM-DD-<slug>.md` without relying on the model to remember.
 *
 * The saved path is reported back to Claude via `additionalContext` so it can
 * keep the file in sync when the implementation departs from the plan.
 */

type ExitPlanModeHookInput = {
  session_id?: string;
  cwd?: string;
  tool_name?: string;
  tool_input?: { plan?: string | null; planFilePath?: string };
  tool_response?: { plan?: string | null; filePath?: string };
};

type PostToolUseOutput = {
  hookSpecificOutput: {
    hookEventName: "PostToolUse";
    additionalContext: string;
  };
};

const PLANS_DIRECTORY = join("docs", "plans");

const readHookInput = (): ExitPlanModeHookInput => {
  const rawInput = readFileSync(0, "utf8");
  const parsedInput: unknown = JSON.parse(rawInput);

  if (typeof parsedInput !== "object" || parsedInput === null) {
    throw new Error("Hook input is not a JSON object");
  }

  return parsedInput as ExitPlanModeHookInput;
};

const readPlanFromDisk = (planFilePath: string | undefined): string | null => {
  if (!(planFilePath && existsSync(planFilePath))) {
    return null;
  }

  return readFileSync(planFilePath, "utf8");
};

/**
 * `tool_response.plan` is what the user actually approved (including edits made
 * in the approval UI); `tool_input.plan` is injected from the plan file on disk.
 */
const resolvePlanText = (hookInput: ExitPlanModeHookInput): string | null => {
  const { tool_input: toolInput, tool_response: toolResponse } = hookInput;
  const inlinePlan = toolResponse?.plan ?? toolInput?.plan;

  if (inlinePlan?.trim()) {
    return inlinePlan;
  }

  return (
    readPlanFromDisk(toolResponse?.filePath) ??
    readPlanFromDisk(toolInput?.planFilePath)
  );
};

const getCurrentBranch = (workingDirectory: string): string | null => {
  try {
    const branch = execFileSync("git", ["branch", "--show-current"], {
      cwd: workingDirectory,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();

    // Empty on a detached HEAD.
    return branch || null;
  } catch {
    // Not a git checkout — the branch is optional metadata.
    return null;
  }
};

/** Local calendar date (not UTC), so a late-evening plan isn't filed under tomorrow. */
const getLocalDate = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${now.getFullYear()}-${month}-${day}`;
};

const main = (): void => {
  const hookInput = readHookInput();
  const planText = resolvePlanText(hookInput);

  if (!planText) {
    console.error(
      "[save-plan] ExitPlanMode carried no plan text — nothing saved."
    );
    return;
  }

  const projectDirectory =
    process.env.CLAUDE_PROJECT_DIR ?? hookInput.cwd ?? process.cwd();
  const plansDirectory = join(projectDirectory, PLANS_DIRECTORY);
  mkdirSync(plansDirectory, { recursive: true });

  const date = getLocalDate();
  const fileName = buildPlanFileName(
    date,
    slugifyTitle(extractPlanTitle(planText)),
    new Set(readdirSync(plansDirectory))
  );
  const planDocument = renderPlanDocument(planText, {
    date,
    branch: getCurrentBranch(projectDirectory),
    sessionId: hookInput.session_id ?? null,
  });

  const planFilePath = join(plansDirectory, fileName);
  writeFileSync(planFilePath, planDocument, { flag: "wx" });

  const relativePlanPath = relative(projectDirectory, planFilePath);
  const output: PostToolUseOutput = {
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: [
        `The approved plan was saved to ${relativePlanPath}.`,
        "If the implementation departs from the plan, update that file in the same commit.",
      ].join(" "),
    },
  };

  process.stdout.write(JSON.stringify(output));
};

try {
  main();
} catch (error) {
  // Exit 1 = non-blocking hook error: surfaced to the user, the session continues.
  console.error("[save-plan] Failed to save the approved plan:", error);
  process.exit(1);
}
