import { randomUUID } from "node:crypto";

import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, describe, expect, it } from "vitest";

import { db } from "@/server/db/connection";
import { prompt, promptFavorite, user } from "@/server/db/schema";
import { addPromptFavorite } from "@/server/modules/prompts/queries/add-prompt-favorite";
import { getActiveFavoritePromptIds } from "@/server/modules/prompts/queries/get-active-favorite-prompt-ids";
import { getFavoritePromptIds } from "@/server/modules/prompts/queries/get-favorite-prompt-ids";
import { isActivePrompt } from "@/server/modules/prompts/queries/is-active-prompt";
import { closeDatabaseConnection } from "@/tests/integration/helpers";

const createdPromptIds: string[] = [];
const createdUserIds: string[] = [];

const seedPrompt = async (isActive: boolean): Promise<string> => {
  const [row] = await db
    .insert(prompt)
    .values({
      key: `it-${randomUUID()}`.slice(0, 64),
      category: "text",
      modelId: "test/model",
      title: "Integration prompt",
      body: "Body",
      tags: [],
      isActive,
    })
    .returning({ id: prompt.id });
  createdPromptIds.push(row.id);

  return row.id;
};

const seedUser = async (): Promise<string> => {
  const [row] = await db
    .insert(user)
    .values({ email: `favorites-${randomUUID()}@example.test` })
    .returning({ id: user.id });
  createdUserIds.push(row.id);

  return row.id;
};

const setActive = async (promptId: string, isActive: boolean) => {
  await db.update(prompt).set({ isActive }).where(eq(prompt.id, promptId));
};

describe("favourite prompts against a real database", () => {
  afterEach(async () => {
    // Favourites go with their prompts or users (cascade); delete both sets.
    if (createdPromptIds.length > 0) {
      await db.delete(prompt).where(inArray(prompt.id, createdPromptIds));
    }
    if (createdUserIds.length > 0) {
      await db.delete(user).where(inArray(user.id, createdUserIds));
    }
    createdPromptIds.length = 0;
    createdUserIds.length = 0;
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  it("lists a favourite of an active prompt", async () => {
    // Arrange
    const userId = await seedUser();
    const promptId = await seedPrompt(true);
    await addPromptFavorite({ userId, promptId });

    // Act
    const ids = await getActiveFavoritePromptIds({ userId });

    // Assert
    expect(ids).toEqual([promptId]);
  });

  it("leaves out a favourite of an inactive prompt, which stays stored", async () => {
    // Arrange
    const userId = await seedUser();
    const promptId = await seedPrompt(false);
    await addPromptFavorite({ userId, promptId });

    // Act
    const activeIds = await getActiveFavoritePromptIds({ userId });
    const storedIds = await getFavoritePromptIds({ userId });

    // Assert
    expect(activeIds).toEqual([]);
    expect(storedIds).toEqual([promptId]);
  });

  it("lists the favourite again once the prompt is activated", async () => {
    // Arrange
    const userId = await seedUser();
    const promptId = await seedPrompt(true);
    await addPromptFavorite({ userId, promptId });
    await setActive(promptId, false);
    const whileOff = await getActiveFavoritePromptIds({ userId });

    // Act
    await setActive(promptId, true);
    const afterOn = await getActiveFavoritePromptIds({ userId });

    // Assert
    expect(whileOff).toEqual([]);
    expect(afterOn).toEqual([promptId]);
  });

  it("does not list the favourites of another user", async () => {
    // Arrange
    const userId = await seedUser();
    const otherUserId = await seedUser();
    const promptId = await seedPrompt(true);
    await addPromptFavorite({ userId: otherUserId, promptId });

    // Act
    const ids = await getActiveFavoritePromptIds({ userId });

    // Assert
    expect(ids).toEqual([]);
  });

  it("tells an active prompt from an inactive one and from an unknown id", async () => {
    // Arrange
    const activeId = await seedPrompt(true);
    const inactiveId = await seedPrompt(false);

    // Act
    const answers = [
      await isActivePrompt({ promptId: activeId }),
      await isActivePrompt({ promptId: inactiveId }),
      await isActivePrompt({ promptId: randomUUID() }),
    ];

    // Assert
    expect(answers).toEqual([true, false, false]);
  });

  it("keeps the stored favourite row when a prompt is switched off", async () => {
    // Arrange
    const userId = await seedUser();
    const promptId = await seedPrompt(true);
    await addPromptFavorite({ userId, promptId });

    // Act
    await setActive(promptId, false);

    // Assert
    const rows = await db
      .select()
      .from(promptFavorite)
      .where(eq(promptFavorite.userId, userId));
    expect(rows).toHaveLength(1);
  });
});
