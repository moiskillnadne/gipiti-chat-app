import { requireAuth } from "@/server/api/_kit/middleware";
import { decodeCursor, encodeCursor } from "@/server/api/_kit/pagination";
import { toChatDto } from "@/server/api/v1/_mappers/chat";
import { v1 } from "@/server/api/v1/implementer";
import { deleteAllChatsForUser } from "@/server/modules/chat/delete-all-chats";
import { deleteChatForUser } from "@/server/modules/chat/delete-chat";
import { getChat } from "@/server/modules/chat/get-chat";
import { listChatVotes } from "@/server/modules/chat/list-chat-votes";
import { listChats } from "@/server/modules/chat/list-chats";
import { removeMessagesFrom } from "@/server/modules/chat/remove-messages-from";
import { setMessageVote } from "@/server/modules/chat/set-message-vote";

export const chatsRouter = {
  list: v1.chats.list
    .use(requireAuth)
    .handler(async ({ input, context, errors }) => {
      const decoded =
        input.cursor === undefined ? null : decodeCursor(input.cursor);
      if (decoded?.status === "invalid") {
        throw errors.BAD_REQUEST({ data: { reason: "invalid_cursor" } });
      }

      const page = await listChats({
        userId: context.principal.userId,
        limit: input.limit,
        after: decoded?.position ?? null,
      });
      const lastChat = page.chats.at(-1);

      return {
        items: page.chats.map(toChatDto),
        nextCursor:
          page.hasMore && lastChat
            ? encodeCursor({
                createdAt: lastChat.createdAtText,
                id: lastChat.id,
              })
            : null,
      };
    }),

  get: v1.chats.get
    .use(requireAuth)
    .handler(async ({ input, context, errors }) => {
      const result = await getChat({
        userId: context.principal.userId,
        chatId: input.chatId,
      });

      switch (result.status) {
        case "ok":
          return toChatDto(result.chat);
        case "chat_not_found":
          throw errors.NOT_FOUND();
        default: {
          const unhandled: never = result;
          throw new Error(`Unhandled result: ${JSON.stringify(unhandled)}`);
        }
      }
    }),

  remove: v1.chats.remove
    .use(requireAuth)
    .handler(async ({ input, context, errors }) => {
      const result = await deleteChatForUser({
        userId: context.principal.userId,
        chatId: input.chatId,
      });

      switch (result.status) {
        case "deleted":
          return;
        case "chat_not_found":
          throw errors.NOT_FOUND();
        default: {
          const unhandled: never = result;
          throw new Error(`Unhandled result: ${JSON.stringify(unhandled)}`);
        }
      }
    }),

  removeAll: v1.chats.removeAll
    .use(requireAuth)
    .handler(async ({ context }) => {
      // `confirm=true` was checked by the input schema.
      await deleteAllChatsForUser({ userId: context.principal.userId });
    }),

  votes: {
    list: v1.chats.votes.list
      .use(requireAuth)
      .handler(async ({ input, context, errors }) => {
        const result = await listChatVotes({
          userId: context.principal.userId,
          chatId: input.chatId,
        });

        switch (result.status) {
          case "ok":
            return { items: result.votes };
          case "chat_not_found":
            throw errors.NOT_FOUND();
          default: {
            const unhandled: never = result;
            throw new Error(`Unhandled result: ${JSON.stringify(unhandled)}`);
          }
        }
      }),

    set: v1.chats.votes.set
      .use(requireAuth)
      .handler(async ({ input, context, errors }) => {
        const result = await setMessageVote({
          userId: context.principal.userId,
          chatId: input.chatId,
          messageId: input.messageId,
          isUpvoted: input.isUpvoted,
        });

        switch (result.status) {
          case "voted":
            return;
          // One answer for a missing chat, another user's chat and a message
          // that is not in the chat.
          case "chat_not_found":
          case "message_not_found":
            throw errors.NOT_FOUND();
          default: {
            const unhandled: never = result;
            throw new Error(`Unhandled result: ${JSON.stringify(unhandled)}`);
          }
        }
      }),
  },

  messages: {
    removeFrom: v1.chats.messages.removeFrom
      .use(requireAuth)
      .handler(async ({ input, context, errors }) => {
        const result = await removeMessagesFrom({
          userId: context.principal.userId,
          chatId: input.params.chatId,
          messageId: input.query.fromMessageId,
        });

        switch (result.status) {
          case "removed":
            return;
          case "chat_not_found":
            throw errors.NOT_FOUND();
          default: {
            const unhandled: never = result;
            throw new Error(`Unhandled result: ${JSON.stringify(unhandled)}`);
          }
        }
      }),
  },
};
