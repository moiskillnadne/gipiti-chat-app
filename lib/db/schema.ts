import { type InferSelectModel, sql } from "drizzle-orm";
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

// ============================================================================
// USER & AUTH
// ============================================================================

export const user = pgTable(
  "User",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    password: varchar("password", { length: 255 }),
    emailVerified: boolean("email_verified").default(false).notNull(),
    isTester: boolean("is_tester").default(false).notNull(),
    emailVerificationCode: varchar("email_verification_code", { length: 255 }),
    emailVerificationCodeExpiry: timestamp("email_verification_code_expiry"),
    resetPasswordToken: varchar("reset_password_token", { length: 255 }),
    resetPasswordTokenExpiry: timestamp("reset_password_token_expiry"),
    trialUsedAt: timestamp("trial_used_at"),

    // UTM attribution
    utmSource: varchar("utm_source", { length: 255 }),
    utmMedium: varchar("utm_medium", { length: 255 }),
    utmCampaign: varchar("utm_campaign", { length: 255 }),
    utmContent: varchar("utm_content", { length: 255 }),
    utmTerm: varchar("utm_term", { length: 255 }),

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

// ============================================================================
// CURRENCY & FX
// ============================================================================

// Supported balance/billing currencies. ISO 4217 codes.
// `minorUnits` follows ISO 4217 (RUB=2, KZT=2, JPY=0). All monetary amounts in
// other tables are stored as integers in the minor unit of their currency.
export const currency = pgTable("Currency", {
  code: varchar("code", { length: 3 }).primaryKey().notNull(),
  name: varchar("name", { length: 64 }).notNull(),
  symbol: varchar("symbol", { length: 8 }).notNull(),
  minorUnits: integer("minor_units").notNull().default(2),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Currency = InferSelectModel<typeof currency>;

// Live FX rates, periodically refreshed. Provider costs are quoted in USD, so
// `baseCurrency` is always USD. Deduction uses the latest row for a quote
// currency; on fetch failure the last cached row is reused.
export const fxRate = pgTable(
  "FxRate",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    baseCurrency: varchar("base_currency", { length: 3 })
      .notNull()
      .default("USD"),
    quoteCurrency: varchar("quote_currency", { length: 3 })
      .notNull()
      .references(() => currency.code),
    // Quote-currency units per 1 unit of base (USD).
    rate: decimal("rate", { precision: 18, scale: 8 }).notNull(),
    source: varchar("source", { length: 64 }).notNull(),
    fetchedAt: timestamp("fetched_at").notNull().defaultNow(),
  },
  (table) => ({
    latestIdx: index("fx_rate_quote_fetched_idx").on(
      table.quoteCurrency,
      table.fetchedAt
    ),
  })
);

export type FxRate = InferSelectModel<typeof fxRate>;

// ============================================================================
// BALANCE — single source of truth for spendable funds (one row per user)
// ============================================================================

// Two pools share one currency:
//   - subscriptionAmount: wiped to 0 and re-credited on each renewal.
//   - topupAmount: persistent, accumulates across time (top-up purchase flow
//     is out of scope for now; the welcome grant lands here so it never resets).
// Deduction order: subscription pool first, then top-up.
export const balance = pgTable("Balance", {
  userId: uuid("user_id")
    .primaryKey()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  currencyCode: varchar("currency_code", { length: 3 })
    .notNull()
    .references(() => currency.code),
  subscriptionAmount: bigint("subscription_amount", { mode: "number" })
    .notNull()
    .default(0),
  topupAmount: bigint("topup_amount", { mode: "number" }).notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Balance = InferSelectModel<typeof balance>;

// ============================================================================
// CHAT (unchanged structurally; FK cascades tightened)
// ============================================================================

export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull(),
  title: text("title").notNull(),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  lastContext: jsonb("lastContext").$type<AppUsage | null>(),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable("Message_v2", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  role: varchar("role").notNull(),
  parts: json("parts").notNull(),
  attachments: json("attachments").notNull(),
  createdAt: timestamp("createdAt").notNull(),
  modelId: varchar("modelId", { length: 128 }),
});

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
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
    kind: varchar("kind", {
      enum: ["image", "video"],
    })
      .notNull()
      .default("image"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    generationId: varchar("generationId", { length: 256 }),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.id, table.createdAt] }),
    };
  }
);

export type Document = InferSelectModel<typeof document>;

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
    }).onDelete("cascade"),
  })
);

export type Stream = InferSelectModel<typeof stream>;

// ============================================================================
// SUBSCRIPTIONS & BILLING
// ============================================================================

export const billingPeriodEnum = pgEnum("billing_period", [
  "daily",
  "weekly",
  "monthly",
  "annual",
]);

export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active",
  "past_due",
  "cancelled",
  "expired",
]);

export const paymentIntentStatusEnum = pgEnum("payment_intent_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "expired",
]);

export const paymentIntentKindEnum = pgEnum("payment_intent_kind", [
  "subscription",
  "topup",
]);

// Subscription catalog (dictionary). Immutable once issued — to change pricing,
// add a new SubscriptionPrice row or a new Subscription and deactivate the old.
// No quotas/feature flags: this is a pure pay-per-use model.
export const subscription = pgTable(
  "Subscription",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    code: varchar("code", { length: 64 }).notNull(),
    displayName: varchar("display_name", { length: 128 }),
    billingPeriod: billingPeriodEnum("billing_period")
      .notNull()
      .default("monthly"),
    billingPeriodCount: integer("billing_period_count").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    codeIdx: uniqueIndex("subscription_code_idx").on(table.code),
  })
);

export type Subscription = InferSelectModel<typeof subscription>;

// Per-currency price for a subscription. `price` (minor units) is both what the
// user pays and what is credited to Balance.subscriptionAmount on renewal (1:1).
export const subscriptionPrice = pgTable(
  "SubscriptionPrice",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscription.id, { onDelete: "cascade" }),
    currencyCode: varchar("currency_code", { length: 3 })
      .notNull()
      .references(() => currency.code),
    price: bigint("price", { mode: "number" }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    subCurrencyIdx: uniqueIndex("subscription_price_sub_currency_idx").on(
      table.subscriptionId,
      table.currencyCode
    ),
  })
);

export type SubscriptionPrice = InferSelectModel<typeof subscriptionPrice>;

// A user's current subscription. At most one active row per user (enforced by a
// partial unique index). Free users simply have no active row.
export const userSubscription = pgTable(
  "UserSubscription",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => subscription.id),
    // Locked at signup; must match Balance.currencyCode.
    currencyCode: varchar("currency_code", { length: 3 })
      .notNull()
      .references(() => currency.code),

    status: subscriptionStatusEnum("status").notNull().default("active"),

    currentPeriodStart: timestamp("current_period_start").notNull(),
    currentPeriodEnd: timestamp("current_period_end").notNull(),
    nextBillingDate: timestamp("next_billing_date").notNull(),

    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),

    // CloudPayments integration
    externalSubscriptionId: varchar("external_subscription_id", {
      length: 128,
    }),
    cardToken: varchar("card_token", { length: 128 }),
    cardMask: varchar("card_mask", { length: 32 }),

    // Last payment (minor units of currencyCode)
    lastPaymentDate: timestamp("last_payment_date"),
    lastPaymentAmount: bigint("last_payment_amount", { mode: "number" }),

    // Trial
    isTrial: boolean("is_trial").default(false).notNull(),
    trialEndsAt: timestamp("trial_ends_at"),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    cancelledAt: timestamp("cancelled_at"),
  },
  (table) => ({
    activeUserIdx: uniqueIndex("user_subscription_active_user_idx")
      .on(table.userId)
      .where(sql`${table.status} = 'active'`),
    statusIdx: index("user_subscription_status_idx").on(table.status),
    nextBillingIdx: index("user_subscription_next_billing_idx").on(
      table.nextBillingDate
    ),
  })
);

export type UserSubscription = InferSelectModel<typeof userSubscription>;

// Payment lifecycle tracking for redirect recovery. `kind` distinguishes a
// recurring subscription purchase from a one-off top-up (top-up flow TBD).
export const paymentIntent = pgTable(
  "PaymentIntent",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    sessionId: varchar("session_id", { length: 64 }).notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    kind: paymentIntentKindEnum("kind").notNull().default("subscription"),
    subscriptionId: uuid("subscription_id").references(() => subscription.id),

    currencyCode: varchar("currency_code", { length: 3 })
      .notNull()
      .references(() => currency.code),
    // Minor units of currencyCode.
    amount: bigint("amount", { mode: "number" }).notNull(),

    status: paymentIntentStatusEnum("status").notNull().default("pending"),

    externalTransactionId: varchar("external_transaction_id", { length: 128 }),
    externalSubscriptionId: varchar("external_subscription_id", {
      length: 128,
    }),

    failureReason: text("failure_reason"),

    metadata: jsonb("metadata").$type<{
      subscriptionCode?: string;
      billingPeriod?: string;
      clientIp?: string;
      userAgent?: string;
    }>(),

    expiresAt: timestamp("expires_at").notNull(),

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

// ============================================================================
// TRANSACTION — single audit log for every balance movement
// ============================================================================

export const transactionTypeEnum = pgEnum("transaction_type", [
  "welcome",
  "email_bonus",
  "subscription_renewal",
  "subscription_purchase",
  "topup_purchase",
  "usage_debit",
  "refund",
  "adjustment",
]);

export const balancePoolEnum = pgEnum("balance_pool", [
  "subscription",
  "topup",
]);

// Replaces the old TokenBalanceTransaction + all per-feature usage logs.
// `amount` is signed minor units (negative = debit). Usage debits snapshot the
// full pricing inputs (usdCost, fxRate, markup) so any charge is reproducible.
export const transaction = pgTable(
  "Transaction",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    type: transactionTypeEnum("type").notNull(),
    currencyCode: varchar("currency_code", { length: 3 })
      .notNull()
      .references(() => currency.code),
    pool: balancePoolEnum("pool").notNull(),

    amount: bigint("amount", { mode: "number" }).notNull(),
    subscriptionBalanceAfter: bigint("subscription_balance_after", {
      mode: "number",
    }).notNull(),
    topupBalanceAfter: bigint("topup_balance_after", {
      mode: "number",
    }).notNull(),

    // Usage-debit pricing snapshot (nullable for credits)
    usdCost: decimal("usd_cost", { precision: 18, scale: 10 }),
    fxRate: decimal("fx_rate", { precision: 18, scale: 8 }),
    markup: decimal("markup", { precision: 6, scale: 4 }),
    modelId: varchar("model_id", { length: 128 }),

    chatId: uuid("chat_id").references(() => chat.id, { onDelete: "set null" }),
    messageId: uuid("message_id").references(() => message.id, {
      onDelete: "set null",
    }),

    referenceType: varchar("reference_type", { length: 32 }),
    referenceId: varchar("reference_id", { length: 128 }),
    description: text("description"),
    metadata: jsonb("metadata").$type<{
      subscriptionCode?: string;
      subscriptionId?: string;
      paymentIntentId?: string;
      refundOf?: string;
      previousSubscriptionAmount?: number;
      previousTopupAmount?: number;
    }>(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("transaction_user_id_idx").on(table.userId),
    userCreatedIdx: index("transaction_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
    typeIdx: index("transaction_type_idx").on(table.type),
    referenceIdx: index("transaction_reference_idx").on(
      table.referenceType,
      table.referenceId
    ),
  })
);

export type Transaction = InferSelectModel<typeof transaction>;

// Cancellation feedback — product analytics, retained from the old schema.
export const cancellationFeedback = pgTable(
  "CancellationFeedback",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subscriptionId: uuid("subscription_id").references(
      () => userSubscription.id,
      { onDelete: "set null" }
    ),

    reasons: jsonb("reasons").$type<string[]>().notNull(),
    additionalFeedback: text("additional_feedback"),

    subscriptionCode: varchar("subscription_code", { length: 64 }),
    billingPeriod: billingPeriodEnum("billing_period"),
    subscriptionDurationDays: integer("subscription_duration_days"),
    wasTrial: boolean("was_trial").default(false).notNull(),

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

// ============================================================================
// PROJECT (unchanged)
// ============================================================================

export const project = pgTable(
  "Project",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    description: varchar("description", { length: 280 }),
    swatch: varchar("swatch", { length: 16 }),
    contextEntries: jsonb("context_entries").$type<string[]>().notNull(),
    isDefault: boolean("is_default").default(false).notNull(),
    pinned: boolean("pinned").default(false).notNull(),
    usageCount: integer("usage_count").default(0).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("project_user_id_idx").on(table.userId),
  })
);

export type Project = InferSelectModel<typeof project>;

export const projectFile = pgTable(
  "ProjectFile",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 256 }).notNull(),
    size: integer("size").notNull(),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    blobUrl: text("blob_url").notNull(),
    pathname: text("pathname").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    projectIdIdx: index("project_file_project_id_idx").on(table.projectId),
  })
);

export type ProjectFile = InferSelectModel<typeof projectFile>;
