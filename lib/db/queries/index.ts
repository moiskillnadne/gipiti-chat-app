/**
 * Barrel re-export for all database query modules.
 * Consumers import from "@/lib/db/queries" — this file ensures
 * zero breaking changes after the split from the monolithic queries.ts.
 */

// biome-ignore-all lint/performance/noBarrelFile: intentional barrel for backwards-compatible re-exports
export { db } from "./connection";
