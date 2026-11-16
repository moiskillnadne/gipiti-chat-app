import { describe, expect, it } from "vitest";

import {
  type FileVersions,
  findDiffViolations,
  isSpecifierOnlyChange,
  parseNameStatus,
} from "../lib/characterization-diff";

const TEST_PATH = "tests/characterization/chat-post.test.ts";

const BASE_TEST = `
import { expect, it, vi } from "vitest";
import { chatPost } from "./targets/chat-post";

vi.mock("@/lib/rate-limit", () => ({ checkChatRateLimit: vi.fn() }));

it("rejects a request without a session", async () => {
  const response = await chatPost(new Request("http://localhost/api/chat"));
  expect(response.status).toBe(401);
});
`;

const failOnRead = (): FileVersions => {
  throw new Error("file content should not be read for this change");
};

describe("isSpecifierOnlyChange", () => {
  it("accepts a change of import and vi.mock specifiers", () => {
    // Arrange
    const after = BASE_TEST.replace(
      '"@/lib/rate-limit"',
      '"@/server/http/rate-limit"'
    ).replace('"./targets/chat-post"', '"./targets/chat-turn"');

    // Act
    const isAllowed = isSpecifierOnlyChange({ before: BASE_TEST, after });

    // Assert
    expect(isAllowed).toBe(true);
  });

  it("accepts an import the formatter re-wrapped after its path grew", () => {
    // Arrange
    const before = 'import { alpha, beta } from "@/lib/a";\nalpha(beta);\n';
    const after = [
      "import {",
      "  alpha,",
      "  beta,",
      '} from "@/server/modules/some/much/longer/path/to/the/module/a";',
      "alpha(beta);",
      "",
    ].join("\n");

    // Act
    const isAllowed = isSpecifierOnlyChange({ before, after });

    // Assert
    expect(isAllowed).toBe(true);
  });

  it("accepts a vi.mock call wrapped onto several lines", () => {
    // Arrange
    const before = 'vi.mock("@/lib/a", () => ({ run: vi.fn() }));\n';
    const after = [
      "vi.mock(",
      '  "@/server/modules/some/much/longer/path/to/the/module/a",',
      "  () => ({ run: vi.fn() }),",
      ");",
      "",
    ].join("\n");

    // Act
    const isAllowed = isSpecifierOnlyChange({ before, after });

    // Assert
    expect(isAllowed).toBe(true);
  });

  it("accepts changed specifiers in dynamic imports, importActual and import types", () => {
    // Arrange
    const before = [
      'const actual = await vi.importActual<typeof import("@/lib/a")>("@/lib/a");',
      'const loaded = await import("@/lib/b");',
      "",
    ].join("\n");
    const after = before
      .replaceAll('"@/lib/a"', '"@/server/a"')
      .replace('"@/lib/b"', '"@/server/b"');

    // Act
    const isAllowed = isSpecifierOnlyChange({ before, after });

    // Assert
    expect(isAllowed).toBe(true);
  });

  it("rejects a changed expectation", () => {
    // Arrange
    const after = BASE_TEST.replace("toBe(401)", "toBe(403)");

    // Act
    const isAllowed = isSpecifierOnlyChange({ before: BASE_TEST, after });

    // Assert
    expect(isAllowed).toBe(false);
  });

  it("rejects a string that changed outside a module specifier", () => {
    // Arrange
    const after = BASE_TEST.replace(
      '"http://localhost/api/chat"',
      '"http://localhost/api/v1/chat"'
    );

    // Act
    const isAllowed = isSpecifierOnlyChange({ before: BASE_TEST, after });

    // Assert
    expect(isAllowed).toBe(false);
  });

  it("rejects a removed test and a changed imported name", () => {
    // Arrange
    const withoutTest = BASE_TEST.slice(0, BASE_TEST.indexOf("it("));
    const renamedImport = BASE_TEST.replaceAll("chatPost", "chatTurnPost");

    // Act & Assert
    expect(
      isSpecifierOnlyChange({ before: BASE_TEST, after: withoutTest })
    ).toBe(false);
    expect(
      isSpecifierOnlyChange({ before: BASE_TEST, after: renamedImport })
    ).toBe(false);
  });

  it("ignores comments and whitespace", () => {
    // Arrange
    const after = `// moved in phase 3\n${BASE_TEST.replace("\nit(", "\n\n\nit(")}`;

    // Act
    const isAllowed = isSpecifierOnlyChange({ before: BASE_TEST, after });

    // Assert
    expect(isAllowed).toBe(true);
  });
});

describe("parseNameStatus", () => {
  it("maps git status letters and splits a rename into removal and addition", () => {
    // Arrange
    const output = [
      "A\ttests/characterization/new.test.ts",
      `M\t${TEST_PATH}`,
      "D\ttests/characterization/gone.test.ts",
      "R087\ttests/characterization/old.test.ts\ttests/characterization/moved.test.ts",
      "",
    ].join("\n");

    // Act
    const changes = parseNameStatus(output);

    // Assert
    expect(changes).toEqual([
      { status: "added", path: "tests/characterization/new.test.ts" },
      { status: "modified", path: TEST_PATH },
      { status: "deleted", path: "tests/characterization/gone.test.ts" },
      { status: "renamed", path: "tests/characterization/old.test.ts" },
      { status: "added", path: "tests/characterization/moved.test.ts" },
    ]);
  });

  it("treats an unknown status as a modification so it is still compared", () => {
    // Act
    const changes = parseNameStatus(`T\t${TEST_PATH}\n`);

    // Assert
    expect(changes).toEqual([{ status: "modified", path: TEST_PATH }]);
  });
});

describe("findDiffViolations", () => {
  it("allows new files without reading them", () => {
    // Act
    const violations = findDiffViolations(
      [{ status: "added", path: TEST_PATH }],
      failOnRead
    );

    // Assert
    expect(violations).toEqual([]);
  });

  it("allows any change under targets/", () => {
    // Arrange
    const changes = [
      {
        status: "modified" as const,
        path: "tests/characterization/targets/chat-post.ts",
      },
      {
        status: "deleted" as const,
        path: "tests/characterization/targets/old.ts",
      },
    ];

    // Act
    const violations = findDiffViolations(changes, failOnRead);

    // Assert
    expect(violations).toEqual([]);
  });

  it("reports deleted and renamed tests", () => {
    // Arrange
    const changes = [
      { status: "deleted" as const, path: TEST_PATH },
      {
        status: "renamed" as const,
        path: "tests/characterization/auth-actions.test.ts",
      },
    ];

    // Act
    const violations = findDiffViolations(changes, failOnRead);

    // Assert
    expect(violations).toEqual([
      { path: TEST_PATH, reason: "the file was deleted" },
      {
        path: "tests/characterization/auth-actions.test.ts",
        reason: "the file was renamed",
      },
    ]);
  });

  it("reports a modified test whose assertions changed and passes a specifier-only edit", () => {
    // Arrange
    const versionsByPath: Record<string, FileVersions> = {
      [TEST_PATH]: {
        before: BASE_TEST,
        after: BASE_TEST.replace("toBe(401)", "toBe(200)"),
      },
      "tests/characterization/moved-only.test.ts": {
        before: BASE_TEST,
        after: BASE_TEST.replace('"@/lib/rate-limit"', '"@/server/rate-limit"'),
      },
    };
    const changes = Object.keys(versionsByPath).map((path) => ({
      status: "modified" as const,
      path,
    }));

    // Act
    const violations = findDiffViolations(
      changes,
      (path) => versionsByPath[path]
    );

    // Assert
    expect(violations).toEqual([
      {
        path: TEST_PATH,
        reason: "something other than a module specifier changed",
      },
    ]);
  });

  it("ignores files outside tests/characterization/", () => {
    // Act
    const violations = findDiffViolations(
      [{ status: "deleted", path: "lib/billing/__tests__/refund.test.ts" }],
      failOnRead
    );

    // Assert
    expect(violations).toEqual([]);
  });
});
