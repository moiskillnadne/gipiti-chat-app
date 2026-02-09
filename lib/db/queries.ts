import "server-only";

import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  inArray,
  lt,
  lte,
  type SQL,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { ArtifactKind } from "@/components/artifact";
import { ChatSDKError } from "../errors";
import { calculatePeriodEnd } from "../subscription/billing-periods";
import type { AppUsage } from "../usage";
import {
  type Chat,
  cancellationFeedback,
  chat,
  type DBMessage,
  document,
  imageGenerationUsageLog,
  message,
  type Project,
  project,
  type SubscriptionPlan,
  type Suggestion,
  searchUsageLog,
  stream,
  subscriptionPlan,
  suggestion,
  type TextStyle,
  textStyle,
  type User,
  type UserSubscription,
  user,
  userSubscription,
  vote,
} from "./schema";
import { generateHashedPassword } from "./utils";

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

// biome-ignore lint: Forbidden non-null assertion.
const client = postgres(process.env.POSTGRES_URL!);
export const db = drizzle(client);

export async function createUser(
  email: string,
  password: string,
  // Temporarily default to Russian - was "en"
  preferredLanguage = "ru"
) {
  const hashedPassword = generateHashedPassword(password);

  try {
    const [newUser] = await db
      .insert(user)
      .values({
        email,
        password: hashedPassword,
        preferredLanguage,
        currentPlan: null, // No default plan - users must subscribe to get access
      })
      .returning();
    return newUser;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create user");
  }
}

export async function setPasswordResetToken({
  userId,
  hashedToken,
  expiresAt,
}: {
  userId: string;
  hashedToken: string;
  expiresAt: Date;
}) {
  try {
    return await db
      .update(user)
      .set({
        resetPasswordToken: hashedToken,
        resetPasswordTokenExpiry: expiresAt,
      })
      .where(eq(user.id, userId))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to set password reset token"
    );
  }
}

export async function getUserByResetToken({
  hashedToken,
}: {
  hashedToken: string;
}): Promise<User | null> {
  try {
    const [foundUser] = await db
      .select()
      .from(user)
      .where(
        and(
          eq(user.resetPasswordToken, hashedToken),
          gt(user.resetPasswordTokenExpiry, new Date())
        )
      );

    return foundUser || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by reset token"
    );
  }
}

export async function clearPasswordResetToken({ userId }: { userId: string }) {
  try {
    return await db
      .update(user)
      .set({
        resetPasswordToken: null,
        resetPasswordTokenExpiry: null,
      })
      .where(eq(user.id, userId));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to clear password reset token"
    );
  }
}

export async function updateUserPassword({
  userId,
  hashedPassword,
}: {
  userId: string;
  hashedPassword: string;
}) {
  try {
    return await db
      .update(user)
      .set({
        password: hashedPassword,
        resetPasswordToken: null,
        resetPasswordTokenExpiry: null,
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update user password"
    );
  }
}

export async function setEmailVerificationCode({
  email,
  hashedCode,
  expiresAt,
}: {
  email: string;
  hashedCode: string;
  expiresAt: Date;
}) {
  try {
    return await db
      .update(user)
      .set({
        emailVerificationCode: hashedCode,
        emailVerificationCodeExpiry: expiresAt,
      })
      .where(eq(user.email, email))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to set email verification code"
    );
  }
}

export async function getUserByVerificationCode({
  hashedCode,
}: {
  hashedCode: string;
}): Promise<User | null> {
  try {
    const [foundUser] = await db
      .select()
      .from(user)
      .where(
        and(
          eq(user.emailVerificationCode, hashedCode),
          gt(user.emailVerificationCodeExpiry, new Date())
        )
      );

    return foundUser || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user by verification code"
    );
  }
}

export async function markEmailAsVerified({ email }: { email: string }) {
  try {
    return await db
      .update(user)
      .set({
        emailVerified: true,
        emailVerificationCode: null,
        emailVerificationCodeExpiry: null,
        updatedAt: new Date(),
      })
      .where(eq(user.email, email))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to mark email as verified"
    );
  }
}

export async function isEmailVerified({
  email,
}: {
  email: string;
}): Promise<boolean> {
  try {
    const [foundUser] = await db
      .select({ emailVerified: user.emailVerified })
      .from(user)
      .where(eq(user.email, email));

    return foundUser?.emailVerified ?? false;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to check email verification status"
    );
  }
}

export async function clearEmailVerificationCode({ email }: { email: string }) {
  try {
    return await db
      .update(user)
      .set({
        emailVerificationCode: null,
        emailVerificationCodeExpiry: null,
      })
      .where(eq(user.email, email));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to clear email verification code"
    );
  }
}

export async function saveChat({
  id,
  userId,
  title,
}: {
  id: string;
  userId: string;
  title: string;
}) {
  try {
    return await db.insert(chat).values({
      id,
      createdAt: new Date(),
      userId,
      title,
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save chat");
  }
}

export async function deleteChatById({ id }: { id: string }) {
  try {
    await db.delete(vote).where(eq(vote.chatId, id));
    await db.delete(message).where(eq(message.chatId, id));
    await db.delete(stream).where(eq(stream.chatId, id));

    const [chatsDeleted] = await db
      .delete(chat)
      .where(eq(chat.id, id))
      .returning();
    return chatsDeleted;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete chat by id"
    );
  }
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
  try {
    const userChats = await db
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, userId));

    if (userChats.length === 0) {
      return { deletedCount: 0 };
    }

    const chatIds = userChats.map((c) => c.id);

    await db.delete(vote).where(inArray(vote.chatId, chatIds));
    await db.delete(message).where(inArray(message.chatId, chatIds));
    await db.delete(stream).where(inArray(stream.chatId, chatIds));

    const deletedChats = await db
      .delete(chat)
      .where(eq(chat.userId, userId))
      .returning();

    return { deletedCount: deletedChats.length };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete all chats by user id"
    );
  }
}

export async function getChatsByUserId({
  id,
  limit,
  startingAfter,
  endingBefore,
}: {
  id: string;
  limit: number;
  startingAfter: string | null;
  endingBefore: string | null;
}) {
  try {
    const extendedLimit = limit + 1;

    const query = (whereCondition?: SQL<unknown>) =>
      db
        .select()
        .from(chat)
        .where(
          whereCondition
            ? and(whereCondition, eq(chat.userId, id))
            : eq(chat.userId, id)
        )
        .orderBy(desc(chat.createdAt))
        .limit(extendedLimit);

    let filteredChats: Chat[] = [];

    if (startingAfter) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, startingAfter))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${startingAfter} not found`
        );
      }

      filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
    } else if (endingBefore) {
      const [selectedChat] = await db
        .select()
        .from(chat)
        .where(eq(chat.id, endingBefore))
        .limit(1);

      if (!selectedChat) {
        throw new ChatSDKError(
          "not_found:database",
          `Chat with id ${endingBefore} not found`
        );
      }

      filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
    } else {
      filteredChats = await query();
    }

    const hasMore = filteredChats.length > limit;

    return {
      chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
      hasMore,
    };
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get chats by user id"
    );
  }
}

export async function getChatById({ id }: { id: string }) {
  try {
    const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
    if (!selectedChat) {
      return null;
    }

    return selectedChat;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to get chat by id");
  }
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
  try {
    return await db.insert(message).values(messages).onConflictDoNothing();
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save messages");
  }
}

export async function getMessagesByChatId({ id }: { id: string }) {
  try {
    return await db
      .select()
      .from(message)
      .where(eq(message.chatId, id))
      .orderBy(asc(message.createdAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get messages by chat id"
    );
  }
}

export async function voteMessage({
  chatId,
  messageId,
  type,
}: {
  chatId: string;
  messageId: string;
  type: "up" | "down";
}) {
  try {
    const [existingVote] = await db
      .select()
      .from(vote)
      .where(and(eq(vote.messageId, messageId)));

    if (existingVote) {
      return await db
        .update(vote)
        .set({ isUpvoted: type === "up" })
        .where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
    }
    return await db.insert(vote).values({
      chatId,
      messageId,
      isUpvoted: type === "up",
    });
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to vote message");
  }
}

export async function getVotesByChatId({ id }: { id: string }) {
  try {
    return await db.select().from(vote).where(eq(vote.chatId, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get votes by chat id"
    );
  }
}

export async function saveDocument({
  id,
  title,
  kind,
  content,
  userId,
  generationId,
}: {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  userId: string;
  generationId?: string | null;
}) {
  try {
    return await db
      .insert(document)
      .values({
        id,
        title,
        kind,
        content,
        userId,
        generationId: generationId ?? null,
        createdAt: new Date(),
      })
      .returning();
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to save document");
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const documents = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(asc(document.createdAt));

    return documents;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get documents by id"
    );
  }
}

export async function getDocumentById({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select()
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get document by id"
    );
  }
}

export async function getGenerationIdByDocumentId({ id }: { id: string }) {
  try {
    const [selectedDocument] = await db
      .select({ generationId: document.generationId })
      .from(document)
      .where(eq(document.id, id))
      .orderBy(desc(document.createdAt));

    return selectedDocument?.generationId ?? null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get generationId by document id"
    );
  }
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    await db
      .delete(suggestion)
      .where(
        and(
          eq(suggestion.documentId, id),
          gt(suggestion.documentCreatedAt, timestamp)
        )
      );

    return await db
      .delete(document)
      .where(and(eq(document.id, id), gt(document.createdAt, timestamp)))
      .returning();
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete documents by id after timestamp"
    );
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: Suggestion[];
}) {
  try {
    return await db.insert(suggestion).values(suggestions);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save suggestions"
    );
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    return await db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.documentId, documentId)));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get suggestions by document id"
    );
  }
}

export async function getMessageById({ id }: { id: string }) {
  try {
    return await db.select().from(message).where(eq(message.id, id));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message by id"
    );
  }
}

export async function deleteMessagesByChatIdAfterTimestamp({
  chatId,
  timestamp,
}: {
  chatId: string;
  timestamp: Date;
}) {
  try {
    const messagesToDelete = await db
      .select({ id: message.id })
      .from(message)
      .where(
        and(eq(message.chatId, chatId), gte(message.createdAt, timestamp))
      );

    const messageIds = messagesToDelete.map(
      (currentMessage) => currentMessage.id
    );

    if (messageIds.length > 0) {
      await db
        .delete(vote)
        .where(
          and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds))
        );

      return await db
        .delete(message)
        .where(
          and(eq(message.chatId, chatId), inArray(message.id, messageIds))
        );
    }
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete messages by chat id after timestamp"
    );
  }
}

export async function updateChatLastContextById({
  chatId,
  context,
}: {
  chatId: string;
  // Store merged server-enriched usage object
  context: AppUsage;
}) {
  try {
    return await db
      .update(chat)
      .set({ lastContext: context })
      .where(eq(chat.id, chatId));
  } catch (error) {
    console.warn("Failed to update lastContext for chat", chatId, error);
    return;
  }
}

export async function getMessageCountByUserId({
  id,
  differenceInHours,
}: {
  id: string;
  differenceInHours: number;
}) {
  try {
    const twentyFourHoursAgo = new Date(
      Date.now() - differenceInHours * 60 * 60 * 1000
    );

    const [stats] = await db
      .select({ count: count(message.id) })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(chat.userId, id),
          gte(message.createdAt, twentyFourHoursAgo),
          eq(message.role, "user")
        )
      )
      .execute();

    return stats?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get message count by user id"
    );
  }
}

export async function createStreamId({
  streamId,
  chatId,
}: {
  streamId: string;
  chatId: string;
}) {
  try {
    await db
      .insert(stream)
      .values({ id: streamId, chatId, createdAt: new Date() });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create stream id"
    );
  }
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
  try {
    const streamIds = await db
      .select({ id: stream.id })
      .from(stream)
      .where(eq(stream.chatId, chatId))
      .orderBy(asc(stream.createdAt))
      .execute();

    return streamIds.map(({ id }) => id);
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get stream ids by chat id"
    );
  }
}

export async function getActiveUserSubscription({
  userId,
}: {
  userId: string;
}): Promise<UserSubscription | null> {
  try {
    const now = new Date();
    const [subscription] = await db
      .select()
      .from(userSubscription)
      .where(
        and(
          eq(userSubscription.userId, userId),
          gt(userSubscription.currentPeriodEnd, now),
          eq(userSubscription.status, "active")
        )
      )
      .limit(1);

    return subscription || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get active user subscription"
    );
  }
}

export async function getUserSubscriptionWithPlan({
  userId,
}: {
  userId: string;
}): Promise<{ subscription: UserSubscription; plan: SubscriptionPlan } | null> {
  try {
    const now = new Date();
    const subscriptions = await db
      .select({
        subscription: userSubscription,
        plan: subscriptionPlan,
      })
      .from(userSubscription)
      .innerJoin(
        subscriptionPlan,
        eq(userSubscription.planId, subscriptionPlan.id)
      )
      .where(
        and(
          eq(userSubscription.userId, userId),
          gt(userSubscription.currentPeriodEnd, now),
          eq(userSubscription.status, "active")
        )
      )
      .orderBy(desc(userSubscription.currentPeriodEnd))
      .limit(1);

    if (subscriptions.length === 0) {
      return null;
    }

    return subscriptions[0];
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get user subscription with plan"
    );
  }
}

export async function getSearchUsageCountByDateRange({
  userId,
  startDate,
  endDate,
}: {
  userId: string;
  startDate: Date;
  endDate: Date;
}): Promise<number> {
  try {
    const [usageCount] = await db
      .select({ count: count() })
      .from(searchUsageLog)
      .where(
        and(
          eq(searchUsageLog.userId, userId),
          gte(searchUsageLog.createdAt, startDate),
          lte(searchUsageLog.createdAt, endDate)
        )
      );

    return usageCount?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get search usage count by date range"
    );
  }
}

export async function getSearchUsageCountByBillingPeriod({
  userId,
  periodStart,
  periodEnd,
}: {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<number> {
  try {
    const [usageCount] = await db
      .select({ count: count() })
      .from(searchUsageLog)
      .where(
        and(
          eq(searchUsageLog.userId, userId),
          gte(searchUsageLog.billingPeriodStart, periodStart),
          lte(searchUsageLog.billingPeriodEnd, periodEnd)
        )
      );

    return usageCount?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get search usage count by billing period"
    );
  }
}

export async function insertSearchUsageLog({
  userId,
  chatId,
  query,
  searchDepth,
  resultsCount,
  responseTimeMs,
  cached,
  billingPeriodType,
  billingPeriodStart,
  billingPeriodEnd,
}: {
  userId: string;
  chatId: string | null;
  query: string;
  searchDepth: string;
  resultsCount: number;
  responseTimeMs: number;
  cached: boolean;
  billingPeriodType: "daily" | "weekly" | "monthly" | "annual";
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
}): Promise<void> {
  try {
    await db.insert(searchUsageLog).values({
      userId,
      chatId,
      query,
      searchDepth,
      resultsCount,
      responseTimeMs,
      cached,
      billingPeriodType,
      billingPeriodStart,
      billingPeriodEnd,
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to insert search usage log"
    );
  }
}

export async function getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
  try {
    return await db
      .select()
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.isActive, true));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get subscription plans"
    );
  }
}

export async function getSubscriptionPlanByName({
  name,
}: {
  name: string;
}): Promise<SubscriptionPlan | null> {
  try {
    const [plan] = await db
      .select()
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.name, name))
      .limit(1);

    return plan || null;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get subscription plan by name"
    );
  }
}

export async function createUserSubscription({
  userId,
  planId,
  billingPeriod,
  billingPeriodCount = 1,
}: {
  userId: string;
  planId: string;
  billingPeriod: "daily" | "weekly" | "monthly" | "annual";
  billingPeriodCount?: number;
}): Promise<UserSubscription> {
  try {
    const now = new Date();
    const periodEnd = calculatePeriodEnd(
      now,
      billingPeriod,
      billingPeriodCount
    );
    const nextBillingDate = periodEnd;

    const [subscription] = await db
      .insert(userSubscription)
      .values({
        userId,
        planId,
        billingPeriod,
        billingPeriodCount,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingDate,
        status: "active",
      })
      .returning();

    return subscription;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create user subscription"
    );
  }
}

export async function insertImageGenerationUsageLog({
  userId,
  chatId,
  modelId,
  prompt,
  imageUrl,
  generationId,
  success,
  promptTokens,
  candidatesTokens,
  thoughtsTokens,
  totalTokens,
  totalCostUsd,
  billingPeriodType,
  billingPeriodStart,
  billingPeriodEnd,
}: {
  userId: string;
  chatId: string | null;
  modelId: string;
  prompt: string;
  imageUrl: string | null;
  generationId: string | null;
  success: boolean;
  promptTokens: number;
  candidatesTokens: number;
  thoughtsTokens: number;
  totalTokens: number;
  totalCostUsd: string | null;
  billingPeriodType: "daily" | "weekly" | "monthly" | "annual";
  billingPeriodStart: Date;
  billingPeriodEnd: Date;
}): Promise<void> {
  try {
    await db.insert(imageGenerationUsageLog).values({
      userId,
      chatId,
      modelId,
      prompt,
      imageUrl,
      generationId,
      success,
      promptTokens,
      candidatesTokens,
      thoughtsTokens,
      totalTokens,
      totalCostUsd,
      billingPeriodType,
      billingPeriodStart,
      billingPeriodEnd,
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to insert image generation usage log"
    );
  }
}

export async function getImageGenerationCountByBillingPeriod({
  userId,
  periodStart,
  periodEnd,
}: {
  userId: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<number> {
  try {
    const [usageCount] = await db
      .select({ count: count() })
      .from(imageGenerationUsageLog)
      .where(
        and(
          eq(imageGenerationUsageLog.userId, userId),
          gte(imageGenerationUsageLog.billingPeriodStart, periodStart),
          lte(imageGenerationUsageLog.billingPeriodEnd, periodEnd)
        )
      );

    return usageCount?.count ?? 0;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to get image generation count by billing period"
    );
  }
}

export async function saveCancellationFeedback({
  userId,
  subscriptionId,
  reasons,
  additionalFeedback,
  planName,
  billingPeriod,
  subscriptionDurationDays,
  wasTrial,
}: {
  userId: string;
  subscriptionId: string;
  reasons: string[];
  additionalFeedback?: string;
  planName?: string;
  billingPeriod?: "daily" | "weekly" | "monthly" | "annual";
  subscriptionDurationDays?: number;
  wasTrial: boolean;
}): Promise<void> {
  try {
    await db.insert(cancellationFeedback).values({
      userId,
      subscriptionId,
      reasons,
      additionalFeedback: additionalFeedback || null,
      planName: planName || null,
      billingPeriod: billingPeriod || null,
      subscriptionDurationDays: subscriptionDurationDays || null,
      wasTrial,
    });
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to save cancellation feedback"
    );
  }
}

// ============================================================================
// TEXT STYLE QUERIES
// ============================================================================

export async function getTextStylesByUserId({
  userId,
}: {
  userId: string;
}): Promise<TextStyle[]> {
  try {
    return await db
      .select()
      .from(textStyle)
      .where(eq(textStyle.userId, userId))
      .orderBy(desc(textStyle.updatedAt));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to fetch text styles"
    );
  }
}

export async function getTextStyleById({
  id,
}: {
  id: string;
}): Promise<TextStyle | undefined> {
  try {
    const [style] = await db
      .select()
      .from(textStyle)
      .where(eq(textStyle.id, id));
    return style;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to fetch text style"
    );
  }
}

export async function createTextStyle({
  userId,
  name,
  examples = [],
  isDefault = false,
}: {
  userId: string;
  name: string;
  examples?: string[];
  isDefault?: boolean;
}): Promise<TextStyle> {
  try {
    if (isDefault) {
      await db
        .update(textStyle)
        .set({ isDefault: false })
        .where(eq(textStyle.userId, userId));
    }

    const [created] = await db
      .insert(textStyle)
      .values({ userId, name, examples, isDefault })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to create text style"
    );
  }
}

export async function updateTextStyle({
  id,
  userId,
  name,
  examples,
  isDefault,
}: {
  id: string;
  userId: string;
  name?: string;
  examples?: string[];
  isDefault?: boolean;
}): Promise<TextStyle> {
  try {
    if (isDefault) {
      await db
        .update(textStyle)
        .set({ isDefault: false })
        .where(eq(textStyle.userId, userId));
    }

    const updates: Partial<{
      name: string;
      examples: string[];
      isDefault: boolean;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (name !== undefined) {
      updates.name = name;
    }
    if (examples !== undefined) {
      updates.examples = examples;
    }
    if (isDefault !== undefined) {
      updates.isDefault = isDefault;
    }

    const [updated] = await db
      .update(textStyle)
      .set(updates)
      .where(and(eq(textStyle.id, id), eq(textStyle.userId, userId)))
      .returning();
    return updated;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to update text style"
    );
  }
}

export async function deleteTextStyle({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<void> {
  try {
    await db
      .delete(textStyle)
      .where(and(eq(textStyle.id, id), eq(textStyle.userId, userId)));
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to delete text style"
    );
  }
}

export async function getDefaultTextStyle({
  userId,
}: {
  userId: string;
}): Promise<TextStyle | undefined> {
  try {
    const [style] = await db
      .select()
      .from(textStyle)
      .where(and(eq(textStyle.userId, userId), eq(textStyle.isDefault, true)));
    return style;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to fetch default text style"
    );
  }
}

// ============================================================================
// PROJECT QUERIES
// ============================================================================

export async function getProjectsByUserId({
  userId,
}: {
  userId: string;
}): Promise<Project[]> {
  try {
    return await db
      .select()
      .from(project)
      .where(eq(project.userId, userId))
      .orderBy(desc(project.updatedAt));
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to fetch projects");
  }
}

export async function getProjectById({
  id,
}: {
  id: string;
}): Promise<Project | undefined> {
  try {
    const [found] = await db.select().from(project).where(eq(project.id, id));
    return found;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to fetch project");
  }
}

export async function createProject({
  userId,
  name,
  contextEntries = [],
  isDefault = false,
}: {
  userId: string;
  name: string;
  contextEntries?: string[];
  isDefault?: boolean;
}): Promise<Project> {
  try {
    if (isDefault) {
      await db
        .update(project)
        .set({ isDefault: false })
        .where(eq(project.userId, userId));
    }

    const [created] = await db
      .insert(project)
      .values({ userId, name, contextEntries, isDefault })
      .returning();
    return created;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to create project");
  }
}

export async function updateProject({
  id,
  userId,
  name,
  contextEntries,
  isDefault,
}: {
  id: string;
  userId: string;
  name?: string;
  contextEntries?: string[];
  isDefault?: boolean;
}): Promise<Project> {
  try {
    if (isDefault) {
      await db
        .update(project)
        .set({ isDefault: false })
        .where(eq(project.userId, userId));
    }

    const updates: Partial<{
      name: string;
      contextEntries: string[];
      isDefault: boolean;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (name !== undefined) {
      updates.name = name;
    }
    if (contextEntries !== undefined) {
      updates.contextEntries = contextEntries;
    }
    if (isDefault !== undefined) {
      updates.isDefault = isDefault;
    }

    const [updated] = await db
      .update(project)
      .set(updates)
      .where(and(eq(project.id, id), eq(project.userId, userId)))
      .returning();
    return updated;
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to update project");
  }
}

export async function deleteProject({
  id,
  userId,
}: {
  id: string;
  userId: string;
}): Promise<void> {
  try {
    await db
      .delete(project)
      .where(and(eq(project.id, id), eq(project.userId, userId)));
  } catch (_error) {
    throw new ChatSDKError("bad_request:database", "Failed to delete project");
  }
}

export async function getDefaultProject({
  userId,
}: {
  userId: string;
}): Promise<Project | undefined> {
  try {
    const [found] = await db
      .select()
      .from(project)
      .where(and(eq(project.userId, userId), eq(project.isDefault, true)));
    return found;
  } catch (_error) {
    throw new ChatSDKError(
      "bad_request:database",
      "Failed to fetch default project"
    );
  }
}
