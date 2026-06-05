import { eq, inArray } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { prompt } from "@/lib/db/schema";
import type { PromptSeed } from "./prompt-seed";

/** Current catalog state, as read from the `Prompt` table. */
export type ExistingPrompt = {
  key: string;
  category: string;
  modelId: string;
  title: string;
  body: string;
  tags: string[];
  sortOrder: number;
  isActive: boolean;
};

/**
 * The reconciliation plan derived from the sheet (desired) vs the DB (current).
 * `toDeactivate` and `toPrune` cover the same missing keys; which one is applied
 * depends on the `prune` option.
 */
export type SyncPlan = {
  toInsert: PromptSeed[];
  toUpdate: PromptSeed[];
  toDeactivate: string[];
  toPrune: string[];
  unchanged: number;
};

export type ApplyOptions = { prune: boolean };

type PromptSyncDatabase = PostgresJsDatabase<Record<string, never>>;

function hasChanges(current: ExistingPrompt, seed: PromptSeed): boolean {
  return (
    current.category !== seed.category ||
    current.modelId !== seed.modelId ||
    current.title !== seed.title ||
    current.body !== seed.body ||
    current.sortOrder !== seed.sortOrder ||
    current.isActive !== seed.isActive ||
    JSON.stringify(current.tags) !== JSON.stringify(seed.tags)
  );
}

/**
 * Diffs the desired seeds against the existing catalog, reconciling by `key`.
 * Keys present in the DB but absent from the sheet are slated for deactivation
 * (default) or pruning (hard delete). Pure — no DB access.
 */
export function buildSyncPlan(
  seeds: PromptSeed[],
  existing: ExistingPrompt[]
): SyncPlan {
  const existingByKey = new Map(existing.map((row) => [row.key, row]));
  const sheetKeys = new Set(seeds.map((seed) => seed.key));

  const toInsert: PromptSeed[] = [];
  const toUpdate: PromptSeed[] = [];
  let unchanged = 0;

  for (const seed of seeds) {
    const current = existingByKey.get(seed.key);
    if (!current) {
      toInsert.push(seed);
    } else if (hasChanges(current, seed)) {
      toUpdate.push(seed);
    } else {
      unchanged += 1;
    }
  }

  const missing = existing.filter((row) => !sheetKeys.has(row.key));
  const toDeactivate = missing
    .filter((row) => row.isActive)
    .map((row) => row.key);
  const toPrune = missing.map((row) => row.key);

  return { toInsert, toUpdate, toDeactivate, toPrune, unchanged };
}

function toInsertValues(seed: PromptSeed): typeof prompt.$inferInsert {
  return {
    key: seed.key,
    category: seed.category,
    modelId: seed.modelId,
    title: seed.title,
    body: seed.body,
    tags: seed.tags,
    sortOrder: seed.sortOrder,
    isActive: seed.isActive,
  };
}

/**
 * Applies a sync plan inside a single transaction: insert new prompts, update
 * changed ones, then either deactivate (default) or hard-delete the prompts
 * that vanished from the sheet. Hard delete cascades to `PromptFavorite`.
 */
export async function applySyncPlan(
  db: PromptSyncDatabase,
  plan: SyncPlan,
  options: ApplyOptions
): Promise<void> {
  await db.transaction(async (tx) => {
    if (plan.toInsert.length > 0) {
      await tx.insert(prompt).values(plan.toInsert.map(toInsertValues));
    }

    for (const seed of plan.toUpdate) {
      await tx
        .update(prompt)
        .set({
          category: seed.category,
          modelId: seed.modelId,
          title: seed.title,
          body: seed.body,
          tags: seed.tags,
          sortOrder: seed.sortOrder,
          isActive: seed.isActive,
          updatedAt: new Date(),
        })
        .where(eq(prompt.key, seed.key));
    }

    if (options.prune) {
      if (plan.toPrune.length > 0) {
        await tx.delete(prompt).where(inArray(prompt.key, plan.toPrune));
      }
    } else if (plan.toDeactivate.length > 0) {
      await tx
        .update(prompt)
        .set({ isActive: false, updatedAt: new Date() })
        .where(inArray(prompt.key, plan.toDeactivate));
    }
  });
}
