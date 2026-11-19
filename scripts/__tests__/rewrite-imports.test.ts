import { describe, expect, it } from "vitest";

import { rewriteSpecifiers } from "@/scripts/lib/rewrite-imports";

const MOVES = new Map([
  ["lib/db/connection.ts", "server/db/connection.ts"],
  ["lib/db/schema.ts", "server/db/schema.ts"],
  ["lib/db/utils.ts", "server/db/utils.ts"],
  ["lib/redis.ts", "server/integrations/redis/client.ts"],
  ["lib/widgets/index.ts", "server/widgets/index.ts"],
  ["messages/ru.json", "core/i18n/messages/ru.json"],
]);

/** Rewrite a file that did not move itself. */
const rewriteIn = (path: string, sourceText: string) =>
  rewriteSpecifiers({ oldPath: path, newPath: path, sourceText, moves: MOVES });

describe("rewriteSpecifiers in a file that stays", () => {
  it("points an alias import at the new place", () => {
    // Act
    const result = rewriteIn(
      "app/api/x/route.ts",
      'import { db } from "@/lib/db/connection";\n'
    );

    // Assert
    expect(result.sourceText).toBe(
      'import { db } from "@/server/db/connection";\n'
    );
    expect(result.changes).toEqual([
      {
        line: 1,
        before: "@/lib/db/connection",
        after: "@/server/db/connection",
      },
    ]);
  });

  it("turns a relative import of a moved file into an alias import", () => {
    // Act
    const result = rewriteIn(
      "lib/types.ts",
      'import type { User } from "./db/schema";\n'
    );

    // Assert
    expect(result.sourceText).toBe(
      'import type { User } from "@/server/db/schema";\n'
    );
  });

  it("rewrites a file that is renamed as it moves", () => {
    // Act
    const result = rewriteIn(
      "lib/rate-limit.ts",
      'import { getUpstashClient } from "@/lib/redis";\n'
    );

    // Assert
    expect(result.sourceText).toBe(
      'import { getUpstashClient } from "@/server/integrations/redis/client";\n'
    );
  });

  it.each([
    ["an export", 'export { db } from "@/lib/db/connection";'],
    ["a dynamic import", 'const m = await import("@/lib/db/connection");'],
    ["an import type", 'type M = typeof import("@/lib/db/connection");'],
    ["vi.mock", 'vi.mock("@/lib/db/connection", () => ({ db: {} }));'],
    ["vi.doMock", 'vi.doMock("@/lib/db/connection");'],
    [
      "vi.importActual",
      'const actual = await vi.importActual("@/lib/db/connection");',
    ],
  ])("rewrites %s", (_case, line) => {
    // Act
    const result = rewriteIn("lib/billing/__tests__/x.test.ts", `${line}\n`);

    // Assert
    expect(result.sourceText).toBe(
      `${line.replace("@/lib/db/connection", "@/server/db/connection")}\n`
    );
    expect(result.changes).toHaveLength(1);
  });

  it("keeps the quote character and everything around the specifier", () => {
    // Arrange
    const sourceText =
      "// uses '@/lib/db/connection'\nimport { db } from '@/lib/db/connection'; // db\n";

    // Act
    const result = rewriteIn("scripts/x.ts", sourceText);

    // Assert
    expect(result.sourceText).toBe(
      "// uses '@/lib/db/connection'\nimport { db } from '@/server/db/connection'; // db\n"
    );
  });

  it("keeps a written file extension", () => {
    // Act
    const result = rewriteIn(
      "lib/i18n/dictionary.ts",
      'import ru from "../../messages/ru.json";\nimport { db } from "@/lib/db/connection.ts";\n'
    );

    // Assert
    expect(result.sourceText).toBe(
      'import ru from "@/core/i18n/messages/ru.json";\nimport { db } from "@/server/db/connection.ts";\n'
    );
  });

  it("follows a folder import to a moved index file", () => {
    // Act
    const result = rewriteIn(
      "app/page.tsx",
      'import { Widget } from "@/lib/widgets";\n'
    );

    // Assert
    expect(result.sourceText).toBe(
      'import { Widget } from "@/server/widgets";\n'
    );
  });

  it("rewrites every specifier of a file in one pass", () => {
    // Arrange
    const sourceText = [
      'import { db } from "@/lib/db/connection";',
      'import { user } from "@/lib/db/schema";',
      'vi.mock("@/lib/db/utils", () => ({}));',
      "",
    ].join("\n");

    // Act
    const result = rewriteIn("lib/x/__tests__/y.test.ts", sourceText);

    // Assert
    expect(result.changes.map((change) => change.line)).toEqual([1, 2, 3]);
    expect(result.sourceText).toBe(
      [
        'import { db } from "@/server/db/connection";',
        'import { user } from "@/server/db/schema";',
        'vi.mock("@/server/db/utils", () => ({}));',
        "",
      ].join("\n")
    );
  });

  it.each([
    ["a package", 'import { z } from "zod";'],
    ["a scoped package", 'import { oc } from "@orpc/contract";'],
    [
      "an alias import of a file that stays",
      'import { cn } from "@/lib/utils";',
    ],
    ["a relative import of a file that stays", 'import { a } from "./a";'],
    ["a string that is not a specifier", 'const path = "@/lib/db/connection";'],
    [
      "a call that is not a module call",
      'log("@/lib/db/connection"); other.mock("@/lib/db/connection");',
    ],
    [
      "a module that only shares a prefix with a moved one",
      'import { x } from "@/lib/db/connection-pool";',
    ],
  ])("leaves %s alone", (_case, line) => {
    // Act
    const result = rewriteIn("lib/billing/balance.ts", `${line}\n`);

    // Assert
    expect(result.sourceText).toBe(`${line}\n`);
    expect(result.changes).toEqual([]);
  });
});

describe("rewriteSpecifiers in a file that moves", () => {
  const rewriteMoved = (sourceText: string) =>
    rewriteSpecifiers({
      oldPath: "lib/db/connection.ts",
      newPath: "server/db/connection.ts",
      sourceText,
      moves: MOVES,
    });

  it("keeps a relative import of a file that moved along with it", () => {
    // Arrange
    const sourceText = 'import { user } from "./schema";\n';

    // Act
    const result = rewriteMoved(sourceText);

    // Assert
    expect(result.sourceText).toBe(sourceText);
    expect(result.changes).toEqual([]);
  });

  it("turns a relative import of a file left behind into an alias import", () => {
    // Act
    const result = rewriteMoved(
      'import { ChatSDKError } from "../errors";\nimport type { Q } from "../quiz/types";\n'
    );

    // Assert: resolved against the old place, `lib/db/`.
    expect(result.sourceText).toBe(
      'import { ChatSDKError } from "@/lib/errors";\nimport type { Q } from "@/lib/quiz/types";\n'
    );
  });

  it("turns a relative import into an alias import when the two files part ways", () => {
    // Act
    const result = rewriteSpecifiers({
      oldPath: "lib/redis.ts",
      newPath: "server/integrations/redis/client.ts",
      sourceText: 'import { db } from "./db/connection";\n',
      moves: MOVES,
    });

    // Assert
    expect(result.sourceText).toBe(
      'import { db } from "@/server/db/connection";\n'
    );
  });

  it("leaves alias imports of files that stay alone", () => {
    // Arrange
    const sourceText = 'import { cn } from "@/lib/utils";\n';

    // Act
    const result = rewriteMoved(sourceText);

    // Assert
    expect(result.sourceText).toBe(sourceText);
  });
});
