import { describe, expect, it } from "vitest";

import {
  findViolatedRule,
  toProjectRelativePath,
} from "../protected-paths.mjs";

const PROJECT_DIRECTORY = "/repo";

const isBlocked = (relativePath: string, isExistingFile = true): boolean =>
  findViolatedRule({ relativePath, isExistingFile }) !== null;

describe("toProjectRelativePath", () => {
  it("relativizes absolute paths inside the project", () => {
    expect(
      toProjectRelativePath("/repo/lib/db/schema.ts", PROJECT_DIRECTORY)
    ).toBe("lib/db/schema.ts");
  });

  it("resolves relative paths against the project directory", () => {
    expect(toProjectRelativePath("./.env.local", PROJECT_DIRECTORY)).toBe(
      ".env.local"
    );
  });

  it("keeps the leading ../ for paths outside the project", () => {
    expect(toProjectRelativePath("/home/me/.env", PROJECT_DIRECTORY)).toBe(
      "../home/me/.env"
    );
  });
});

describe("findViolatedRule — env files", () => {
  it.each([
    ".env",
    ".env.local",
    ".env.production",
    "apps/web/.env.development.local",
  ])("blocks %s", (relativePath) => {
    expect(isBlocked(relativePath)).toBe(true);
  });

  it("blocks creating a new env file too", () => {
    expect(isBlocked(".env.local", false)).toBe(true);
  });

  it.each([".env.example", "lib/env.ts", "docs/.environment.md"])(
    "allows %s",
    (relativePath) => {
      expect(isBlocked(relativePath)).toBe(false);
    }
  );
});

describe("findViolatedRule — keys and certificates", () => {
  it.each(["certs/server.pem", "id_rsa.key", "signing.p12"])(
    "blocks %s",
    (relativePath) => {
      expect(isBlocked(relativePath)).toBe(true);
    }
  );

  it("allows a file that only mentions a key extension mid-name", () => {
    expect(isBlocked("lib/keyboard.pem.ts")).toBe(false);
  });
});

describe("findViolatedRule — migrations", () => {
  it("blocks editing an existing migration", () => {
    expect(isBlocked("lib/db/migrations/0043_unique_user_email.sql")).toBe(
      true
    );
  });

  it("blocks editing an existing snapshot", () => {
    expect(isBlocked("lib/db/migrations/meta/0043_snapshot.json")).toBe(true);
  });

  it("allows writing a new migration", () => {
    expect(isBlocked("lib/db/migrations/0044_new_table.sql", false)).toBe(
      false
    );
  });

  it("allows updating the migration journal", () => {
    expect(isBlocked("lib/db/migrations/meta/_journal.json")).toBe(false);
  });

  it("leaves migrations-like folders elsewhere alone", () => {
    expect(isBlocked("docs/migrations/notes.md")).toBe(false);
  });
});
