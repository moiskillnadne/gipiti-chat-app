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
    currentPlan: varchar("current_plan", { length: 32 }), // No default - new users must subscribe
    // Temporarily default to Russian - was "en"
    preferredLanguage: varchar("preferred_language", { length: 8 }).default(
      "ru"
    ),
    emailVerified: boolean("email_verified").default(false).notNull(),
    isTester: boolean("is_tester").default(false).notNull(),
    emailVerificationCode: varchar("email_verification_code", { length: 255 }),
    emailVerificationCodeExpiry: timestamp("email_verification_code_expiry"),
    resetPasswordToken: varchar("reset_password_token", { length: 255 }),
    resetPasswordTokenExpiry: timestamp("reset_password_token_expiry"),
    trialUsedAt: timestamp("trial_used_at"),

    // Token balance system
    tokenBalance: bigint("token_balance", { mode: "number" })
      .notNull()
      .default(0),
    lastBalanceResetAt: timestamp("last_balance_reset_at"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    resetTokenIdx: index("user_reset_password_token_idx").on(
      table.resetPasswordToken
    ),
    verificationCodeIdx: index("user_email_verification_code_idx").on(
      table.emailVerificationCode
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
  modelId: varchar("modelId", { length: 128 }),
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
    generationId: varchar("generationId", { length: 256 }),
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

// Payment intent status enum
export const paymentIntentStatusEnum = pgEnum("payment_intent_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "expired",
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
    billingPeriodCount: integer("billing_period_count").notNull().default(1),

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
      searchQuota?: number;
      searchDepthAllowed?: string;
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
    billingPeriodCount: integer("billing_period_count").notNull().default(1),

    // Current billing period
    currentPeriodStart: timestamp("current_period_start").notNull(),
    currentPeriodEnd: timestamp("current_period_end").notNull(),

    // Next billing date
    nextBillingDate: timestamp("next_billing_date").notNull(),

    // Status
    status: varchar("status", { length: 32 }).notNull().default("active"),

    // Payment integration (CloudPayments)
    externalSubscriptionId: varchar("external_subscription_id", {
      length: 128,
    }),
    cardToken: varchar("card_token", { length: 128 }),
    cardMask: varchar("card_mask", { length: 32 }),

    // Payment history reference
    lastPaymentDate: timestamp("last_payment_date"),
    lastPaymentAmount: decimal("last_payment_amount", {
      precision: 10,
      scale: 2,
    }),

    // Cancellation
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),

    // Trial
    isTrial: boolean("is_trial").default(false).notNull(),
    trialEndsAt: timestamp("trial_ends_at"),

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

// Payment Intent (tracks payment lifecycle for redirect recovery)
export const paymentIntent = pgTable(
  "PaymentIntent",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),

    // Unique session identifier for client-side tracking
    sessionId: varchar("session_id", { length: 64 }).notNull(),

    // User & plan info
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    planName: varchar("plan_name", { length: 64 }).notNull(),

    // Payment details
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("RUB"),

    // Status tracking
    status: paymentIntentStatusEnum("status").notNull().default("pending"),

    // Trial
    isTrial: boolean("is_trial").default(false).notNull(),

    // CloudPayments integration
    externalTransactionId: varchar("external_transaction_id", { length: 128 }),
    externalSubscriptionId: varchar("external_subscription_id", {
      length: 128,
    }),

    // Failure info
    failureReason: text("failure_reason"),

    // Additional metadata
    metadata: jsonb("metadata").$type<{
      planDisplayName?: string;
      billingPeriod?: string;
      clientIp?: string;
      userAgent?: string;
    }>(),

    // Expiration (30 minutes default)
    expiresAt: timestamp("expires_at").notNull(),

    // Meta
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    sessionIdIdx: uniqueIndex("payment_intent_session_id_idx").on(
      table.sessionId
    ),
    userIdStatusIdx: index("payment_intent_user_id_status_idx").on(
      table.userId,
      table.status
    ),
    expiresAtIdx: index("payment_intent_expires_at_idx").on(table.expiresAt),
    createdAtIdx: index("payment_intent_created_at_idx").on(table.createdAt),
  })
);

export type PaymentIntent = InferSelectModel<typeof paymentIntent>;

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

// Image Generation Usage Log
export const imageGenerationUsageLog = pgTable(
  "ImageGenerationUsageLog",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),

    // User context
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    chatId: uuid("chat_id").references(() => chat.id, { onDelete: "set null" }),

    // Image generation details
    modelId: varchar("model_id", { length: 128 }).notNull(),
    prompt: text("prompt").notNull(),
    imageUrl: varchar("image_url", { length: 512 }),
    generationId: varchar("generation_id", { length: 256 }),
    success: boolean("success").notNull().default(true),

    // Token usage (from metadata.google.usageMetadata)
    promptTokens: integer("prompt_tokens").default(0),
    candidatesTokens: integer("candidates_tokens").default(0),
    thoughtsTokens: integer("thoughts_tokens").default(0),
    totalTokens: integer("total_tokens").default(0),

    // Pricing (from metadata.gateway.cost - in USD)
    totalCostUsd: decimal("total_cost_usd", { precision: 12, scale: 8 }),

    // Billing period
    billingPeriodType: billingPeriodEnum("billing_period_type").notNull(),
    billingPeriodStart: timestamp("billing_period_start").notNull(),
    billingPeriodEnd: timestamp("billing_period_end").notNull(),

    // Meta
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("image_generation_usage_log_user_id_idx").on(table.userId),
    chatIdIdx: index("image_generation_usage_log_chat_id_idx").on(table.chatId),
    createdAtIdx: index("image_generation_usage_log_created_at_idx").on(
      table.createdAt
    ),
    userPeriodIdx: index("image_generation_usage_log_user_period_idx").on(
      table.userId,
      table.billingPeriodStart,
      table.billingPeriodEnd
    ),
  })
);

export type ImageGenerationUsageLog = InferSelectModel<
  typeof imageGenerationUsageLog
>;

// Cancellation Feedback - tracks why users cancel subscriptions
export const cancellationFeedback = pgTable(
  "CancellationFeedback",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),

    // User context
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => userSubscription.id, { onDelete: "cascade" }),

    // Feedback data
    reasons: jsonb("reasons").$type<string[]>().notNull(),
    additionalFeedback: text("additional_feedback"),

    // Context at cancellation time
    planName: varchar("plan_name", { length: 64 }),
    billingPeriod: billingPeriodEnum("billing_period"),
    subscriptionDurationDays: integer("subscription_duration_days"),
    wasTrial: boolean("was_trial").default(false).notNull(),

    // Meta
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("cancellation_feedback_user_id_idx").on(table.userId),
    createdAtIdx: index("cancellation_feedback_created_at_idx").on(
      table.createdAt
    ),
  })
);

export type CancellationFeedback = InferSelectModel<
  typeof cancellationFeedback
>;

// Token Balance Transaction Type enum
export const tokenBalanceTransactionTypeEnum = pgEnum(
  "token_balance_transaction_type",
  ["credit", "debit", "reset", "adjustment"]
);

// Token Balance Transaction (audit trail for balance changes)
export const tokenBalanceTransaction = pgTable(
  "TokenBalanceTransaction",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),

    // User reference
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Transaction type
    type: tokenBalanceTransactionTypeEnum("type").notNull(),

    // Amount (positive for credit/reset, negative for debit)
    amount: bigint("amount", { mode: "number" }).notNull(),

    // Balance after this transaction
    balanceAfter: bigint("balance_after", { mode: "number" }).notNull(),

    // Reference to what caused this transaction
    referenceType: varchar("reference_type", { length: 32 }), // "payment" | "usage" | "subscription_reset" | "admin" | "migration"
    referenceId: varchar("reference_id", { length: 128 }), // e.g., payment intent ID, usage log ID

    // Optional description
    description: text("description"),

    // Metadata for additional context
    metadata: jsonb("metadata").$type<{
      modelId?: string;
      chatId?: string;
      planName?: string;
      subscriptionId?: string;
      previousBalance?: number;
    }>(),

    // Meta
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("token_balance_transaction_user_id_idx").on(table.userId),
    typeIdx: index("token_balance_transaction_type_idx").on(table.type),
    createdAtIdx: index("token_balance_transaction_created_at_idx").on(
      table.createdAt
    ),
    userCreatedIdx: index("token_balance_transaction_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
    referenceIdx: index("token_balance_transaction_reference_idx").on(
      table.referenceType,
      table.referenceId
    ),
  })
);

export type TokenBalanceTransaction = InferSelectModel<
  typeof tokenBalanceTransaction
>;

// ============================================================================
// TEXT STYLE TABLE
// ============================================================================

export const textStyle = pgTable(
  "TextStyle",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    examples: jsonb("examples").$type<string[]>().notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("text_style_user_id_idx").on(table.userId),
  })
);

export type TextStyle = InferSelectModel<typeof textStyle>;

// ============================================================================
// PROJECT TABLE
// ============================================================================

export const project = pgTable(
  "Project",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    contextEntries: jsonb("context_entries").$type<string[]>().notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("project_user_id_idx").on(table.userId),
  })
);

export type Project = InferSelectModel<typeof project>;
