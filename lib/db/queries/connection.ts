/**
 * Database connection singleton.
 *
 * Uses Neon's WebSocket-based serverless driver with a short-idle Pool so that
 * Neon can autosuspend (scale to zero) when the app is idle. The Pool closes
 * connections `idleTimeoutMillis` after the last query, so a long-running Node
 * process (VPS / `next start`) no longer holds a persistent TCP pool that
 * would block autosuspend.
 *
 * `dbTx` is exported as an alias of `db` — transactions work natively on the
 * same client, but call sites can opt-in to the `dbTx` name to signal intent.
 */
import "server-only";

import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

// biome-ignore lint: Forbidden non-null assertion.
const connectionString = process.env.POSTGRES_URL!;

const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 5000,
});

export const db = drizzle(pool);
export const dbTx = db;
