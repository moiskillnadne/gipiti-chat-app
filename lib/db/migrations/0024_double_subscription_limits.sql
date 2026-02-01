-- Double subscription limits for all production plans
-- Token quotas: monthly 1M→2M, quarterly 3M→6M, annual 12M→24M
-- Message limits: monthly 500→1000, quarterly 1500→3000, annual 6000→12000

UPDATE "SubscriptionPlan"
SET
  "token_quota" = 2000000,
  "features" = jsonb_set("features", '{maxMessagesPerPeriod}', '1000'),
  "updated_at" = NOW()
WHERE "name" = 'basic_monthly';--> statement-breakpoint

UPDATE "SubscriptionPlan"
SET
  "token_quota" = 6000000,
  "features" = jsonb_set("features", '{maxMessagesPerPeriod}', '3000'),
  "updated_at" = NOW()
WHERE "name" = 'basic_quarterly';--> statement-breakpoint

UPDATE "SubscriptionPlan"
SET
  "token_quota" = 24000000,
  "features" = jsonb_set("features", '{maxMessagesPerPeriod}', '12000'),
  "updated_at" = NOW()
WHERE "name" = 'basic_annual';
