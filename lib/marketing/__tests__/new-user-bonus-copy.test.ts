import { describe, expect, it } from "vitest";

import {
  EMAIL_CONFIRM_BONUS_MAJOR_UNITS,
  ONBOARDING_QUIZ_BONUS_MAJOR_UNITS,
  WELCOME_GRANT_MAJOR_UNITS,
} from "@/lib/billing/constants";
import {
  NEW_USER_BONUS_BADGE_RU,
  NEW_USER_BONUS_RUB,
  NEW_USER_BONUS_SHORT_RU,
  NEW_USER_BONUS_TERMS_RU,
} from "@/lib/marketing/landing-content";
import { modelLandings } from "@/lib/marketing/model-landings";

const NBSP = "\u00a0";

// The old copy promised the whole total at signup: «Дарим 200 ₽», «стартовых 200 ₽».
const SIGNUP_GIFT_CLAIM = /(Дарим|стартовых) \d+/;

const rub = (amount: number): string => `${amount}${NBSP}₽`;

describe("new-user bonus copy", () => {
  it("adds the three onboarding grants into the headline total", () => {
    expect(NEW_USER_BONUS_RUB).toBe(
      WELCOME_GRANT_MAJOR_UNITS +
        EMAIL_CONFIRM_BONUS_MAJOR_UNITS +
        ONBOARDING_QUIZ_BONUS_MAJOR_UNITS
    );
  });

  it("offers the total as an upper bound, not as a signup credit", () => {
    expect(NEW_USER_BONUS_SHORT_RU).toBe(
      `До${NBSP}${rub(NEW_USER_BONUS_RUB)} в подарок новым пользователям`
    );
  });

  it("keeps the badge variant an upper bound too", () => {
    expect(NEW_USER_BONUS_BADGE_RU).toBe(
      `До${NBSP}${rub(NEW_USER_BONUS_RUB)} новым пользователям`
    );
  });

  it("states what arrives at signup and what the rest is earned for", () => {
    expect(NEW_USER_BONUS_TERMS_RU).toBe(
      `${rub(WELCOME_GRANT_MAJOR_UNITS)} сразу после регистрации и ещё ${rub(
        EMAIL_CONFIRM_BONUS_MAJOR_UNITS + ONBOARDING_QUIZ_BONUS_MAJOR_UNITS
      )} за подтверждение email и короткий опрос`
    );
  });

  it("keeps the model landings free of the old «Дарим N ₽» signup promise", () => {
    const landingsJson = JSON.stringify(modelLandings);

    expect(landingsJson).not.toMatch(SIGNUP_GIFT_CLAIM);
  });
});
