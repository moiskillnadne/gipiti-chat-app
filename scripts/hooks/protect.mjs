import { existsSync, readFileSync } from "node:fs";

import { findViolatedRule, toProjectRelativePath } from "./protected-paths.mjs";

/**
 * Claude Code `PreToolUse` hook for file-editing tools (wired in `.claude/settings.json`).
 * Blocks edits to paths listed in `PROTECTION_RULES` (`protected-paths.mjs`).
 *
 * Exit 2 blocks the tool call and feeds stderr back to Claude; exit 0 lets it through.
 * Only file-editing tools are covered — a Bash command can still write these paths.
 *
 * Plain JS run with bare `node`: it fires before every edit, so startup time matters.
 */

/**
 * @typedef {object} FileEditHookInput
 * @property {string} [cwd]
 * @property {string} [tool_name]
 * @property {{ file_path?: string, notebook_path?: string }} [tool_input]
 */

const BLOCKING_EXIT_CODE = 2;

/** @returns {FileEditHookInput} */
const readHookInput = () => {
  /** @type {unknown} */
  const parsedInput = JSON.parse(readFileSync(0, "utf8"));

  if (typeof parsedInput !== "object" || parsedInput === null) {
    throw new Error("Hook input is not a JSON object");
  }

  return /** @type {FileEditHookInput} */ (parsedInput);
};

/** @returns {void} */
const main = () => {
  const { cwd, tool_input: toolInput } = readHookInput();
  const filePath = toolInput?.file_path ?? toolInput?.notebook_path;

  if (!filePath) {
    return;
  }

  const projectDirectory =
    process.env.CLAUDE_PROJECT_DIR ?? cwd ?? process.cwd();
  const relativePath = toProjectRelativePath(filePath, projectDirectory);
  const violatedRule = findViolatedRule({
    relativePath,
    isExistingFile: existsSync(filePath),
  });

  if (!violatedRule) {
    return;
  }

  console.error(
    `Editing ${relativePath} is blocked: ${violatedRule.reason}. Ask the user to do it manually.`
  );
  process.exit(BLOCKING_EXIT_CODE);
};

try {
  main();
} catch (error) {
  // Exit 1 = non-blocking hook error: shown to the user, the edit is NOT blocked (fails open).
  console.error("[protect] Failed to check the edited path:", error);
  process.exit(1);
}
