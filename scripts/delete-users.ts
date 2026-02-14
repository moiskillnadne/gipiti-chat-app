import * as readline from "node:readline";
import { config } from "dotenv";
import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  chat,
  document,
  message,
  stream,
  suggestion,
  user,
  vote,
} from "@/lib/db/schema";

config({
  path: ".env.local",
});

const isForceMode = process.argv.includes("--force");
const emails = process.argv.slice(2).filter((arg) => arg !== "--force");

async function promptConfirmation(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

async function deleteUserByEmail(
  db: ReturnType<typeof drizzle>,
  email: string
): Promise<{ success: boolean; error?: string }> {
  const users = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.email, email))
    .limit(1);

  const targetUser = users.at(0);

  if (!targetUser) {
    return { success: false, error: `User not found: ${email}` };
  }

  console.log(`  User: ${targetUser.email} (${targetUser.id})`);

  // Delete in FK-safe order within a transaction
  await db.transaction(async (tx) => {
    // 1. Get all chat IDs for this user
    const userChats = await tx
      .select({ id: chat.id })
      .from(chat)
      .where(eq(chat.userId, targetUser.id));

    const chatIds = userChats.map((c) => c.id);

    if (chatIds.length > 0) {
      // 2. Delete votes (FK on chatId + messageId)
      await tx.delete(vote).where(inArray(vote.chatId, chatIds));
      // 3. Delete messages (FK on chatId)
      await tx.delete(message).where(inArray(message.chatId, chatIds));
      // 4. Delete streams (FK on chatId)
      await tx.delete(stream).where(inArray(stream.chatId, chatIds));
      // 5. Delete chats (FK on userId)
      await tx.delete(chat).where(eq(chat.userId, targetUser.id));
    }

    // 6. Delete suggestions (FK on userId + document composite FK)
    await tx.delete(suggestion).where(eq(suggestion.userId, targetUser.id));
    // 7. Delete documents (FK on userId)
    await tx.delete(document).where(eq(document.userId, targetUser.id));

    // 8. Delete user row (cascades: userSubscription, userTokenUsage,
    //    paymentIntent, tokenUsageLog, searchUsageLog, imageGenerationUsageLog,
    //    textStyle, project, cancellationFeedback, tokenBalanceTransaction)
    await tx.delete(user).where(eq(user.id, targetUser.id));
  });

  return { success: true };
}

async function main() {
  if (emails.length === 0) {
    console.error(
      "Usage: tsx scripts/delete-users.ts [--force] user1@example.com user2@example.com"
    );
    process.exit(1);
  }

  console.log(`\nUsers to delete (${emails.length}):`);
  for (const email of emails) {
    console.log(`  - ${email}`);
  }
  console.log();

  if (!isForceMode) {
    const confirmed = await promptConfirmation(
      "This will permanently delete these users and all their data. Continue? (y/N): "
    );

    if (!confirmed) {
      console.log("Aborted.");
      process.exit(0);
    }
  }

  // biome-ignore lint: Forbidden non-null assertion.
  const client = postgres(process.env.POSTGRES_URL!);
  const db = drizzle(client);

  let deleted = 0;
  let failed = 0;

  for (const email of emails) {
    try {
      console.log(`\nDeleting user: ${email}`);
      const result = await deleteUserByEmail(db, email);

      if (result.success) {
        deleted++;
        console.log("  Done.");
      } else {
        failed++;
        console.error(`  Skipped: ${result.error}`);
      }
    } catch (error) {
      failed++;
      console.error(`  Failed to delete user ${email}:`, error);
    }
  }

  console.log("\nDeletion complete:");
  console.log(`  Total: ${emails.length}`);
  console.log(`  Deleted: ${deleted}`);
  console.log(`  Failed/Skipped: ${failed}`);

  await client.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
