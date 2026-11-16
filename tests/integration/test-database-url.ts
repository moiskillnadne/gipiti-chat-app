/**
 * Where the integration tests may run.
 *
 * They truncate tables, so the target is deliberately hard to get wrong: it is
 * named by `TEST_POSTGRES_URL` (never `POSTGRES_URL`), must be on this machine
 * and must be a database whose name ends in `_test`.
 */
import { config as loadDotenv } from "dotenv";

const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
const TEST_DATABASE_NAME_PATTERN = /^[a-z0-9_]+_test$/;
const POSTGRES_PROTOCOLS = new Set(["postgres:", "postgresql:"]);

export const TEST_DATABASE_ENV_VAR = "TEST_POSTGRES_URL";

export class UnsafeTestDatabaseError extends Error {
  constructor(message: string) {
    super(
      `${message} Integration tests truncate tables, so ${TEST_DATABASE_ENV_VAR} must point at a local database whose name ends in "_test", for example postgresql://postgres:postgres@localhost:5432/gipiti_test.`
    );
    this.name = "UnsafeTestDatabaseError";
  }
}

export type TestDatabaseTarget = {
  connectionString: string;
  databaseName: string;
  /** Same server, `postgres` database: used to create the test database. */
  adminConnectionString: string;
};

/**
 * Validate a connection string for the integration tests.
 *
 * @throws UnsafeTestDatabaseError when it is missing, not Postgres, not local,
 * or names a database that does not end in `_test`
 */
export const parseTestDatabaseUrl = (
  connectionString: string | undefined
): TestDatabaseTarget => {
  if (!connectionString) {
    throw new UnsafeTestDatabaseError(`${TEST_DATABASE_ENV_VAR} is not set.`);
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new UnsafeTestDatabaseError(
      `${TEST_DATABASE_ENV_VAR} is not a valid URL.`
    );
  }

  if (!POSTGRES_PROTOCOLS.has(url.protocol)) {
    throw new UnsafeTestDatabaseError(
      `${TEST_DATABASE_ENV_VAR} is not a Postgres URL.`
    );
  }
  if (!LOCAL_HOSTNAMES.has(url.hostname)) {
    throw new UnsafeTestDatabaseError(
      `${TEST_DATABASE_ENV_VAR} points at host "${url.hostname}", which is not this machine.`
    );
  }

  const databaseName = decodeURIComponent(url.pathname.slice(1));
  if (!TEST_DATABASE_NAME_PATTERN.test(databaseName)) {
    throw new UnsafeTestDatabaseError(
      `${TEST_DATABASE_ENV_VAR} names the database "${databaseName}".`
    );
  }

  const adminUrl = new URL(connectionString);
  adminUrl.pathname = "/postgres";

  return {
    connectionString,
    databaseName,
    adminConnectionString: adminUrl.toString(),
  };
};

/**
 * Read `TEST_POSTGRES_URL` from the shell or `.env.local` and validate it.
 * Only that one variable is taken from the file: the rest of `.env.local`
 * (Redis, Resend, gateway keys) must not reach the tests.
 */
export const resolveTestDatabase = (): TestDatabaseTarget => {
  const fileEnv: Record<string, string> = {};
  loadDotenv({ path: ".env.local", processEnv: fileEnv, quiet: true });

  return parseTestDatabaseUrl(
    process.env[TEST_DATABASE_ENV_VAR] ?? fileEnv[TEST_DATABASE_ENV_VAR]
  );
};
