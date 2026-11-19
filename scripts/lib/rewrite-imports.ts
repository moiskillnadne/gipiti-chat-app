/**
 * Rules behind `scripts/codemods/rewrite-imports.ts`: after files move, make
 * every module specifier in the repository point at the new place.
 *
 * Everything here is pure. Reading and writing files lives in the script.
 */
import { posix } from "node:path";

import ts from "typescript";

import { moduleSpecifierOf } from "@/scripts/lib/characterization-diff";
import {
  resolveSpecifier,
  stripSourceExtension,
} from "@/tests/architecture/import-graph";

/** Old repo-relative path → new repo-relative path, one entry per moved file. */
export type FileMoves = ReadonlyMap<string, string>;

export type SpecifierChange = {
  /** 1-based line of the specifier in the file. */
  line: number;
  before: string;
  after: string;
};

export type RewriteResult = {
  sourceText: string;
  changes: SpecifierChange[];
};

type RewriteInput = {
  /** Where the file was before the move (its own path if it did not move). */
  oldPath: string;
  /** Where the file is after the move. */
  newPath: string;
  sourceText: string;
  moves: FileMoves;
};

const ALIAS_PREFIX = "@/";
const INDEX_SUFFIX = "/index";

/**
 * Moved modules by their extension-less old path, the form a specifier
 * resolves to. A moved `index` file is also reachable by its folder.
 */
const moduleMovesOf = (moves: FileMoves): Map<string, string> => {
  const moduleMoves = new Map<string, string>();

  for (const [oldFile, newFile] of moves) {
    const oldModule = stripSourceExtension(oldFile);
    const newModule = stripSourceExtension(newFile);
    moduleMoves.set(oldModule, newModule);

    if (oldModule.endsWith(INDEX_SUFFIX) && newModule.endsWith(INDEX_SUFFIX)) {
      moduleMoves.set(
        oldModule.slice(0, -INDEX_SUFFIX.length),
        newModule.slice(0, -INDEX_SUFFIX.length)
      );
    }
  }

  return moduleMoves;
};

/** The extension a specifier spells out (`.json`, `.ts`), or an empty string. */
const writtenExtensionOf = (specifier: string, target: string): string => {
  const lastSegment = specifier.slice(specifier.lastIndexOf("/") + 1);
  const targetSegment = target.slice(target.lastIndexOf("/") + 1);

  return lastSegment.startsWith(targetSegment)
    ? lastSegment.slice(targetSegment.length)
    : "";
};

const relativeSpecifierOf = (fromFile: string, target: string): string => {
  const relativePath = posix.relative(posix.dirname(fromFile), target);
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
};

/**
 * What a specifier has to become, or undefined when it can stay.
 *
 * - A specifier that names a moved module becomes the `@/` path of its new
 *   place.
 * - A relative specifier inside a moved file is resolved against the file's
 *   old place. If the same relative text still reaches the target from the
 *   new place (two files that moved together), it stays; otherwise it becomes
 *   an `@/` path, moved target or not.
 */
const rewrittenSpecifierOf = ({
  specifier,
  oldPath,
  newPath,
  moduleMoves,
}: {
  specifier: string;
  oldPath: string;
  newPath: string;
  moduleMoves: Map<string, string>;
}): string | undefined => {
  const { to: oldTarget, isRelative } = resolveSpecifier(oldPath, specifier);
  if (oldTarget === null) {
    return;
  }

  const newTarget = moduleMoves.get(oldTarget) ?? oldTarget;
  const hasTargetMoved = newTarget !== oldTarget;
  const hasFileMoved = newPath !== oldPath;
  const extension = writtenExtensionOf(specifier, oldTarget);

  if (!isRelative) {
    return hasTargetMoved
      ? `${ALIAS_PREFIX}${newTarget}${extension}`
      : undefined;
  }
  if (!(hasTargetMoved || hasFileMoved)) {
    return;
  }

  const isSameRelativePath =
    relativeSpecifierOf(newPath, `${newTarget}${extension}`) === specifier;

  return isSameRelativePath
    ? undefined
    : `${ALIAS_PREFIX}${newTarget}${extension}`;
};

/** The string literal inside a specifier node (`import("x")` types wrap it). */
const literalOf = (node: ts.Node): ts.StringLiteralLike | undefined => {
  if (ts.isStringLiteralLike(node)) {
    return node;
  }
  if (ts.isLiteralTypeNode(node) && ts.isStringLiteralLike(node.literal)) {
    return node.literal;
  }
  return;
};

/**
 * Rewrite the module specifiers of one file: import and export declarations,
 * `import()` calls and types, and `vi.mock`-style calls. Nothing else in the
 * text changes, quotes included.
 */
export const rewriteSpecifiers = ({
  oldPath,
  newPath,
  sourceText,
  moves,
}: RewriteInput): RewriteResult => {
  const sourceFile = ts.createSourceFile(
    newPath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    newPath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const moduleMoves = moduleMovesOf(moves);
  const edits: { start: number; end: number; change: SpecifierChange }[] = [];

  const visit = (node: ts.Node): void => {
    const specifierNode = moduleSpecifierOf(node);
    const literal = specifierNode ? literalOf(specifierNode) : undefined;

    if (literal) {
      const after = rewrittenSpecifierOf({
        specifier: literal.text,
        oldPath,
        newPath,
        moduleMoves,
      });

      if (after !== undefined) {
        // Inside the quotes, so the file keeps the quote character it uses.
        const start = literal.getStart(sourceFile) + 1;
        const end = literal.getEnd() - 1;
        const { line } = sourceFile.getLineAndCharacterOfPosition(start);
        edits.push({
          start,
          end,
          change: { line: line + 1, before: literal.text, after },
        });
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  // Applied from the end of the file, so earlier positions stay valid.
  const rewrittenText = [...edits]
    .sort((first, second) => second.start - first.start)
    .reduce(
      (text, { start, end, change }) =>
        `${text.slice(0, start)}${change.after}${text.slice(end)}`,
      sourceText
    );

  return {
    sourceText: rewrittenText,
    changes: edits.map(({ change }) => change),
  };
};
