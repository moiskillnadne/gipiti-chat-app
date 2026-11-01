import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readInputDraft, writeInputDraft } from "../input-draft";

const CHAT_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_CHAT_ID = "55555555-5555-4555-8555-555555555555";

/** Minimal in-memory `Storage` for the node test environment. */
function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => {
      entries.delete(key);
    },
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

let storage: Storage;

beforeEach(() => {
  storage = createMemoryStorage();
  vi.stubGlobal("window", { sessionStorage: storage });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("writeInputDraft / readInputDraft", () => {
  it("restores a saved draft for the same chat", () => {
    writeInputDraft(CHAT_ID, "Привет, мир");

    expect(readInputDraft(CHAT_ID)).toBe("Привет, мир");
  });

  it("keeps drafts of different chats apart", () => {
    writeInputDraft(CHAT_ID, "first");

    expect(readInputDraft(OTHER_CHAT_ID)).toBe("");
  });

  it("removes the entry when the draft is cleared", () => {
    writeInputDraft(CHAT_ID, "draft");

    writeInputDraft(CHAT_ID, "");

    expect(storage.getItem(`input-${CHAT_ID}`)).toBeNull();
    expect(readInputDraft(CHAT_ID)).toBe("");
  });

  it("reads drafts saved in the JSON format of useSessionStorage", () => {
    storage.setItem(`input-${CHAT_ID}`, JSON.stringify("old draft"));

    expect(readInputDraft(CHAT_ID)).toBe("old draft");
  });

  it("ignores a value that is not a JSON string", () => {
    storage.setItem(`input-${CHAT_ID}`, "not json");

    expect(readInputDraft(CHAT_ID)).toBe("");
  });

  it("does not throw when storage rejects the write", () => {
    vi.spyOn(storage, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });

    expect(() => writeInputDraft(CHAT_ID, "draft")).not.toThrow();
  });

  it("returns an empty draft when storage access throws", () => {
    vi.stubGlobal("window", {
      get sessionStorage(): Storage {
        throw new DOMException("blocked", "SecurityError");
      },
    });

    expect(readInputDraft(CHAT_ID)).toBe("");
    expect(() => writeInputDraft(CHAT_ID, "draft")).not.toThrow();
  });

  it("returns an empty draft during server rendering", () => {
    vi.unstubAllGlobals();

    expect(readInputDraft(CHAT_ID)).toBe("");
  });
});
