/**
 * Import boundary rules. Pure: they look only at the edges handed to them.
 *
 * Two groups:
 * - legacy rules for today's `lib/ components/ hooks/ contexts/` layout;
 * - target-structure rules for `client/ server/ core/` from the roadmap
 *   (`docs/plans/2026-11-15-orpc-v1-roadmap.md`, "Dependency rules"). They
 *   match nothing until those folders exist.
 */
import type { ImportEdge, SourceModule } from "./import-graph";

export type RuleId =
  | "lib-imports-app"
  | "client-imports-server-code"
  | "mock-specifier"
  | "response-validation-plugin"
  | "server-caller-read-only"
  | "target-structure"
  | "fsd-layers";

export type Violation = {
  rule: RuleId;
  from: string;
  /** Repo-relative target, or the package name for a package import. */
  to: string;
  message: string;
};

export type RuleContext = {
  /** True when a mocked specifier resolves to a file or installed package. */
  canResolve: (edge: ImportEdge) => boolean;
};

type EdgeRule = (
  module: SourceModule,
  edge: ImportEdge,
  context: RuleContext
) => Omit<Violation, "from" | "to"> | null;

const TEST_FILE_PATTERN =
  /(?:^|\/)(?:__tests__|__integration__)\/|\.test\.tsx?$|^tests\//;

const LEGACY_CLIENT_DIRS = ["components/", "hooks/", "contexts/"];
// `lib/db/` still holds the queries that have not moved with their domain
// yet. Everything under `server/` is server code: the database, the modules,
// the integrations, the webhooks, the flags. The one client file that may
// import from `server/` (`client/shared/api/contract.ts`) is not a client
// module here (no `"use client"`, outside the legacy client folders) and is
// governed by the `target-structure` rules.
const LEGACY_SERVER_CODE = ["lib/db/", "server/"];

const FSD_LAYERS = [
  "app",
  "pages",
  "widgets",
  "features",
  "entities",
  "shared",
];
const FSD_SLICED_LAYERS = new Set(["pages", "widgets", "features", "entities"]);

const CLIENT_CONTRACT_BRIDGE = "client/shared/api/contract";
const SERVER_CONTRACT_ENTRY_PATTERN = /^server\/api\/v\d+\/contract$/;
const CONTRACT_ZONE_PATTERNS = [
  /^server\/api\/(?:.+\/)?contract$/,
  /^server\/api\/v\d+\/_schemas\//,
  /^server\/api\/_kit\/(?:caller-access|common-errors|pagination|open-enum)$/,
];
const CONTRACT_PACKAGES = new Set(["@orpc/contract", "zod"]);
const CORE_PACKAGES = new Set(["zod"]);
const DOMAIN_FORBIDDEN_PACKAGE_PATTERN = /^(?:next|@orpc\/.+)$/;

const SOURCE_EXTENSION_PATTERN = /\.tsx?$/;

export const isTestFile = (path: string): boolean =>
  TEST_FILE_PATTERN.test(path);

const withoutExtension = (path: string): string =>
  path.replace(SOURCE_EXTENSION_PATTERN, "");

const isUnder = (path: string | null, prefix: string): boolean =>
  path !== null && (path === prefix || path.startsWith(prefix));

const isContractZone = (path: string): boolean =>
  CONTRACT_ZONE_PATTERNS.some((pattern) => pattern.test(path));

const libImportsApp: EdgeRule = (module, edge) =>
  isUnder(module.path, "lib/") && isUnder(edge.to, "app/")
    ? { rule: "lib-imports-app", message: "lib/ must not depend on app/" }
    : null;

const clientImportsServerCode: EdgeRule = (module, edge) => {
  const isClientModule =
    module.hasUseClientDirective ||
    LEGACY_CLIENT_DIRS.some((dir) => module.path.startsWith(dir));
  const isServerCode = LEGACY_SERVER_CODE.some((prefix) =>
    isUnder(edge.to, prefix)
  );

  return isClientModule && isServerCode && !edge.isTypeOnly
    ? {
        rule: "client-imports-server-code",
        message:
          "client code may import server code (`server/`, `lib/db/`) only with `import type`",
      }
    : null;
};

const mockSpecifier: EdgeRule = (_module, edge, { canResolve }) => {
  if (!edge.isMock) {
    return null;
  }
  if (edge.isRelative) {
    return {
      rule: "mock-specifier",
      message: `mock "${edge.specifier}" is relative; use an @/ path so it survives a move`,
    };
  }
  return canResolve(edge)
    ? null
    : {
        rule: "mock-specifier",
        message: `mock "${edge.specifier}" resolves to nothing, so it mocks nothing`,
      };
};

const responseValidationPlugin: EdgeRule = (_module, edge) =>
  edge.importedNames.includes("ResponseValidationPlugin")
    ? {
        rule: "response-validation-plugin",
        message:
          "ResponseValidationPlugin makes a client reject fields added by a newer server",
      }
    : null;

const SERVER_CALLER_MODULE = "server/api/_kit/server-caller";
const ROUTE_HANDLER_PATTERN = /^app\/(?:.+\/)?route$/;

/**
 * The in-process caller is read-only and skips the same-origin check, so it
 * belongs in server components. A route handler and a `"use server"` module
 * are entry points a cross-site request can reach.
 */
const serverCallerReadOnly: EdgeRule = (module, edge) => {
  if (withoutExtension(edge.to ?? "") !== SERVER_CALLER_MODULE) {
    return null;
  }
  const isEntryPoint =
    module.hasUseServerDirective ||
    ROUTE_HANDLER_PATTERN.test(withoutExtension(module.path));

  return isEntryPoint
    ? {
        rule: "server-caller-read-only",
        message:
          'route handlers and "use server" modules must not use the in-process caller; it is for server components',
      }
    : null;
};

const targetStructureMessage = (
  from: string,
  edge: ImportEdge
): string | null => {
  const { to, packageName } = edge;

  if (isUnder(from, "client/")) {
    if (isUnder(to, "app/")) {
      return "client/ must not import app/";
    }
    const isContractBridge =
      from === CLIENT_CONTRACT_BRIDGE &&
      to !== null &&
      SERVER_CONTRACT_ENTRY_PATTERN.test(to);
    if (isUnder(to, "server/") && !isContractBridge) {
      return "client/ reaches server/ only through client/shared/api/contract.ts";
    }
  }

  if (isUnder(from, "core/")) {
    if (to !== null && !isUnder(to, "core/")) {
      return "core/ may import only core/";
    }
    if (packageName !== null && !CORE_PACKAGES.has(packageName)) {
      return `core/ may use no package except zod (found ${packageName})`;
    }
  }

  if (!isUnder(from, "server/")) {
    return null;
  }
  if (isUnder(to, "client/") || isUnder(to, "app/")) {
    return "server/ must not import client/ or app/";
  }
  if (isContractZone(from)) {
    const isAllowedFile =
      to === null || isContractZone(to) || isUnder(to, "core/");
    const isAllowedPackage =
      packageName === null || CONTRACT_PACKAGES.has(packageName);
    return isAllowedFile && isAllowedPackage
      ? null
      : "API contract files may import only other contract files, core/, @orpc/contract and zod";
  }
  if (isUnder(from, "server/modules/")) {
    if (isUnder(to, "server/api/")) {
      return "server/modules/ must not import server/api/";
    }
    if (
      packageName !== null &&
      DOMAIN_FORBIDDEN_PACKAGE_PATTERN.test(packageName)
    ) {
      return `server/modules/ must not depend on ${packageName}`;
    }
  }
  return null;
};

const targetStructure: EdgeRule = (module, edge) => {
  const message = targetStructureMessage(withoutExtension(module.path), edge);
  return message ? { rule: "target-structure", message } : null;
};

type FsdPosition = { layerIndex: number; layer: string; slice: string };

const fsdPositionOf = (path: string | null): FsdPosition | null => {
  if (!isUnder(path, "client/") || path === null) {
    return null;
  }
  const [, layer = "", slice = ""] = path.split("/");
  const layerIndex = FSD_LAYERS.indexOf(layer);
  return layerIndex === -1 ? null : { layerIndex, layer, slice };
};

const fsdLayers: EdgeRule = (module, edge) => {
  const source = fsdPositionOf(module.path);
  const target = fsdPositionOf(edge.to);
  if (!(source && target)) {
    return null;
  }

  if (target.layerIndex < source.layerIndex) {
    return {
      rule: "fsd-layers",
      message: `${source.layer} must not import the higher layer ${target.layer}`,
    };
  }
  const isCrossSlice =
    target.layerIndex === source.layerIndex &&
    FSD_SLICED_LAYERS.has(source.layer) &&
    target.slice !== source.slice;

  return isCrossSlice
    ? {
        rule: "fsd-layers",
        message: `slice ${source.layer}/${source.slice} must not import slice ${target.layer}/${target.slice}`,
      }
    : null;
};

/** Rules for production code. Tests may import anything. */
const BOUNDARY_RULES: EdgeRule[] = [
  libImportsApp,
  clientImportsServerCode,
  responseValidationPlugin,
  serverCallerReadOnly,
  targetStructure,
  fsdLayers,
];

/** Rules that apply to every file, tests included. */
const UNIVERSAL_RULES: EdgeRule[] = [mockSpecifier];

/** Every boundary violation in `modules`, in a stable order. */
export const findViolations = (
  modules: SourceModule[],
  context: RuleContext
): Violation[] =>
  modules
    .flatMap((module) => {
      const rules = isTestFile(module.path)
        ? UNIVERSAL_RULES
        : [...BOUNDARY_RULES, ...UNIVERSAL_RULES];

      return module.edges.flatMap((edge) =>
        rules.flatMap((rule): Violation[] => {
          const found = rule(module, edge, context);
          return found
            ? [
                {
                  ...found,
                  from: module.path,
                  to: edge.to ?? edge.packageName ?? edge.specifier,
                },
              ]
            : [];
        })
      );
    })
    .sort((first, second) =>
      `${first.rule} ${first.from} ${first.to}`.localeCompare(
        `${second.rule} ${second.from} ${second.to}`
      )
    );
