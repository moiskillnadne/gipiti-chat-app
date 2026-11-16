/**
 * Code under test for `../cloudpayments-webhook.test.ts`.
 *
 * Characterization tests import what they pin only through `targets/`. When
 * the code moves, this file and the `vi.mock` specifiers in the test change;
 * the assertions do not (enforced by `scripts/check-characterization-diff.ts`).
 */
export { POST as cloudPaymentsWebhookPost } from "@/app/api/webhooks/cloudpayments/route";
