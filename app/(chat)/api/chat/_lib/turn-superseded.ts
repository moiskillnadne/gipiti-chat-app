/**
 * True when the user message a turn answered is gone or was re-saved since the
 * turn stored it: an edit deletes the message (and everything after it) and
 * re-sends it with a new timestamp. The answer of such a turn must not be
 * persisted, after a reload it would appear in the wrong place of the edited
 * conversation.
 *
 * Deliberately only the turn's OWN message is looked at: a newer message sent
 * right after a stop does not make the stopped answer stale (it is stored with
 * the stop time, so it sorts before that message), and a regenerate keeps the
 * stored row (and timestamp) it started from.
 */
export function isTurnSuperseded(
  turnMessageCreatedAt: Date,
  storedMessage: { createdAt: Date } | undefined
): boolean {
  return (
    storedMessage === undefined ||
    storedMessage.createdAt.getTime() !== turnMessageCreatedAt.getTime()
  );
}
