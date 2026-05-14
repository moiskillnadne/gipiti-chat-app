import "server-only";

import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

neonConfig.webSocketConstructor = ws;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 5000,
});

export const db = drizzle(pool);
export const dbTx = db;
