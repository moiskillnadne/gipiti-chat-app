import { describe, expect, it } from "vitest";

import {
  parseTestDatabaseUrl,
  UnsafeTestDatabaseError,
} from "../test-database-url";

describe("parseTestDatabaseUrl", () => {
  it("accepts a local database whose name ends in _test", () => {
    // Act
    const target = parseTestDatabaseUrl(
      "postgresql://postgres:secret@localhost:5432/gipiti_test"
    );

    // Assert
    expect(target).toEqual({
      connectionString:
        "postgresql://postgres:secret@localhost:5432/gipiti_test",
      databaseName: "gipiti_test",
      adminConnectionString:
        "postgresql://postgres:secret@localhost:5432/postgres",
    });
  });

  it("accepts 127.0.0.1 and keeps query parameters for the admin connection", () => {
    // Act
    const target = parseTestDatabaseUrl(
      "postgres://postgres:secret@127.0.0.1:5433/ci_test?sslmode=disable"
    );

    // Assert
    expect(target.databaseName).toBe("ci_test");
    expect(target.adminConnectionString).toBe(
      "postgres://postgres:secret@127.0.0.1:5433/postgres?sslmode=disable"
    );
  });

  it.each([
    ["a missing value", undefined],
    ["an empty value", ""],
    ["a value that is not a URL", "gipiti_test"],
    ["a non-Postgres URL", "https://localhost/gipiti_test"],
    [
      "a remote host",
      "postgresql://user:secret@ep-example.eu-central-1.aws.neon.tech/gipiti_test",
    ],
    [
      "the local development database",
      "postgresql://postgres:secret@localhost:5432/gipiti",
    ],
    [
      "a name that only contains _test",
      "postgresql://postgres:secret@localhost:5432/gipiti_test_backup",
    ],
    ["a missing database name", "postgresql://postgres:secret@localhost:5432"],
    [
      "a name with characters that need quoting",
      'postgresql://postgres:secret@localhost:5432/a";drop_test',
    ],
  ])("rejects %s", (_scenario, connectionString) => {
    // Act & Assert
    expect(() => parseTestDatabaseUrl(connectionString)).toThrow(
      UnsafeTestDatabaseError
    );
  });
});
