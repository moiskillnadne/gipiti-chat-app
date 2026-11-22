import { describe, expect, it } from "vitest";

import { messages } from "@/lib/i18n/dictionary";
import {
  homeBenefits,
  homeFaqItems,
  homeFeatures,
  NEW_USER_BONUS_BADGE_RU,
  NEW_USER_BONUS_BREAKDOWN_RU,
  NEW_USER_BONUS_RUB,
  NEW_USER_BONUS_SHORT_RU,
  NEW_USER_BONUS_TERMS_RU,
  NEW_USER_BONUS_UP_TO_RU,
  pricingFeatures,
} from "@/lib/marketing/landing-content";
import { modelLandings } from "@/lib/marketing/model-landings";

// Literal expectations on purpose: changing a grant in lib/billing/constants.ts
// or a phrase template must fail here, so the copy is reread before it ships.
// «\u00a0» is the non-breaking space every amount carries before «₽».
const EXPECTED_COPY = {
  total: 200,
  upTo: "до\u00a0200\u00a0₽",
  short: "До\u00a0200\u00a0₽ в подарок новым пользователям",
  badge: "До\u00a0200\u00a0₽ новым пользователям",
  terms:
    "50\u00a0₽ сразу после регистрации и ещё 150\u00a0₽ за подтверждение email и короткий опрос",
  breakdown:
    "50\u00a0₽ сразу после регистрации, ещё 100\u00a0₽ за подтверждение email и 50\u00a0₽ за короткий опрос о ваших задачах",
};

// The old copy promised the whole total at signup: «Дарим 200 ₽ каждому…»,
// «начисляется 200 ₽», «стартовых 200 ₽». Data copy names the total only as
// «до 200 ₽»; the CTA components may lead the terms with «Дарим», but they
// are not scanned here.
const SIGNUP_GIFT_CLAIM = /(дарим|начисляется|стартовых)[\s\u00a0]+\d/i;

describe("new-user bonus copy", () => {
  it("renders today's grants as the agreed Russian copy", () => {
    expect({
      total: NEW_USER_BONUS_RUB,
      upTo: NEW_USER_BONUS_UP_TO_RU,
      short: NEW_USER_BONUS_SHORT_RU,
      badge: NEW_USER_BONUS_BADGE_RU,
      terms: NEW_USER_BONUS_TERMS_RU,
      breakdown: NEW_USER_BONUS_BREAKDOWN_RU,
    }).toEqual(EXPECTED_COPY);
  });

  it.each([
    ["the model landings", JSON.stringify(modelLandings)],
    [
      "the landing content module",
      JSON.stringify({
        homeBenefits,
        homeFaqItems,
        homeFeatures,
        pricingFeatures,
      }),
    ],
    ["messages/ru.json", JSON.stringify(messages)],
  ])("keeps %s free of a signup promise of the whole total", (_, copy) => {
    expect(copy).not.toMatch(SIGNUP_GIFT_CLAIM);
  });
});
