import { oc } from "@orpc/contract";

import { callerAccess } from "@/server/api/_kit/caller-access";
import {
  badRequestError,
  forbiddenError,
  notFoundError,
  unauthorizedError,
} from "@/server/api/_kit/common-errors";
import {
  chatIdInputSchema,
  chatListInputSchema,
  chatListSchema,
  chatSchema,
  chatVoteListSchema,
  deleteAllChatsInputSchema,
  removeMessagesFromInputSchema,
  setMessageVoteInputSchema,
} from "@/server/api/v1/_schemas/chat";
import { chatListBadRequestWithReason } from "@/server/api/v1/_schemas/chat-errors";

const CHATS_TAGS = ["chats"];

const OWNERSHIP_NOTE =
  "404 when there is no such chat, which is also the answer for a chat of another account.";

export const chatsContract = {
  list: oc
    .errors({ ...unauthorizedError, ...chatListBadRequestWithReason })
    .route({
      method: "GET",
      path: "/chats",
      spec: callerAccess("required"),
      summary: "The user's chats, newest first",
      description:
        "One page of the caller's chats, newest first. Pass the `nextCursor` of a page as `cursor` to get the next one; `nextCursor` is `null` on the last page. Needs an access token or a browser session. 400 `invalid_cursor` when `cursor` is not one this API gave out.",
      tags: CHATS_TAGS,
    })
    .input(chatListInputSchema)
    .output(chatListSchema),

  get: oc
    .errors({ ...unauthorizedError, ...notFoundError })
    .route({
      method: "GET",
      path: "/chats/{chatId}",
      spec: callerAccess("required"),
      summary: "One chat",
      description: `Needs an access token or a browser session. ${OWNERSHIP_NOTE}`,
      tags: CHATS_TAGS,
    })
    .input(chatIdInputSchema)
    .output(chatSchema),

  remove: oc
    .errors({ ...unauthorizedError, ...forbiddenError, ...notFoundError })
    .route({
      method: "DELETE",
      path: "/chats/{chatId}",
      spec: callerAccess("required"),
      successStatus: 204,
      summary: "Delete a chat",
      description: `Deletes the chat with its messages, votes and streams, in one step: either all of it goes or none. ${OWNERSHIP_NOTE}`,
      tags: CHATS_TAGS,
    })
    .input(chatIdInputSchema),

  removeAll: oc
    .errors({ ...unauthorizedError, ...forbiddenError, ...badRequestError })
    .route({
      method: "DELETE",
      path: "/chats",
      spec: callerAccess("required"),
      inputStructure: "detailed",
      successStatus: 204,
      summary: "Delete every chat of the user",
      description:
        "Deletes all the caller's chats with their messages, votes and streams, in one step. Answers 204 also when there are none. Needs `confirm=true` in the query: without it, or with any other value, 400.",
      tags: CHATS_TAGS,
    })
    .input(deleteAllChatsInputSchema),

  votes: {
    list: oc
      .errors({ ...unauthorizedError, ...notFoundError })
      .route({
        method: "GET",
        path: "/chats/{chatId}/votes",
        spec: callerAccess("required"),
        summary: "The votes on the messages of a chat",
        description: `One entry per voted message, as one list. ${OWNERSHIP_NOTE}`,
        tags: CHATS_TAGS,
      })
      .input(chatIdInputSchema)
      .output(chatVoteListSchema),

    set: oc
      .errors({ ...unauthorizedError, ...forbiddenError, ...notFoundError })
      .route({
        method: "PUT",
        path: "/chats/{chatId}/messages/{messageId}/vote",
        spec: callerAccess("required"),
        successStatus: 204,
        summary: "Vote on a message",
        description: `Sets the vote, replacing an earlier one. Safe to repeat. 404 when there is no such chat (or it is another account's), and the same 404 when the message does not exist or is not in that chat.`,
        tags: CHATS_TAGS,
      })
      .input(setMessageVoteInputSchema),
  },

  messages: {
    removeFrom: oc
      .errors({ ...unauthorizedError, ...forbiddenError, ...notFoundError })
      .route({
        method: "DELETE",
        path: "/chats/{chatId}/messages",
        spec: callerAccess("required"),
        inputStructure: "detailed",
        successStatus: 204,
        summary: "Delete a message and every later one",
        description: `Used when the user edits a message: the message \`fromMessageId\` and all later messages of the chat go, with their votes, in one step. Answers 204 and deletes nothing when the message does not exist or is not in this chat. ${OWNERSHIP_NOTE}`,
        tags: CHATS_TAGS,
      })
      .input(removeMessagesFromInputSchema),
  },
};
