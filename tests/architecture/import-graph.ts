/**
 * Reads the repository's TypeScript files and lists what each one imports.
 * Uses the TypeScript parser only (no type checker), so it stays fast enough
 * to run inside the unit test suite.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { posix } from "node:path";

import ts from "typescript";

export type ImportEdge = {
  /** Repo-relative path of the importing file. */
  from: string;
  /** The specifier exactly as written in the source. */
  specifier: string;
  /**
   * Repo-relative target without a file extension (`lib/db/connection`), or
   * null when the specifier names a package.
   */
  to: string | null;
  /** Package name (`next`, `@orpc/server`, `node:fs`), or null for a file. */
  packageName: string | null;
  /** `import type`, `export type`, or a `typeof import()` type reference. */
  isTypeOnly: boolean;
  /** A `vi.mock` / `vi.doMock` / `vi.importActual` style call. */
  isMock: boolean;
  isRelative: boolean;
  importedNames: string[];
};

export type SourceModule = {
  path: string;
  /** The file starts with a `"use client"` directive. */
  hasUseClientDirective: boolean;
  edges: ImportEdge[];
};

const ALIAS_PREFIX = "@/";
const SOURCE_EXTENSION_PATTERN = /\.(?:d\.ts|tsx?|mjs|cjs|jsx?)$/;

const VI_MODULE_CALLS = new Set([
  "mock",
  "doMock",
  "unmock",
  "doUnmock",
  "importActual",
  "importMock",
]);

export const stripSourceExtension = (path: string): string =>
  path.replace(SOURCE_EXTENSION_PATTERN, "");

const packageNameOf = (specifier: string): string => {
  const segments = specifier.split("/");
  return specifier.startsWith("@")
    ? segments.slice(0, 2).join("/")
    : segments[0];
};

type ResolvedSpecifier = Pick<ImportEdge, "to" | "packageName" | "isRelative">;

const resolveSpecifier = (
  from: string,
  specifier: string
): ResolvedSpecifier => {
  if (specifier.startsWith(ALIAS_PREFIX)) {
    return {
      to: stripSourceExtension(specifier.slice(ALIAS_PREFIX.length)),
      packageName: null,
      isRelative: false,
    };
  }
  if (specifier.startsWith(".")) {
    const target = posix.normalize(posix.join(posix.dirname(from), specifier));
    return {
      to: stripSourceExtension(target),
      packageName: null,
      isRelative: true,
    };
  }
  return { to: null, packageName: packageNameOf(specifier), isRelative: false };
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

const importedNamesOf = (clause: ts.ImportClause | undefined): string[] => {
  if (!clause) {
    return [];
  }
  const names = clause.name ? ["default"] : [];
  const bindings = clause.namedBindings;
  if (bindings && ts.isNamedImports(bindings)) {
    names.push(
      ...bindings.elements.map(
        (element) => (element.propertyName ?? element.name).text
      )
    );
  }
  return names;
};

/** `import type …`, or named imports where every name carries `type`. */
const isTypeOnlyImport = (clause: ts.ImportClause | undefined): boolean => {
  if (!clause) {
    return false;
  }
  if (clause.isTypeOnly) {
    return true;
  }
  const bindings = clause.namedBindings;
  return (
    !clause.name &&
    bindings !== undefined &&
    ts.isNamedImports(bindings) &&
    bindings.elements.length > 0 &&
    bindings.elements.every((element) => element.isTypeOnly)
  );
};

const isTypeOnlyExport = (node: ts.ExportDeclaration): boolean => {
  if (node.isTypeOnly) {
    return true;
  }
  const clause = node.exportClause;
  return (
    clause !== undefined &&
    ts.isNamedExports(clause) &&
    clause.elements.length > 0 &&
    clause.elements.every((element) => element.isTypeOnly)
  );
};

type EdgeDraft = Pick<
  ImportEdge,
  "specifier" | "isTypeOnly" | "isMock" | "importedNames"
>;

const edgeDraftOf = (node: ts.Node): EdgeDraft | undefined => {
  if (
    ts.isImportDeclaration(node) &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return {
      specifier: node.moduleSpecifier.text,
      isTypeOnly: isTypeOnlyImport(node.importClause),
      isMock: false,
      importedNames: importedNamesOf(node.importClause),
    };
  }
  if (
    ts.isExportDeclaration(node) &&
    node.moduleSpecifier &&
    ts.isStringLiteral(node.moduleSpecifier)
  ) {
    return {
      specifier: node.moduleSpecifier.text,
      isTypeOnly: isTypeOnlyExport(node),
      isMock: false,
      importedNames: [],
    };
  }
  if (
    ts.isImportTypeNode(node) &&
    ts.isLiteralTypeNode(node.argument) &&
    ts.isStringLiteral(node.argument.literal)
  ) {
    return {
      specifier: node.argument.literal.text,
      isTypeOnly: true,
      isMock: false,
      importedNames: [],
    };
  }
  if (!ts.isCallExpression(node)) {
    return;
  }

  const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
  const isMock = isViModuleCall(node);
  const [firstArgument] = node.arguments;
  if (
    !(isDynamicImport || isMock) ||
    firstArgument === undefined ||
    !ts.isStringLiteralLike(firstArgument)
  ) {
    return;
  }
  return {
    specifier: firstArgument.text,
    isTypeOnly: false,
    isMock,
    importedNames: [],
  };
};

const hasUseClientDirective = (sourceFile: ts.SourceFile): boolean => {
  const [firstStatement] = sourceFile.statements;
  return (
    firstStatement !== undefined &&
    ts.isExpressionStatement(firstStatement) &&
    ts.isStringLiteral(firstStatement.expression) &&
    firstStatement.expression.text === "use client"
  );
};

/** Parse one file's source text into its import edges. */
export const parseSourceModule = (
  path: string,
  sourceText: string
): SourceModule => {
  const sourceFile = ts.createSourceFile(
    path,
    sourceText,
    ts.ScriptTarget.Latest,
    false,
    path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const edges: ImportEdge[] = [];

  const visit = (node: ts.Node): void => {
    const draft = edgeDraftOf(node);
    if (draft) {
      edges.push({
        from: path,
        ...draft,
        ...resolveSpecifier(path, draft.specifier),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);

  return {
    path,
    hasUseClientDirective: hasUseClientDirective(sourceFile),
    edges,
  };
};

/**
 * Every TypeScript file git knows about in this checkout, tracked or new.
 * Ignored paths (`node_modules`, `.next`, `.claude/worktrees`) are skipped.
 */
export const listSourceFiles = (repoRoot: string): string[] =>
  execFileSync(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      "*.ts",
      "*.tsx",
    ],
    { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
  )
    .split("\n")
    .filter((path) => path.length > 0 && !path.endsWith(".d.ts"));

/** Parse every source file in the repository. Deleted-but-tracked files are skipped. */
export const readSourceModules = (repoRoot: string): SourceModule[] =>
  listSourceFiles(repoRoot).flatMap((path): SourceModule[] => {
    try {
      const sourceText = readFileSync(posix.join(repoRoot, path), "utf8");
      return [parseSourceModule(path, sourceText)];
    } catch (error) {
      const isMissingFile =
        error instanceof Error && "code" in error && error.code === "ENOENT";
      if (isMissingFile) {
        return [];
      }
      throw error;
    }
  });
