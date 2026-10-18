-- Indexes for period analytics and the chat read paths.
--
-- "Message_v2" and "Chat" had no indexes beyond their primary keys, so any
-- query that filters messages by "createdAt", loads a chat's messages by
-- "chatId", or joins Message_v2 -> Chat -> User by "userId" was a sequential
-- scan over the largest table. "Transaction" had no index leading with
-- created_at, so a `type = 'usage_debit' AND created_at BETWEEN ...` filter
-- fell back to the low-selectivity type-only index or a seq scan.
--
-- Built without CONCURRENTLY because the Drizzle migrator wraps every
-- migration in a transaction (CREATE INDEX CONCURRENTLY cannot run inside
-- one). Each statement takes a SHARE lock on its table for the duration of
-- the build: reads continue, writes to that table wait. At today's sizes
-- (~13k messages, ~5k transactions) that is well under a second per index,
-- but apply this migration during low traffic.
CREATE INDEX IF NOT EXISTS "chat_user_created_idx" ON "Chat" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_v2_chat_created_idx" ON "Message_v2" USING btree ("chatId","createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_v2_created_at_idx" ON "Message_v2" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_type_created_idx" ON "Transaction" USING btree ("type","created_at");
