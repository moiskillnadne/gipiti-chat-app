import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { getSpendHistory } from "@/server/modules/billing/get-spend-history";
import {
  getChatSpendHistory,
  getRecentSpendMinor,
} from "@/server/modules/billing/spend";
import { seedChat } from "@/server/modules/chat/__integration__/seed-chat-data";
import {
  closeDatabaseConnection,
  resetMoneyTables,
  seedCurrency,
  seedUserWithBalance,
} from "@/tests/integration/helpers";
import { seedTransaction, seedUserInCurrency } from "./seed-billing-data";

const hoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * 3_600_000)
    .toISOString()
    .replace("T", " ")
    .replace("Z", "");

describe("the spend history against a real database", () => {
  beforeEach(async () => {
    await resetMoneyTables();
    await seedCurrency();
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  it("equals getChatSpendHistory and getRecentSpendMinor for the same data", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    const tripChatId = await seedChat({
      userId,
      createdAt: "2026-01-01 09:00:00",
      title: "Trip plan",
    });
    const logoChatId = await seedChat({
      userId,
      createdAt: "2026-01-01 09:00:00",
      title: "Logo",
    });
    await seedTransaction({
      userId,
      chatId: tripChatId,
      createdAt: hoursAgo(30),
      modelId: "tavily-search",
      amount: -300,
    });
    await seedTransaction({
      userId,
      chatId: tripChatId,
      createdAt: hoursAgo(29),
      modelId: "openai/gpt-5",
      amount: -1200,
    });
    await seedTransaction({
      userId,
      chatId: logoChatId,
      createdAt: hoursAgo(2),
      description: "Image generation",
      amount: -4000,
    });
    await seedTransaction({
      userId,
      createdAt: hoursAgo(1),
      type: "topup_purchase",
      pool: "topup",
      amount: 50_000,
    });
    await seedTransaction({
      userId,
      chatId: logoChatId,
      createdAt: hoursAgo(24 * 10),
      amount: -700,
    });

    // Act
    const history = await getSpendHistory({ userId, limit: 6 });

    // Assert
    expect(history.chats).toEqual(await getChatSpendHistory(userId, 6));
    expect(history.recentSpendMinor).toBe(await getRecentSpendMinor(userId, 7));
    expect(history.recentSpendMinor).toBe(5500);
    expect(history.chats.map((row) => row.title)).toEqual([
      "Logo",
      "Trip plan",
    ]);
    expect(history.currencyCode).toBe("RUB");
  });

  it("keeps the limit and answers zeros for a user who spent nothing", async () => {
    // Arrange
    const userId = await seedUserWithBalance();
    for (const title of ["A", "B", "C"]) {
      const chatId = await seedChat({
        userId,
        createdAt: "2026-01-01 09:00:00",
        title,
      });
      await seedTransaction({ userId, chatId, createdAt: hoursAgo(5) });
    }
    const idleUserId = await seedUserWithBalance();

    // Act
    const limited = await getSpendHistory({ userId, limit: 2 });
    const idle = await getSpendHistory({ userId: idleUserId, limit: 6 });

    // Assert
    expect(limited.chats).toHaveLength(2);
    expect(idle).toEqual({
      currencyCode: "RUB",
      chats: [],
      recentSpendMinor: 0,
    });
  });

  it("labels the amounts with the balance currency", async () => {
    // Arrange
    await seedCurrency("USD");
    const userId = await seedUserInCurrency({ currencyCode: "USD" });

    // Act
    const history = await getSpendHistory({ userId, limit: 6 });

    // Assert
    expect(history.currencyCode).toBe("USD");
  });
});
