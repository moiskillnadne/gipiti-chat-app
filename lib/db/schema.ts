import type { InferSelectModel } from "drizzle-orm";
import {
  bigint,
  boolean,
  decimal,
  foreignKey,
  index,
  integer,
  json,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AppUsage } from "../usage";

export const user = pgTable(
  "User",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    email: varchar("email", { length: 64 }).notNull(),
    password: varchar("password", { length: 64 }),
    currentPlan: varchar("current_plan", { length: 32 }).default("tester"),
    preferredLanguage: varchar("preferred_language", { length: 8 }).default(
      "en"
    ),
    resetPasswordToken: varchar("reset_password_token", { length: 255 }),
    resetPasswordTokenExpiry: timestamp("reset_password_token_expiry"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    resetTokenIdx: index("user_reset_password_token_idx").on(
      table.resetPasswordToken
    ),
  })
);

export type User = InferSelectModel<typeof user>;

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
  lastContext: jsonb("lastContext").$type<AppUsage | null>(),
});

export type Chat = InferSelectModel<typeof chat>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const messageDeprecated = pgTable("Message", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  content: json("content").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type MessageDeprecated = InferSelectModel<typeof messageDeprecated>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

// DEPRECATED: The following schema is deprecated and will be removed in the future.
// Read the migration guide at https://chat-sdk.dev/docs/migration-guides/message-parts
export const voteDeprecated = pgTable(
  "Vote",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => messageDeprecated.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type VoteDeprecated = InferSelectModel<typeof voteDeprecated>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.chatId, table.messageId] }),
    };
  }
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "sheet"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  }
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }),
  })
);

export type Stream = InferSelectModel<typeof stream>;

// ============================================================================
// TOKEN TRACKING & SUBSCRIPTION TABLES
// ============================================================================

// Billing period enum
export const billingPeriodEnum = pgEnum("billing_period", [
  "daily",
  "weekly",
  "monthly",
  "annual",
]);

// Subscription Plans
export const subscriptionPlan = pgTable(
  "SubscriptionPlan",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: varchar("name", { length: 64 }).notNull(),
    displayName: varchar("display_name", { length: 128 }),

    // Billing configuration
    billingPeriod: billingPeriodEnum("billing_period")
      .notNull()
      .default("monthly"),

    // Token limits (per billing period)
    tokenQuota: bigint("token_quota", { mode: "number" }).notNull(),

    // Optional: Per-model limits
    modelLimits: jsonb("model_limits").$type<Record<string, number>>(),

    // Feature flags
    features: jsonb("features").$type<{
      maxMessagesPerPeriod?: number;
      allowedModels: string[];
      hasReasoningModels: boolean;
      hasPrioritySupport: boolean;
      maxFileSize?: number;
      maxConcurrentChats?: number;
      hasAPIAccess?: boolean;
    }>(),

    // Pricing (for display/reference)
    price: decimal("price", { precision: 10, scale: 2 }),

    // Meta
    isActive: boolean("is_active").default(true).notNull(),
    isTesterPlan: boolean("is_tester_plan").default(false).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: uniqueIndex("subscription_plan_name_idx").on(table.name),
  })
);

export type SubscriptionPlan = InferSelectModel<typeof subscriptionPlan>;

// User Subscriptions
export const userSubscription = pgTable(
  "UserSubscription",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    planId: uuid("plan_id")
      .notNull()
      .references(() => subscriptionPlan.id),

    // Billing period configuration
    billingPeriod: billingPeriodEnum("billing_period").notNull(),

    // Current billing period
    currentPeriodStart: timestamp("current_period_start").notNull(),
    currentPeriodEnd: timestamp("current_period_end").notNull(),

    // Next billing date
    nextBillingDate: timestamp("next_billing_date").notNull(),

    // Status
    status: varchar("status", { length: 32 }).notNull().default("active"),

    // Payment integration (for future use)
    externalSubscriptionId: varchar("external_subscription_id", {
      length: 128,
    }),
    externalCustomerId: varchar("external_customer_id", { length: 128 }),

    // Payment history reference
    lastPaymentDate: timestamp("last_payment_date"),
    lastPaymentAmount: decimal("last_payment_amount", {
      precision: 10,
      scale: 2,
    }),

    // Cancellation
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),

    // Meta
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    cancelledAt: timestamp("cancelled_at"),
  },
  (table) => ({
    userIdIdx: index("user_subscription_user_id_idx").on(table.userId),
    statusIdx: index("user_subscription_status_idx").on(table.status),
    nextBillingIdx: index("user_subscription_next_billing_idx").on(
      table.nextBillingDate
    ),
  })
);

export type UserSubscription = InferSelectModel<typeof userSubscription>;

// Token Usage Log
export const tokenUsageLog = pgTable(
  "TokenUsageLog",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),

    // User & subscription
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(
      () => userSubscription.id,
      { onDelete: "set null" }
    ),

    // Chat context
    chatId: uuid("chat_id").references(() => chat.id, { onDelete: "set null" }),
    messageId: uuid("message_id").references(() => message.id, {
      onDelete: "set null",
    }),

    // Model & usage
    modelId: varchar("model_id", { length: 128 }).notNull(),

    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    totalTokens: integer("total_tokens").notNull().default(0),

    // Cache tokens (for Claude)
    cacheWriteTokens: integer("cache_write_tokens").default(0),
    cacheReadTokens: integer("cache_read_tokens").default(0),

    // Pricing (from TokenLens)
    inputCost: decimal("input_cost", { precision: 12, scale: 8 }),
    outputCost: decimal("output_cost", { precision: 12, scale: 8 }),
    totalCost: decimal("total_cost", { precision: 12, scale: 8 }),

    // Billing period this usage belongs to
    billingPeriodType: billingPeriodEnum("billing_period_type").notNull(),
    billingPeriodStart: timestamp("billing_period_start").notNull(),
    billingPeriodEnd: timestamp("billing_period_end").notNull(),

    // Meta
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("token_usage_log_user_id_idx").on(table.userId),
    chatIdIdx: index("token_usage_log_chat_id_idx").on(table.chatId),
    createdAtIdx: index("token_usage_log_created_at_idx").on(table.createdAt),
    billingPeriodIdx: index("token_usage_log_billing_period_idx").on(
      table.billingPeriodStart,
      table.billingPeriodEnd
    ),
    userPeriodIdx: index("token_usage_log_user_period_idx").on(
      table.userId,
      table.billingPeriodStart,
      table.billingPeriodEnd
    ),
  })
);

export type TokenUsageLog = InferSelectModel<typeof tokenUsageLog>;

// User Token Usage Aggregate
export const userTokenUsage = pgTable(
  "UserTokenUsage",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),

    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => userSubscription.id, { onDelete: "cascade" }),

    // Billing period
    billingPeriodType: billingPeriodEnum("billing_period_type").notNull(),
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),

    // Aggregated totals
    totalInputTokens: bigint("total_input_tokens", { mode: "number" })
      .notNull()
      .default(0),
    totalOutputTokens: bigint("total_output_tokens", { mode: "number" })
      .notNull()
      .default(0),
    totalTokens: bigint("total_tokens", { mode: "number" })
      .notNull()
      .default(0),

    // Per-model breakdowns
    modelBreakdown:
      jsonb("model_breakdown").$type<
        Record<
          string,
          {
            inputTokens: number;
            outputTokens: number;
            totalTokens: number;
            cost: number;
            requestCount: number;
          }
        >
      >(),

    // Cost totals
    totalCost: decimal("total_cost", { precision: 12, scale: 4 }),

    // Request count
    totalRequests: integer("total_requests").notNull().default(0),

    // Meta
    lastUpdatedAt: timestamp("last_updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userPeriodUnique: uniqueIndex("user_token_usage_user_period_idx").on(
      table.userId,
      table.periodStart,
      table.periodEnd
    ),
    subscriptionIdx: index("user_token_usage_subscription_idx").on(
      table.subscriptionId
    ),
  })
);

export type UserTokenUsage = InferSelectModel<typeof userTokenUsage>;

// Search Usage Log
export const searchUsageLog = pgTable(
  "SearchUsageLog",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),

    // User context
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    chatId: uuid("chat_id").references(() => chat.id, { onDelete: "set null" }),

    // Search details
    query: varchar("query", { length: 400 }).notNull(),
    searchDepth: varchar("search_depth", { length: 20 }).notNull(),
    resultsCount: integer("results_count").notNull(),
    responseTimeMs: integer("response_time_ms").notNull(),
    cached: boolean("cached").notNull().default(false),

    // Billing period this usage belongs to
    billingPeriodType: billingPeriodEnum("billing_period_type").notNull(),
    billingPeriodStart: timestamp("billing_period_start").notNull(),
    billingPeriodEnd: timestamp("billing_period_end").notNull(),

    // Meta
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("search_usage_log_user_id_idx").on(table.userId),
    chatIdIdx: index("search_usage_log_chat_id_idx").on(table.chatId),
    createdAtIdx: index("search_usage_log_created_at_idx").on(table.createdAt),
    userPeriodIdx: index("search_usage_log_user_period_idx").on(
      table.userId,
      table.billingPeriodStart,
      table.billingPeriodEnd
    ),
  })
);

export type SearchUsageLog = InferSelectModel<typeof searchUsageLog>;
