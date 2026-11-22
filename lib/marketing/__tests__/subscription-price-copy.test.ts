import { describe, expect, it } from "vitest";

import { messages } from "@/lib/i18n/dictionary";
import { SUBSCRIPTION_PRICE_RUB } from "@/lib/marketing/landing-content";
import { getSubscriptionSeedByCode } from "@/lib/subscription/subscription-tiers";

type PriceMention = {
  key: string;
  amount: number;
  sentence: string;
};

// A sentence that talks about a month is about the monthly plan.
const MONTH_PATTERN = /месяц|\/\s?мес/;
// «999 ₽», «1 500 ₽», with a plain or non-breaking space before «₽».
const ROUBLE_AMOUNT_PATTERN = /(\d[\d  ]*\d|\d)[  ]?₽/g;
const SENTENCE_BREAK_PATTERN = /(?<=[.!?:;])\s+|\n+/;

/** Every rouble amount in a month-related sentence of the message tree. */
const collectMonthlyPrices = (node: unknown, path: string): PriceMention[] => {
  if (typeof node === "string") {
    return node
      .split(SENTENCE_BREAK_PATTERN)
      .filter((sentence) => MONTH_PATTERN.test(sentence))
      .flatMap((sentence) =>
        [...sentence.matchAll(ROUBLE_AMOUNT_PATTERN)].map((match) => ({
          key: path,
          amount: Number(match[1].replace(/[  ]/g, "")),
          sentence,
        }))
      );
  }
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([key, child]) =>
      collectMonthlyPrices(child, path ? `${path}.${key}` : key)
    );
  }
  return [];
};

describe("subscription price copy", () => {
  it("matches the marketing price to the seeded monthly plan", () => {
    expect(getSubscriptionSeedByCode("basic_monthly")?.prices.RUB).toBe(
      SUBSCRIPTION_PRICE_RUB
    );
  });

  it("quotes the current plan price in every monthly sentence of messages/ru.json", () => {
    const mentions = collectMonthlyPrices(messages, "");

    expect(mentions.length).toBeGreaterThan(0);
    expect(
      mentions.filter(({ amount }) => amount !== SUBSCRIPTION_PRICE_RUB)
    ).toEqual([]);
  });
});
