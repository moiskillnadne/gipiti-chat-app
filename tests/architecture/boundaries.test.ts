import { existsSync } from "node:fs";
import { builtinModules } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ALLOWED_VIOLATIONS } from "./allowlist";
import {
  type ImportEdge,
  parseSourceModule,
  readSourceModules,
} from "./import-graph";
import { findViolations, type RuleContext, type Violation } from "./rules";

const REPO_ROOT = process.cwd();
const FILE_SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx", ".mjs"];
const BUILTIN_MODULES = new Set(builtinModules);

const canResolve = ({ to, packageName }: ImportEdge): boolean => {
  if (to !== null) {
    return FILE_SUFFIXES.some((suffix) =>
      existsSync(join(REPO_ROOT, `${to}${suffix}`))
    );
  }
  const name = packageName ?? "";
  return (
    name.startsWith("node:") ||
    BUILTIN_MODULES.has(name) ||
    existsSync(join(REPO_ROOT, "node_modules", name))
  );
};

const everythingResolves: RuleContext = { canResolve: () => true };

const keyOf = ({
  rule,
  from,
  to,
}: Pick<Violation, "rule" | "from" | "to">): string =>
  `${rule}: ${from} -> ${to}`;

/** Violations for a set of in-memory files, keyed for easy assertions. */
const violationKeys = (
  files: Record<string, string>,
  context: RuleContext = everythingResolves
): string[] =>
  findViolations(
    Object.entries(files).map(([path, sourceText]) =>
      parseSourceModule(path, sourceText)
    ),
    context
  ).map(keyOf);

describe("import boundaries of this repository", () => {
  const violations = findViolations(readSourceModules(REPO_ROOT), {
    canResolve,
  });
  const allowedKeys = new Set(ALLOWED_VIOLATIONS.map(keyOf));
  const foundKeys = new Set(violations.map(keyOf));

  it("has no boundary violation outside the allowlist", () => {
    // Act
    const unexpected = violations
      .filter((violation) => !allowedKeys.has(keyOf(violation)))
      .map((violation) => `${keyOf(violation)} (${violation.message})`);

    // Assert
    expect(unexpected).toEqual([]);
  });

  it("has no allowlist entry for a violation that no longer exists", () => {
    // Act
    const stale = ALLOWED_VIOLATIONS.filter(
      (allowed) => !foundKeys.has(keyOf(allowed))
    ).map(keyOf);

    // Assert: remove fixed entries from tests/architecture/allowlist.ts.
    expect(stale).toEqual([]);
  });
});

describe("legacy layout rules", () => {
  it("reports lib/ importing app/, even as a type", () => {
    // Act
    const keys = violationKeys({
      "lib/ai/entitlements.ts":
        'import type { ChatActionState } from "@/app/(chat)/actions";',
    });

    // Assert
    expect(keys).toEqual([
      "lib-imports-app: lib/ai/entitlements.ts -> app/(chat)/actions",
    ]);
  });

  it("reports a client component importing database code as a value", () => {
    // Act
    const keys = violationKeys({
      "components/chat.tsx":
        '"use client";\nimport { db } from "@/lib/db/connection";',
      "app/(chat)/page-client.tsx":
        '"use client";\nimport { auth } from "@/server/modules/auth/next-auth";',
    });

    // Assert
    expect(keys).toEqual([
      "client-imports-server-code: app/(chat)/page-client.tsx -> server/modules/auth/next-auth",
      "client-imports-server-code: components/chat.tsx -> lib/db/connection",
    ]);
  });

  it("guards the database layer at its new place under server/ too", () => {
    // Act
    const keys = violationKeys({
      "components/chat.tsx": [
        '"use client";',
        'import { db } from "@/server/db/connection";',
        'import type { Chat } from "@/server/db/schema";',
      ].join("\n"),
    });

    // Assert
    expect(keys).toEqual([
      "client-imports-server-code: components/chat.tsx -> server/db/connection",
    ]);
  });

  it("allows a client component to import database types", () => {
    // Act
    const keys = violationKeys({
      "components/chat.tsx": [
        '"use client";',
        'import type { Chat } from "@/lib/db/schema";',
        'import { type Vote } from "@/lib/db/schema";',
      ].join("\n"),
    });

    // Assert
    expect(keys).toEqual([]);
  });

  it("does not apply the layout rules to test files", () => {
    // Act
    const keys = violationKeys({
      "lib/billing/__tests__/refund.test.ts":
        'import { deleteTrailingMessages } from "@/app/(chat)/actions";',
    });

    // Assert
    expect(keys).toEqual([]);
  });
});

describe("mock specifier rule", () => {
  it("reports a relative mock and a mock that resolves to nothing", () => {
    // Arrange
    const context: RuleContext = {
      canResolve: ({ to }) => to !== "lib/billing/gone",
    };

    // Act
    const keys = violationKeys(
      {
        "lib/billing/__tests__/charge.test.ts": [
          'vi.mock("../fx", () => ({}));',
          'vi.mock("@/lib/billing/gone", () => ({}));',
          'vi.mock("@/lib/billing/balance", () => ({}));',
          'const actual = await vi.importActual("@/lib/billing/gone");',
        ].join("\n"),
      },
      context
    );

    // Assert
    expect(keys).toEqual([
      "mock-specifier: lib/billing/__tests__/charge.test.ts -> lib/billing/fx",
      "mock-specifier: lib/billing/__tests__/charge.test.ts -> lib/billing/gone",
      "mock-specifier: lib/billing/__tests__/charge.test.ts -> lib/billing/gone",
    ]);
  });
});

describe("target structure rules", () => {
  it("lets client/ reach server/ only through the contract bridge", () => {
    // Act
    const keys = violationKeys({
      "client/shared/api/contract.ts":
        'export { contract } from "@/server/api/v1/contract";',
      "client/features/send-message/model.ts":
        'import type { Chat } from "@/server/modules/chat/types";',
      "client/shared/api/client.ts":
        'import { router } from "@/server/api/v1/router";',
      "client/widgets/sidebar/ui.tsx":
        'import { metadata } from "@/app/layout";',
    });

    // Assert
    expect(keys).toEqual([
      "target-structure: client/features/send-message/model.ts -> server/modules/chat/types",
      "target-structure: client/shared/api/client.ts -> server/api/v1/router",
      "target-structure: client/widgets/sidebar/ui.tsx -> app/layout",
    ]);
  });

  it("keeps server/ away from client/ and app/, and the domain away from transport", () => {
    // Act
    const keys = violationKeys({
      "server/modules/billing/charge.ts": [
        'import { os } from "@orpc/server";',
        'import { after } from "next/server";',
        'import { router } from "@/server/api/v1/router";',
        'import { db } from "@/server/db/connection";',
        'import { z } from "zod";',
      ].join("\n"),
      "server/http/guard.ts": 'import { Button } from "@/client/shared/ui";',
    });

    // Assert
    expect(keys).toEqual([
      "target-structure: server/http/guard.ts -> client/shared/ui",
      "target-structure: server/modules/billing/charge.ts -> @orpc/server",
      "target-structure: server/modules/billing/charge.ts -> next",
      "target-structure: server/modules/billing/charge.ts -> server/api/v1/router",
    ]);
  });

  it("limits what API contract files and core/ may import", () => {
    // Act
    const keys = violationKeys({
      "server/api/v1/chats/contract.ts": [
        'import { oc } from "@orpc/contract";',
        'import { z } from "zod/v4";',
        'import { chatSchema } from "@/server/api/v1/_schemas/chat";',
        'import { pagination } from "@/server/api/_kit/pagination";',
        'import { money } from "@/core/money";',
        'import { db } from "@/server/db/connection";',
        'import { os } from "@orpc/server";',
      ].join("\n"),
      "core/money.ts": [
        'import { z } from "zod";',
        'import { clsx } from "clsx";',
        'import { fx } from "@/server/modules/billing/fx";',
        'import { round } from "./round";',
      ].join("\n"),
    });

    // Assert
    expect(keys).toEqual([
      "target-structure: core/money.ts -> clsx",
      "target-structure: core/money.ts -> server/modules/billing/fx",
      "target-structure: server/api/v1/chats/contract.ts -> @orpc/server",
      "target-structure: server/api/v1/chats/contract.ts -> server/db/connection",
    ]);
  });

  it("enforces the FSD layer order and slice isolation inside client/", () => {
    // Act
    const keys = violationKeys({
      "client/entities/chat/model.ts": [
        'import { useSend } from "@/client/features/send-message";',
        'import { Button } from "@/client/shared/ui/button";',
        'import { userName } from "@/client/entities/user";',
        'import { title } from "./lib/title";',
      ].join("\n"),
      "client/shared/ui/button.tsx":
        'import { cn } from "@/client/shared/lib/cn";',
      "client/widgets/sidebar/ui.tsx":
        'import { ChatRow } from "@/client/entities/chat";',
    });

    // Assert
    expect(keys).toEqual([
      "fsd-layers: client/entities/chat/model.ts -> client/entities/user",
      "fsd-layers: client/entities/chat/model.ts -> client/features/send-message",
    ]);
  });

  it("keeps the in-process caller out of route handlers and use-server modules", () => {
    // Act
    const keys = violationKeys({
      "app/api/thing/route.ts":
        'import { createServerCaller } from "@/server/api/_kit/server-caller";',
      "app/(chat)/actions.ts": [
        '"use server";',
        'import { createServerCaller } from "@/server/api/_kit/server-caller";',
      ].join("\n"),
      "app/(chat)/projects/page.tsx":
        'import { createServerCaller } from "@/server/api/_kit/server-caller";',
      "server/api/_kit/__tests__/server-caller.test.ts":
        'import { createServerCaller } from "@/server/api/_kit/server-caller";',
    });

    // Assert
    expect(keys).toEqual([
      "server-caller-read-only: app/(chat)/actions.ts -> server/api/_kit/server-caller",
      "server-caller-read-only: app/api/thing/route.ts -> server/api/_kit/server-caller",
    ]);
  });

  it("reports ResponseValidationPlugin wherever it is imported", () => {
    // Act
    const keys = violationKeys({
      "client/shared/api/client.ts":
        'import { ResponseValidationPlugin } from "@orpc/contract/plugins";',
    });

    // Assert
    expect(keys).toEqual([
      "response-validation-plugin: client/shared/api/client.ts -> @orpc/contract",
    ]);
  });
});
