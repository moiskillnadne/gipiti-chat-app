/**
 * Runs once before the integration tests: makes sure the test database exists
 * and is migrated to the current schema.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import {
  resolveTestDatabase,
  type TestDatabaseTarget,
} from "./test-database-url";

const MIGRATIONS_FOLDER = "./server/db/migrations";

const ensureDatabaseExists = async ({
  adminConnectionString,
  databaseName,
}: TestDatabaseTarget): Promise<void> => {
  const adminClient = postgres(adminConnectionString, { max: 1 });
  try {
    const existing = await adminClient`
      SELECT 1 FROM pg_database WHERE datname = ${databaseName}
    `;
    if (existing.length === 0) {
      // The name passed `parseTestDatabaseUrl`: lower-case letters, digits and
      // underscores only. `adminClient(name)` quotes it as an identifier.
      await adminClient`CREATE DATABASE ${adminClient(databaseName)}`;
    }
  } finally {
    await adminClient.end();
  }
};

const migrateDatabase = async (connectionString: string): Promise<void> => {
  const migrationClient = postgres(connectionString, {
    max: 1,
    onnotice: () => {
      // The migrator's "already exists, skipping" notices are not useful here.
    },
  });
  try {
    await migrate(drizzle(migrationClient), {
      migrationsFolder: MIGRATIONS_FOLDER,
    });
  } finally {
    await migrationClient.end();
  }
};

export const setup = async (): Promise<void> => {
  const target = resolveTestDatabase();
  await ensureDatabaseExists(target);
  await migrateDatabase(target.connectionString);
};
