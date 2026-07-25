import { describe, expect, it } from "vitest";
import { normalizeEmail } from "../normalize-email";

describe("normalizeEmail", () => {
  it("folds case so one address cannot become two accounts", () => {
    expect(normalizeEmail("User@Mail.RU")).toBe("user@mail.ru");
    expect(normalizeEmail("USER@MAIL.RU")).toBe("user@mail.ru");
  });

  it("trims surrounding whitespace from pasted addresses", () => {
    expect(normalizeEmail("  user@mail.ru\n")).toBe("user@mail.ru");
  });

  it("is idempotent", () => {
    const once = normalizeEmail("  User@Mail.RU  ");

    expect(normalizeEmail(once)).toBe(once);
  });

  it("keeps plus-tags intact", () => {
    // Provider-specific aliasing is deliberately out of scope: collapsing it
    // would reject addresses users treat as their primary one.
    expect(normalizeEmail("Me+Shop@Gmail.com")).toBe("me+shop@gmail.com");
  });

  it("keeps dots in the local part intact", () => {
    expect(normalizeEmail("First.Last@Gmail.com")).toBe("first.last@gmail.com");
  });

  it("keeps genuinely distinct addresses distinct", () => {
    // The mail1@/mail2@ signup pattern is a real set of addresses; the unique
    // index cannot stop it and normalisation must not pretend otherwise.
    expect(normalizeEmail("mail@mail.ru")).not.toBe(
      normalizeEmail("mail1@mail.ru")
    );
  });
});
