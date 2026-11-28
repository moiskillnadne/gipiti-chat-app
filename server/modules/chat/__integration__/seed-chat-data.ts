/**
 * Seeding and inspection helpers for the chat integration tests. Timestamps
 * are written as text, so a test can use microseconds, which a JavaScript
 * `Date` cannot hold.
 */
import { randomUUID } from "node:crypto";

import { eq, inArray, sql } from "drizzle-orm";

import { db } from "@/server/db/connection";
import { chat, message, stream, user, vote } from "@/server/db/schema";

export const seedUser = async (): Promise<string> => {
  const [row] = await db
    .insert(user)
    .values({ email: `chat-it-${randomUUID()}@example.test` })
    .returning({ id: user.id });

  return row.id;
};

/** Deleting users cascades to their chats and everything on them. */
export const deleteUsers = async (userIds: string[]): Promise<void> => {
  if (userIds.length > 0) {
    await db.delete(user).where(inArray(user.id, userIds));
  }
};

export const seedChat = async ({
  userId,
  createdAt,
  title = "Chat",
  id = randomUUID(),
}: {
  userId: string;
  /** `YYYY-MM-DD HH:MM:SS[.ffffff]`, read by Postgres as a `timestamp`. */
  createdAt: string;
  title?: string;
  id?: string;
}): Promise<string> => {
  await db.execute(
    sql`INSERT INTO "Chat" ("id", "createdAt", "title", "userId")
        VALUES (${id}::uuid, ${createdAt}::timestamp, ${title}, ${userId}::uuid)`
  );

  return id;
};

export const seedMessage = async ({
  chatId,
  createdAt,
  role = "user",
  id = randomUUID(),
}: {
  chatId: string;
  createdAt: string;
  role?: string;
  id?: string;
}): Promise<string> => {
  await db.execute(
    sql`INSERT INTO "Message_v2" ("id", "chatId", "role", "parts", "attachments", "createdAt")
        VALUES (${id}::uuid, ${chatId}::uuid, ${role}, '[]'::json, '[]'::json, ${createdAt}::timestamp)`
  );

  return id;
};

export const seedVote = async ({
  chatId,
  messageId,
  isUpvoted = true,
}: {
  chatId: string;
  messageId: string;
  isUpvoted?: boolean;
}): Promise<void> => {
  await db.insert(vote).values({ chatId, messageId, isUpvoted });
};

export const seedStream = async (chatId: string): Promise<void> => {
  await db.insert(stream).values({ chatId, createdAt: new Date() });
};

export type ChatFootprint = {
  chats: number;
  messages: number;
  votes: number;
  streams: number;
};

/** How many rows of each table hang on these chats. */
export const readFootprint = async (
  chatIds: string[]
): Promise<ChatFootprint> => {
  const [chats, messages, votes, streams] = await Promise.all([
    db.select({ id: chat.id }).from(chat).where(inArray(chat.id, chatIds)),
    db
      .select({ id: message.id })
      .from(message)
      .where(inArray(message.chatId, chatIds)),
    db
      .select({ id: vote.messageId })
      .from(vote)
      .where(inArray(vote.chatId, chatIds)),
    db
      .select({ id: stream.id })
      .from(stream)
      .where(inArray(stream.chatId, chatIds)),
  ]);

  return {
    chats: chats.length,
    messages: messages.length,
    votes: votes.length,
    streams: streams.length,
  };
};

export const readMessageIds = async (chatId: string): Promise<string[]> => {
  const rows = await db
    .select({ id: message.id })
    .from(message)
    .where(eq(message.chatId, chatId));

  return rows.map(({ id }) => id);
};

export const readVotedMessageIds = async (
  chatId: string
): Promise<string[]> => {
  const rows = await db
    .select({ id: vote.messageId })
    .from(vote)
    .where(eq(vote.chatId, chatId));

  return rows.map(({ id }) => id);
};

/**
 * Makes the database refuse to delete one kind of row, so a test can make a
 * delete fail halfway. Returns the function that removes the trigger; call it
 * before cleaning up, or the cleanup is refused too.
 */
export const refuseDeletesOf = async ({
  table,
  column,
  value,
}: {
  table: "Chat" | "Message_v2";
  column: "title" | "role";
  value: string;
}): Promise<() => Promise<void>> => {
  const triggerName = `it_refuse_delete_${table.toLowerCase().replace(/\W/g, "")}`;
  await db.execute(
    sql.raw(`CREATE OR REPLACE FUNCTION ${triggerName}() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'integration test: delete refused'; END;
      $$ LANGUAGE plpgsql`)
  );
  // A run that was killed leaves its trigger behind.
  await db.execute(
    sql.raw(`DROP TRIGGER IF EXISTS ${triggerName} ON "${table}"`)
  );
  await db.execute(
    sql.raw(`CREATE TRIGGER ${triggerName} BEFORE DELETE ON "${table}"
      FOR EACH ROW WHEN (OLD."${column}" = '${value}')
      EXECUTE FUNCTION ${triggerName}()`)
  );

  return async () => {
    await db.execute(
      sql.raw(`DROP TRIGGER IF EXISTS ${triggerName} ON "${table}"`)
    );
    await db.execute(sql.raw(`DROP FUNCTION IF EXISTS ${triggerName}()`));
  };
};
