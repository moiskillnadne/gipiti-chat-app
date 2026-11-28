import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CURRENCY_CODE,
  TOPUP_MAX_MAJOR_UNITS,
  TOPUP_MIN_MAJOR_UNITS,
  TOPUP_TESTER_MIN_MAJOR_UNITS,
} from "@/lib/billing/constants";
import { toMeDto } from "@/server/api/v1/_mappers/me";
import { seedUserInCurrency } from "@/server/modules/billing/__integration__/seed-billing-data";
import { getBalance } from "@/server/modules/billing/balance";
import { getMinorUnits } from "@/server/modules/billing/currencies";
import { getTopupBounds } from "@/server/modules/billing/topup-bounds";
import { getUserById } from "@/server/modules/users/queries/get-by-id";
import {
  closeDatabaseConnection,
  resetMoneyTables,
  seedCurrency,
} from "@/tests/integration/helpers";

const MINOR_UNITS_PER_MAJOR = 100;

/**
 * `loadMe` without the feature flag, which needs the Next.js runtime: the
 * same reads, the same bounds, the same mapper.
 */
const loadMeWithoutFlag = async (userId: string) => {
  const [user, balance] = await Promise.all([
    getUserById(userId),
    getBalance(userId),
  ]);
  if (!user) {
    throw new Error("seeded user is missing");
  }

  return toMeDto({
    user,
    hasActiveSubscription: false,
    balance,
    isTopupEnabled: true,
    topupBounds: getTopupBounds({
      isTester: user.isTester,
      minorUnits: await getMinorUnits(DEFAULT_CURRENCY_CODE),
      balanceCurrencyCode: balance?.currencyCode ?? null,
    }),
  });
};

describe("the top-up bounds of GET /me against a real database", () => {
  beforeEach(async () => {
    await resetMoneyTables();
    await seedCurrency();
    await seedCurrency("USD");
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  it("offers a RUB user what the plan card enforces: the public minimum and maximum", async () => {
    // Arrange
    const userId = await seedUserInCurrency({ currencyCode: "RUB" });

    // Act
    const me = await loadMeWithoutFlag(userId);

    // Assert
    expect(me.topup).toEqual({
      min: {
        amountMinor: TOPUP_MIN_MAJOR_UNITS * MINOR_UNITS_PER_MAJOR,
        currencyCode: "RUB",
      },
      max: {
        amountMinor: TOPUP_MAX_MAJOR_UNITS * MINOR_UNITS_PER_MAJOR,
        currencyCode: "RUB",
      },
    });
  });

  it("offers a tester the lowered minimum, read fresh from the database", async () => {
    // Arrange
    const userId = await seedUserInCurrency({
      currencyCode: "RUB",
      isTester: true,
    });

    // Act
    const me = await loadMeWithoutFlag(userId);

    // Assert
    expect(me.topup?.min.amountMinor).toBe(
      TOPUP_TESTER_MIN_MAJOR_UNITS * MINOR_UNITS_PER_MAJOR
    );
    expect(me.topup?.max.amountMinor).toBe(
      TOPUP_MAX_MAJOR_UNITS * MINOR_UNITS_PER_MAJOR
    );
  });

  it("offers a user whose balance is in another currency no top-up, as the create-intent route refuses it", async () => {
    // Arrange
    const userId = await seedUserInCurrency({ currencyCode: "USD" });

    // Act
    const me = await loadMeWithoutFlag(userId);

    // Assert
    expect(me.balance?.total.currencyCode).toBe("USD");
    expect(me.topup).toBeNull();
  });
});
