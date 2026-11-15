import { describe, expect, it } from "vitest";

import { decidePeriodEndAction } from "../period-end-action";

describe("decidePeriodEndAction", () => {
  it("renews a tester's subscription that has no CloudPayments subscription", () => {
    // Arrange
    const candidate = { externalSubscriptionId: null, isTester: true };

    // Act
    const action = decidePeriodEndAction(candidate);

    // Assert
    expect(action).toBe("renew");
  });

  it("expires a non-tester's subscription that has no CloudPayments subscription", () => {
    // Arrange
    const candidate = { externalSubscriptionId: null, isTester: false };

    // Act
    const action = decidePeriodEndAction(candidate);

    // Assert
    expect(action).toBe("expire");
  });

  it("leaves subscriptions renewed by CloudPayments to the recurrent webhook", () => {
    // Arrange
    const candidates = [
      { externalSubscriptionId: "sc_123", isTester: false },
      { externalSubscriptionId: "sc_456", isTester: true },
    ];

    // Act
    const actions = candidates.map(decidePeriodEndAction);

    // Assert
    expect(actions).toEqual(["skip", "skip"]);
  });
});
