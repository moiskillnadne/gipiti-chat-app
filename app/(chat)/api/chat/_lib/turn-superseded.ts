type UserMessageRef = { id: string; createdAt: Date };

/**
 * True when the user message a turn answered is no longer the chat's latest
 * user message as stored by that turn: it was deleted (edit), re-saved with a
 * new timestamp (edit re-sends the same id) or followed by a newer one. The
 * answer of such a turn must not be persisted: after a reload it would appear
 * in the wrong place of the edited conversation.
 */
export function isTurnSuperseded(
  turnMessage: UserMessageRef,
  latestUserMessage: UserMessageRef | undefined
): boolean {
  return (
    latestUserMessage === undefined ||
    latestUserMessage.id !== turnMessage.id ||
    latestUserMessage.createdAt.getTime() !== turnMessage.createdAt.getTime()
  );
}
