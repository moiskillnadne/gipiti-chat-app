import { describe, expect, it } from "vitest";
import { isDisposableEmail } from "@/lib/auth/disposable-email-domains";
import disposableDomains from "@/lib/auth/disposable-email-domains.json" with {
  type: "json",
};

const DOMAIN_PATTERN =
  /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/** Providers real users of this product sign up with. */
const REAL_PROVIDERS = [
  "gmail.com",
  "mail.ru",
  "bk.ru",
  "inbox.ru",
  "list.ru",
  "yandex.ru",
  "ya.ru",
  "rambler.ru",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "yahoo.com",
  "proton.me",
  "protonmail.com",
];

describe("isDisposableEmail", () => {
  it.each([
    ["a listed domain", "someone@mailinator.com"],
    ["a subdomain of a listed domain", "someone@inbox.mailinator.com"],
    ["a listed domain in upper case", "Someone@MAILINATOR.COM"],
    ["a listed domain with a trailing dot", "someone@mailinator.com."],
    ["a listed domain padded with spaces", " someone@mailinator.com "],
  ])("rejects %s", (_case, email) => {
    // Act
    const isDisposable = isDisposableEmail(email);

    // Assert
    expect(isDisposable).toBe(true);
  });

  it.each(REAL_PROVIDERS)("accepts %s", (domain) => {
    // Act
    const isDisposable = isDisposableEmail(`someone@${domain}`);

    // Assert
    expect(isDisposable).toBe(false);
  });

  it.each([
    ["a company domain", "someone@gipiti.ru"],
    [
      "a domain that only ends like a listed one",
      "someone@gipititestmailinator.com",
    ],
    ["a listed domain used as the local part", "mailinator.com@gmail.com"],
    ["an address without a domain", "someone@"],
    ["a bare top-level domain", "someone@com"],
    ["an empty string", ""],
  ])("accepts %s", (_case, email) => {
    // Act
    const isDisposable = isDisposableEmail(email);

    // Assert
    expect(isDisposable).toBe(false);
  });
});

describe("the vendored domain list", () => {
  it("holds only lower-case domain names, sorted and without duplicates", () => {
    // Act
    const sortedUnique = [...new Set(disposableDomains)].sort();

    // Assert
    expect(disposableDomains.length).toBeGreaterThan(1000);
    expect(disposableDomains).toEqual(sortedUnique);
    expect(
      disposableDomains.filter((domain) => !DOMAIN_PATTERN.test(domain))
    ).toEqual([]);
  });

  it("does not list a real provider", () => {
    // Act
    const listedProviders = REAL_PROVIDERS.filter((domain) =>
      disposableDomains.includes(domain)
    );

    // Assert
    expect(listedProviders).toEqual([]);
  });
});
