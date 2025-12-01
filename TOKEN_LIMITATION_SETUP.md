# Token Limitation System - Setup Guide

This document describes the token limitation system implementation for your AI chat application with subscription-based token quotas.

## Overview

The system implements:
- **Multiple billing periods**: Daily (tester), Weekly, Monthly, Quarterly, and Annual subscriptions
- **Billing period count**: Support for multi-period subscriptions (e.g., 3 months for quarterly)
- **Token-based quota enforcement**: Track and limit AI token usage per user
- **Flexible subscription tiers**: Tester, Basic Monthly, Basic Quarterly, Basic Annual plans
- **Automatic period resets**: Daily quota resets for testers, period-based for paid users
- **Usage analytics**: Detailed per-model token tracking and cost calculation
- **Real-time enforcement**: Quota checks before each API call

## Architecture Components

### Database Tables

1. **SubscriptionPlan** - Defines available subscription tiers
2. **UserSubscription** - Tracks each user's current subscription
3. **TokenUsageLog** - Detailed log of every API call
4. **UserTokenUsage** - Aggregated usage for fast quota checks
5. **User** (updated) - Added `currentPlan`, `createdAt`, `updatedAt` fields

### Core Services

- `lib/ai/subscription-tiers.ts` - Plan configurations
- `lib/ai/billing-periods.ts` - Period calculation utilities
- `lib/ai/token-quota.ts` - Quota checking and usage recording
- `lib/ai/subscription-init.ts` - User subscription management

### API Endpoints

- `GET /api/usage` - Get user's usage statistics
- `GET /api/subscription` - Get current subscription details
- `POST /api/subscription` - Upgrade/change subscription
- `GET /api/cron/reset-quotas` - Reset expired billing periods (called by Vercel Cron)

## Setup Instructions

### 1. Database Migration

Run the database migration to create the new tables:

```bash
npm run db:migrate
```

This applies migration `0008_redundant_iceman.sql` which creates:
- `billing_period` enum type
- `SubscriptionPlan` table
- `UserSubscription` table
- `TokenUsageLog` table
- `UserTokenUsage` table
- Updates to `User` table

### 2. Seed Subscription Plans

Populate the database with the predefined subscription tiers:

```bash
npx tsx scripts/seed-plans.ts
```

This creates the following plans:

| Plan | Billing Period | Period Count | Token Quota | Price | Features |
|------|---------------|--------------|-------------|-------|----------|
| Tester | Daily | 1 | 100,000 | $0 | Limited models, testing only |
| Tester Paid | Daily | 1 | 100,000 | $0.05 | Daily paid testing |
| Basic Monthly | Monthly | 1 | 2,000,000 | $19.99 | Basic models |
| Basic Quarterly | Monthly | 3 | 6,000,000 | $49.99 | 3-month plan, priority support |
| Basic Annual | Annual | 1 | 24,000,000 | $179.99 | All models, priority support |

### 3. Environment Variables

Add the following environment variable to your `.env.local` file:

```bash
# Cron Secret for quota reset endpoint (generate a random string)
CRON_SECRET=your-random-secret-here
```

Generate a secure random string:
```bash
openssl rand -base64 32
```

### 4. Vercel Cron Configuration

The `vercel.json` file has been created with the following cron job:

```json
{
  "crons": [
    {
      "path": "/api/cron/reset-quotas",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

This runs every 6 hours to catch daily tester plan resets and renew expired periods.

**Important**: When deploying to Vercel, make sure to:
1. Add `CRON_SECRET` to your Vercel environment variables
2. Cron jobs automatically work on Vercel - no additional configuration needed

### 5. User Registration Flow

New users automatically get assigned the **Tester Plan** upon registration:

```typescript
// app/(auth)/actions.ts
const newUser = await createUser(email, password);
await assignTesterPlan(newUser.id);  // Automatic
```

## Subscription Tiers Configuration

Edit `lib/subscription/subscription-tiers.ts` to customize plans:

```typescript
export const SUBSCRIPTION_TIERS = {
  tester: {
    name: "tester",
    displayName: { en: "Tester Plan", ru: "Тестовый план" },
    billingPeriod: "daily",
    billingPeriodCount: 1,  // Number of periods per billing cycle
    tokenQuota: 100_000,
    features: {
      maxMessagesPerPeriod: 50,
      allowedModels: ["gpt-5.1-instant", "gemini-3-pro"],
      hasReasoningModels: true,
      // ... more features
    },
    price: { USD: 0, RUB: 0 },
    isTesterPlan: true,
  },
  basic_quarter: {
    name: "basic_quarter",
    displayName: { en: "Basic Quarterly Plan", ru: "Стандарт в квартал" },
    billingPeriod: "monthly",
    billingPeriodCount: 3,  // 3 months = quarterly
    tokenQuota: 6_000_000,
    // ...
  },
  // ... other plans
};
```

The `billingPeriodCount` field allows you to create multi-period subscriptions:
- `billingPeriod: "monthly"` + `billingPeriodCount: 3` = Quarterly subscription
- `billingPeriod: "daily"` + `billingPeriodCount: 7` = Weekly subscription (alternative)

After modifying tiers, re-run the seed script:
```bash
npx tsx scripts/seed-plans.ts
```

## How It Works

### 1. Token Quota Check (Before API Call)

```typescript
// app/(chat)/api/chat/route.ts
const quotaCheck = await checkTokenQuota(session.user.id);

if (!quotaCheck.allowed) {
  return new Response(JSON.stringify({
    error: "quota_exceeded",
    message: quotaCheck.reason,
    quota: quotaCheck.quotaInfo,
  }), { status: 429 });
}
```

### 2. Token Usage Recording (After API Call)

```typescript
// After AI response completes
await recordTokenUsage({
  userId: session.user.id,
  chatId: id,
  messageId: assistantMessageId,
  usage: finalMergedUsage,  // From TokenLens
});
```

### 3. Automatic Period Renewal

When a user's billing period expires:
- Cron job calls `/api/cron/reset-quotas`
- System checks all subscriptions with `currentPeriodEnd <= now`
- Automatically renews periods based on billing type:
  - Daily → +1 day
  - Weekly → +7 days
  - Monthly → +1 month
  - Annual → +1 year
- Previous period's usage is archived in `TokenUsageLog`
- New aggregate record created in `UserTokenUsage`

### 4. Usage Tracking

**Real-time aggregation:**
- `TokenUsageLog` stores every API call with full details
- `UserTokenUsage` maintains running totals for the current period
- Per-model breakdown tracked in JSONB field

**Query optimization:**
- Quota checks use `UserTokenUsage` (fast single row lookup)
- Analytics use `TokenUsageLog` (detailed historical data)
- Indexes on `userId`, `periodStart`, `periodEnd` for fast queries

## API Usage Examples

### Get Current Usage

```bash
curl -X GET http://localhost:3000/api/usage \
  -H "Cookie: authjs.session-token=YOUR_TOKEN"
```

Response:
```json
{
  "subscription": {
    "plan": "tester",
    "displayName": "Tester Plan",
    "periodStart": "2025-11-01T00:00:00Z",
    "periodEnd": "2025-11-02T00:00:00Z",
    "billingPeriod": "daily"
  },
  "quota": {
    "total": 50000,
    "used": 12500,
    "remaining": 37500,
    "percentUsed": "25.00"
  },
  "usage": {
    "totalInputTokens": 8000,
    "totalOutputTokens": 4500,
    "totalCost": "0.0125",
    "totalRequests": 15,
    "modelBreakdown": {
      "gpt-5-mini": {
        "inputTokens": 8000,
        "outputTokens": 4500,
        "totalTokens": 12500,
        "cost": 0.0125,
        "requestCount": 15
      }
    }
  },
  "recentActivity": [...]
}
```

### Upgrade Subscription

```bash
curl -X POST http://localhost:3000/api/subscription \
  -H "Cookie: authjs.session-token=YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"planName": "pro_monthly"}'
```

### Manually Trigger Quota Reset

```bash
curl -X GET http://localhost:3000/api/cron/reset-quotas \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Monitoring & Analytics

### Check User's Quota Status

```typescript
import { getUserQuotaInfo } from '@/lib/ai/token-quota';

const quotaInfo = await getUserQuotaInfo(userId);
console.log({
  plan: quotaInfo.plan.displayName,
  quota: quotaInfo.quota,
  used: quotaInfo.usage.totalTokens,
  remaining: quotaInfo.remaining,
  percentUsed: quotaInfo.percentUsed,
  isExceeded: quotaInfo.isExceeded,
});
```

### Query Usage Logs

```typescript
import { db } from '@/lib/db/queries';
import { tokenUsageLog } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

// Get recent usage for a user
const logs = await db
  .select()
  .from(tokenUsageLog)
  .where(eq(tokenUsageLog.userId, userId))
  .orderBy(desc(tokenUsageLog.createdAt))
  .limit(100);
```

## Integration with Payment Providers

The system is designed to integrate with payment providers (Stripe, Paddle, etc.):

1. **Payment Flow:**
   - User selects a plan on your pricing page
   - Redirect to payment provider
   - On successful payment, payment provider webhook calls your API
   - Your API calls `upgradeToPlan(userId, planName)`

2. **Webhook Handler Example:**

```typescript
// app/api/webhooks/stripe/route.ts
import { upgradeToPlan } from '@/lib/ai/subscription-init';

export async function POST(request: Request) {
  // Verify Stripe signature
  const event = await stripe.webhooks.constructEvent(...);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.userId;
    const planName = session.metadata.planName;

    // Activate subscription
    await upgradeToPlan(userId, planName);

    // Store external subscription ID
    await db.update(userSubscription)
      .set({
        externalSubscriptionId: session.subscription,
        externalCustomerId: session.customer,
      })
      .where(eq(userSubscription.userId, userId));
  }

  return new Response('OK');
}
```

3. **Subscription Fields for Payments:**
   - `externalSubscriptionId` - Stripe/Paddle subscription ID
   - `externalCustomerId` - Customer ID from payment provider
   - `lastPaymentDate` - Last successful payment
   - `lastPaymentAmount` - Amount charged
   - `cancelAtPeriodEnd` - Flag for cancellation

## Testing

### 1. Test Tester Plan Assignment

Register a new user and verify they get the tester plan:

```bash
# Register via UI or API
# Check database
psql $POSTGRES_URL -c "SELECT u.email, u.current_plan, s.billing_period, p.display_name
FROM \"User\" u
JOIN \"UserSubscription\" s ON s.user_id = u.id
JOIN \"SubscriptionPlan\" p ON p.id = s.plan_id;"
```

### 2. Test Quota Enforcement

```bash
# Make API calls until quota is exceeded
# Should receive 429 error with quota details
```

### 3. Test Period Reset

```bash
# Manually trigger cron
curl -X GET http://localhost:3000/api/cron/reset-quotas \
  -H "Authorization: Bearer $CRON_SECRET"

# Check that currentPeriodStart and currentPeriodEnd were updated
```

### 4. Test Usage Tracking

```bash
# Make a few chat requests
# Check TokenUsageLog table
psql $POSTGRES_URL -c "SELECT model_id, input_tokens, output_tokens, total_tokens, total_cost
FROM \"TokenUsageLog\"
ORDER BY created_at DESC
LIMIT 10;"
```

## Troubleshooting

### Issue: "No active subscription found"

**Cause:** User doesn't have a UserSubscription record

**Fix:**
```typescript
import { assignTesterPlan } from '@/lib/ai/subscription-init';
await assignTesterPlan(userId);
```

### Issue: Quota not resetting

**Cause:** Cron job not running or CRON_SECRET not set

**Fix:**
1. Verify `CRON_SECRET` is set in environment
2. Check Vercel cron logs
3. Manually trigger: `curl http://your-domain.com/api/cron/reset-quotas -H "Authorization: Bearer $CRON_SECRET"`

### Issue: Usage not being recorded

**Cause:** `recordTokenUsage` failing silently

**Fix:**
1. Check server logs for errors
2. Verify TokenLens is enriching usage data
3. Check that `finalMergedUsage` has `modelId` field

### Issue: Migration fails

**Cause:** Database connection issue or missing POSTGRES_URL

**Fix:**
1. Verify `.env.local` has `POSTGRES_URL`
2. Check database is accessible
3. Run `npm run db:migrate` again

## Next Steps

### Frontend Integration

Create UI components to display usage:

1. **Usage Dashboard** (`components/usage-dashboard.tsx`)
   - Progress bar showing quota usage
   - Current period dates
   - Model-by-model breakdown chart

2. **Subscription Management** (`components/subscription-settings.tsx`)
   - Current plan display
   - Upgrade buttons
   - Billing history

3. **Quota Warning** (`components/quota-warning.tsx`)
   - Show warning at 80% usage
   - Block UI when quota exceeded
   - Link to upgrade page

### Example Usage Component:

```typescript
'use client';

import { useEffect, useState } from 'react';

export function UsageWidget() {
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    fetch('/api/usage')
      .then(res => res.json())
      .then(setUsage);
  }, []);

  if (!usage) return <div>Loading...</div>;

  const { quota } = usage;
  const percentUsed = parseFloat(quota.percentUsed);

  return (
    <div className="usage-widget">
      <h3>Token Usage</h3>
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${percentUsed}%` }}
        />
      </div>
      <p>
        {quota.used.toLocaleString()} / {quota.total.toLocaleString()} tokens
      </p>
      <p>
        {quota.remaining.toLocaleString()} remaining
      </p>
    </div>
  );
}
```

## Database Schema Reference

```sql
-- Billing Period Enum
CREATE TYPE billing_period AS ENUM('daily', 'weekly', 'monthly', 'annual');

-- Subscription Plans
CREATE TABLE "SubscriptionPlan" (
  id uuid PRIMARY KEY,
  name varchar(64) NOT NULL UNIQUE,
  display_name varchar(128),
  billing_period billing_period NOT NULL DEFAULT 'monthly',
  billing_period_count integer NOT NULL DEFAULT 1,  -- Number of periods per billing cycle
  token_quota bigint NOT NULL,
  features jsonb,
  price numeric(10, 2),
  is_active boolean DEFAULT true,
  is_tester_plan boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- User Subscriptions
CREATE TABLE "UserSubscription" (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES "SubscriptionPlan"(id),
  billing_period billing_period NOT NULL,
  billing_period_count integer NOT NULL DEFAULT 1,  -- Locked at subscription time
  current_period_start timestamp NOT NULL,
  current_period_end timestamp NOT NULL,
  next_billing_date timestamp NOT NULL,
  status varchar(32) DEFAULT 'active',
  external_subscription_id varchar(128),
  external_customer_id varchar(128),
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

-- Token Usage Log (detailed)
CREATE TABLE "TokenUsageLog" (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  subscription_id uuid REFERENCES "UserSubscription"(id) ON DELETE SET NULL,
  chat_id uuid REFERENCES "Chat"(id) ON DELETE SET NULL,
  message_id uuid REFERENCES "Message_v2"(id) ON DELETE SET NULL,
  model_id varchar(128) NOT NULL,
  input_tokens integer DEFAULT 0,
  output_tokens integer DEFAULT 0,
  total_tokens integer DEFAULT 0,
  cache_write_tokens integer DEFAULT 0,
  cache_read_tokens integer DEFAULT 0,
  input_cost numeric(12, 8),
  output_cost numeric(12, 8),
  total_cost numeric(12, 8),
  billing_period_type billing_period NOT NULL,
  billing_period_start timestamp NOT NULL,
  billing_period_end timestamp NOT NULL,
  created_at timestamp DEFAULT now()
);

-- User Token Usage (aggregated)
CREATE TABLE "UserTokenUsage" (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES "UserSubscription"(id) ON DELETE CASCADE,
  billing_period_type billing_period NOT NULL,
  period_start timestamp NOT NULL,
  period_end timestamp NOT NULL,
  total_input_tokens bigint DEFAULT 0,
  total_output_tokens bigint DEFAULT 0,
  total_tokens bigint DEFAULT 0,
  model_breakdown jsonb,
  total_cost numeric(12, 4),
  total_requests integer DEFAULT 0,
  last_updated_at timestamp DEFAULT now(),
  UNIQUE(user_id, period_start, period_end)
);
```

## Support

For issues or questions:
1. Check this documentation
2. Review server logs for error details
3. Verify database state with SQL queries
4. Test API endpoints directly with curl

## License

This implementation is part of your AI chatbot application.
