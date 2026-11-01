/**
 * Unsent chat-input drafts, kept per chat in sessionStorage.
 *
 * Plain functions on purpose, not a storage hook: a hook such as usehooks-ts
 * `useSessionStorage` also keeps the value in React state and re-reads it on its
 * own `session-storage` event, so mirroring every keystroke into it costs two
 * extra synchronous re-renders. A burst of input events in one task (dictation,
 * text expanders) then exceeds React's nested-update limit and drops characters
 * with error #185. The draft is only needed to restore the input, never to
 * render, so it lives outside React state.
 *
 * Values stay JSON-encoded, the format `useSessionStorage` wrote, so drafts
 * saved before this change still restore.
 */

const draftKey = (chatId: string): string => `input-${chatId}`;

/** The saved draft for `chatId`, or "" when there is none or it is unreadable. */
export function readInputDraft(chatId: string): string {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    const storedValue = window.sessionStorage.getItem(draftKey(chatId));
    if (!storedValue) {
      return "";
    }
    const draft: unknown = JSON.parse(storedValue);
    return typeof draft === "string" ? draft : "";
  } catch {
    // Storage blocked (privacy mode) or a foreign value under our key: a
    // missing draft is harmless.
    return "";
  }
}

/** Saves the draft for `chatId`; an empty draft removes the entry. */
export function writeInputDraft(chatId: string, draft: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (draft) {
      window.sessionStorage.setItem(draftKey(chatId), JSON.stringify(draft));
    } else {
      window.sessionStorage.removeItem(draftKey(chatId));
    }
  } catch {
    // Quota exceeded or storage blocked: losing the draft must not break typing.
  }
}
