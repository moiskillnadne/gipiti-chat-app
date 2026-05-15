/**
 * Database connection singleton.
 * Initializes the PostgreSQL client and Drizzle ORM instance
 * shared across all query modules.
 */
import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
export const db = drizzle(client);
