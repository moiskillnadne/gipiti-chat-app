/**
 * Rules behind `scripts/check-characterization-diff.ts`.
 *
 * Characterization tests pin behaviour while code moves. A pull request may
 * therefore change an existing characterization test only in its module
 * specifiers (the strings in `import … from "…"`, `vi.mock("…")` and friends).
 * Everything here is pure: git access lives in the script.
 */
import ts from "typescript";

export type FileChangeStatus = "added" | "modified" | "deleted" | "renamed";

export type FileChange = {
  status: FileChangeStatus;
  path: string;
};

export type FileVersions = {
  before: string;
  after: string;
};

export type DiffViolation = {
  path: string;
  reason: string;
};

export const CHARACTERIZATION_DIR = "tests/characterization/";

/** Re-export modules: they exist to change when the code under test moves. */
const TARGETS_DIR = `${CHARACTERIZATION_DIR}targets/`;

const SPECIFIER_PLACEHOLDER = '"<module>"';

/** `vi.<name>(specifier, …)` calls whose first argument names a module. */
const VI_MODULE_CALLS = new Set([
  "mock",
  "doMock",
  "unmock",
  "doUnmock",
  "importActual",
  "importMock",
]);

const CLOSING_TOKENS = new Set(["}", ")", "]"]);

const NAME_STATUS_BY_LETTER: Record<string, FileChangeStatus> = {
  A: "added",
  M: "modified",
  D: "deleted",
  R: "renamed",
};

const isViModuleCall = (node: ts.CallExpression): boolean => {
  const callee = node.expression;
  return (
    ts.isPropertyAccessExpression(callee) &&
    ts.isIdentifier(callee.expression) &&
    callee.expression.text === "vi" &&
    VI_MODULE_CALLS.has(callee.name.text)
  );
};

/** The string literal that names a module in `node`, if `node` has one. */
const moduleSpecifierOf = (node: ts.Node): ts.Node | undefined => {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
    return node.moduleSpecifier;
  }
  if (ts.isImportTypeNode(node)) {
    return node.argument;
  }
  if (!ts.isCallExpression(node)) {
    return;
  }

  const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
  if (!(isDynamicImport || isViModuleCall(node))) {
    return;
  }

  const [firstArgument] = node.arguments;
  return firstArgument && ts.isStringLiteralLike(firstArgument)
    ? firstArgument
    : undefined;
};

/**
 * The file as a list of tokens with every module specifier replaced by a
 * placeholder. Comments and whitespace are not tokens, and a comma before a
 * closing bracket is dropped, so a formatter re-wrapping an import whose path
 * became longer does not count as a change.
 */
export const tokenizeIgnoringSpecifiers = (sourceText: string): string[] => {
  const sourceFile = ts.createSourceFile(
    "characterization.test.ts",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const tokens: string[] = [];
  const specifierNodes = new Set<ts.Node>();

  const visit = (node: ts.Node): void => {
    if (ts.isJSDoc(node)) {
      return;
    }

    const specifier = moduleSpecifierOf(node);
    if (specifier) {
      specifierNodes.add(specifier);
    }
    if (specifierNodes.has(node)) {
      tokens.push(SPECIFIER_PLACEHOLDER);
      return;
    }

    const children = node.getChildren(sourceFile);
    if (children.length > 0) {
      children.forEach(visit);
      return;
    }

    const tokenText = node.getText(sourceFile);
    if (tokenText.length > 0) {
      tokens.push(tokenText);
    }
  };
  visit(sourceFile);

  return tokens.filter(
    (token, index) =>
      !(token === "," && CLOSING_TOKENS.has(tokens[index + 1] ?? ""))
  );
};

/** True when two versions of a test differ only in their module specifiers. */
export const isSpecifierOnlyChange = ({
  before,
  after,
}: FileVersions): boolean => {
  const tokensBefore = tokenizeIgnoringSpecifiers(before);
  const tokensAfter = tokenizeIgnoringSpecifiers(after);

  return (
    tokensBefore.length === tokensAfter.length &&
    tokensBefore.every((token, index) => token === tokensAfter[index])
  );
};

/**
 * Parse `git diff --name-status` output. A rename is reported as the deletion
 * of the old path and the addition of the new one, so the old test counts as
 * removed.
 */
export const parseNameStatus = (nameStatusOutput: string): FileChange[] =>
  nameStatusOutput
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .flatMap((line): FileChange[] => {
      const [statusCode = "", firstPath = "", secondPath] = line.split("\t");
      const status = NAME_STATUS_BY_LETTER[statusCode.charAt(0)];

      if (!status) {
        return [{ status: "modified", path: firstPath }];
      }
      if (status === "renamed" && secondPath) {
        return [
          { status: "renamed", path: firstPath },
          { status: "added", path: secondPath },
        ];
      }
      return [{ status, path: firstPath }];
    });

const isGuardedPath = (path: string): boolean =>
  path.startsWith(CHARACTERIZATION_DIR) && !path.startsWith(TARGETS_DIR);

/**
 * Changes a pull request may not make to characterization tests.
 *
 * @param changes - files changed under `tests/characterization/`
 * @param readVersions - returns a modified file's content before and after
 */
export const findDiffViolations = (
  changes: FileChange[],
  readVersions: (path: string) => FileVersions
): DiffViolation[] =>
  changes
    .filter(({ path }) => isGuardedPath(path))
    .flatMap(({ status, path }): DiffViolation[] => {
      if (status === "added") {
        return [];
      }
      if (status === "deleted" || status === "renamed") {
        return [{ path, reason: `the file was ${status}` }];
      }
      if (isSpecifierOnlyChange(readVersions(path))) {
        return [];
      }
      return [
        { path, reason: "something other than a module specifier changed" },
      ];
    });
