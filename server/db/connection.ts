/**
 * Database connection singleton.
 * Initializes the PostgreSQL client and Drizzle ORM instance
 * shared across all query modules.
 */
import "server-only";

import type { PgDatabase } from "drizzle-orm/pg-core";
import {
  drizzle,
  type PostgresJsQueryResultHKT,
} from "drizzle-orm/postgres-js";
import postgres from "postgres";

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
export const db = drizzle(client);

/**
 * What a query can run on: the pooled `db` or an open transaction.
 *
 * Code that runs inside a `db.transaction` callback must query through the
 * transaction. A query through `db` there takes a second pool connection while
 * the transaction holds the first; with as many such transactions in flight as
 * the pool has connections, each waits for a connection that is never
 * released (GIPITI-228).
 */
export type DatabaseExecutor = PgDatabase<
  PostgresJsQueryResultHKT,
  Record<string, never>
>;
