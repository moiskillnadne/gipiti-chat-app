/**
 * After files move, point every module specifier in the repository at their
 * new place.
 *
 *   tsx scripts/codemods/rewrite-imports.ts <moves.json> [--dry-run]
 *
 * `moves.json` maps old repo-relative paths to new ones. A path may be a file
 * or a folder (every file under it moves):
 *
 *   { "lib/redis.ts": "server/integrations/redis/client.ts",
 *     "lib/cron": "server/cron" }
 *
 * Run it after `git mv`, when the files are already at their new paths. With
 * `--dry-run` it may also run before the move: it reads the files where they
 * are, works out what would change, prints the totals and writes nothing.
 *
 * Only `*.ts` and `*.tsx` files are rewritten. Paths in configs, scripts in
 * `package.json` and docs are not specifiers and have to be changed by hand.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { posix } from "node:path";

import {
  type FileMoves,
  rewriteSpecifiers,
} from "@/scripts/lib/rewrite-imports";
import { listSourceFiles } from "@/tests/architecture/import-graph";

type MoveState = "before-move" | "after-move";

class InvalidMovesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMovesError";
  }
}

const REPO_ROOT = process.cwd();
const DRY_RUN_FLAG = "--dry-run";

const readMoveEntries = (movesFile: string): [string, string][] => {
  const parsed: unknown = JSON.parse(readFileSync(movesFile, "utf8"));
  const isStringRecord =
    typeof parsed === "object" &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    Object.values(parsed).every((value) => typeof value === "string");

  if (!isStringRecord) {
    throw new InvalidMovesError(
      `${movesFile} must be a JSON object of "old path": "new path" pairs.`
    );
  }

  return Object.entries(parsed as Record<string, string>).map(
    ([oldPath, newPath]) => [posix.normalize(oldPath), posix.normalize(newPath)]
  );
};

/** Whether the paths on disk are still the old ones or already the new ones. */
const detectMoveState = (entries: [string, string][]): MoveState => {
  const states = new Set(
    entries.map(([oldPath, newPath]): MoveState | "unclear" => {
      const hasOld = existsSync(posix.join(REPO_ROOT, oldPath));
      const hasNew = existsSync(posix.join(REPO_ROOT, newPath));
      if (hasOld === hasNew) {
        return "unclear";
      }
      return hasNew ? "after-move" : "before-move";
    })
  );

  const [state] = states;
  if (states.size !== 1 || state === undefined || state === "unclear") {
    throw new InvalidMovesError(
      "Every entry must be in the same state: either all old paths exist and " +
        "no new one does (before the move), or the other way round (after it)."
    );
  }
  return state;
};

const listFilesUnder = (path: string): string[] => {
  if (!statSync(posix.join(REPO_ROOT, path)).isDirectory()) {
    return [path];
  }
  return execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--", path],
    { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  )
    .split("\n")
    .filter((file) => file.length > 0);
};

/** One entry per moved file, expanding folders from wherever they are now. */
const expandMoves = (
  entries: [string, string][],
  state: MoveState
): FileMoves => {
  const moves = new Map<string, string>();

  for (const [oldPath, newPath] of entries) {
    const currentPath = state === "after-move" ? newPath : oldPath;
    for (const currentFile of listFilesUnder(currentPath)) {
      const rest = currentFile.slice(currentPath.length);
      moves.set(`${oldPath}${rest}`, `${newPath}${rest}`);
    }
  }

  return moves;
};

const run = (): void => {
  const args = process.argv.slice(2);
  const isDryRun = args.includes(DRY_RUN_FLAG);
  const [movesFile] = args.filter((arg) => arg !== DRY_RUN_FLAG);

  if (!movesFile) {
    throw new InvalidMovesError(
      "Usage: tsx scripts/codemods/rewrite-imports.ts <moves.json> [--dry-run]"
    );
  }

  const entries = readMoveEntries(movesFile);
  const state = detectMoveState(entries);
  if (state === "before-move" && !isDryRun) {
    throw new InvalidMovesError(
      "The files are still at their old paths. Run `git mv` first, or pass " +
        "--dry-run to see what would change."
    );
  }

  const moves = expandMoves(entries, state);
  const oldPathByNewPath = new Map(
    [...moves].map(([oldPath, newPath]) => [newPath, oldPath])
  );

  let changedFiles = 0;
  let changedSpecifiers = 0;

  for (const currentPath of listSourceFiles(REPO_ROOT)) {
    const oldPath =
      state === "after-move"
        ? (oldPathByNewPath.get(currentPath) ?? currentPath)
        : currentPath;
    const newPath =
      state === "after-move"
        ? currentPath
        : (moves.get(currentPath) ?? currentPath);

    const absolutePath = posix.join(REPO_ROOT, currentPath);
    const sourceText = readFileSync(absolutePath, "utf8");
    const result = rewriteSpecifiers({ oldPath, newPath, sourceText, moves });

    if (result.changes.length === 0) {
      continue;
    }
    changedFiles += 1;
    changedSpecifiers += result.changes.length;
    if (!isDryRun) {
      writeFileSync(absolutePath, result.sourceText);
    }
  }

  const verb = isDryRun ? "Would rewrite" : "Rewrote";
  console.log(
    `${verb} ${changedSpecifiers} specifiers in ${changedFiles} files ` +
      `(${moves.size} moved files, ${state.replace("-", " ")}).`
  );
};

try {
  run();
} catch (error) {
  if (error instanceof InvalidMovesError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}
