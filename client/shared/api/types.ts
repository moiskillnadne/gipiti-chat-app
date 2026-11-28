import type { InferContractRouterOutputs } from "@orpc/contract";

import type { v1Contract } from "@/client/shared/api/contract";

/** What each v1 procedure answers with, inferred from the contract. */
export type ApiOutputs = InferContractRouterOutputs<typeof v1Contract>;

/** A prompt of the catalogue as it arrives on the wire. */
export type PromptDto = ApiOutputs["prompts"]["list"]["items"][number];

/** The caller's favourite prompts as they arrive on the wire. */
export type FavoritePromptsDto = ApiOutputs["me"]["favoritePrompts"]["list"];

/** One page of the caller's chats, newest first. */
export type ChatListDto = ApiOutputs["chats"]["list"];

/** A chat of the sidebar history as it arrives on the wire. */
export type ChatDto = ChatListDto["items"][number];

/** The votes of one chat as they arrive on the wire. */
export type ChatVotesDto = ApiOutputs["chats"]["votes"]["list"];

/** The vote on one message as it arrives on the wire. */
export type VoteDto = ChatVotesDto["items"][number];
