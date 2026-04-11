/**
 * One-off script to resume failed CloudPayments subscriptions.
 *
 * A webhook bug (error 3005) caused some subscriptions to fall into
 * Cancelled/PastDue status. CloudPayments support confirmed that calling
 * /subscriptions/update with any change will resume the subscription
 * and trigger a new charge attempt.
 *
 * Usage:
 *   CP_PUBLIC_ID=xxx CP_API_SECRET=yyy npx tsx scripts/resume-subscriptions.ts
 */

// ── Configuration ──────────────────────────────────────────────────────────────

const DRY_RUN = false;

const SUBSCRIPTION_IDS: string[] = [
  // Fill in the subscription IDs to resume (sc_xxx format)
  // "sc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  // "sc_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "sc_fd1fc4a9092ee6544db74cc00b055",
];

// ── Types ──────────────────────────────────────────────────────────────────────

type CloudPaymentsResponse = {
  Success: boolean;
  Message: string | null;
};

// ── Main ───────────────────────────────────────────────────────────────────────

const main = async (): Promise<void> => {
  const cpPublicId = process.env.CP_PUBLIC_ID;
  const cpApiSecret = process.env.CP_API_SECRET;

  if (!cpPublicId || !cpApiSecret) {
    console.error(
      "❌ Missing env vars: CP_PUBLIC_ID and CP_API_SECRET are required"
    );
    process.exit(1);
  }

  if (SUBSCRIPTION_IDS.length === 0) {
    console.error(
      "❌ No subscription IDs configured. Edit the SUBSCRIPTION_IDS array."
    );
    process.exit(1);
  }

  const authHeader = `Basic ${Buffer.from(`${cpPublicId}:${cpApiSecret}`).toString("base64")}`;
  const startDate = new Date(Date.now() + 3 * 60 * 1000).toISOString();

  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no API calls)" : "LIVE"}`);
  console.log(`StartDate: ${startDate}`);
  console.log(`Subscriptions: ${SUBSCRIPTION_IDS.length}\n`);

  let okCount = 0;
  let failCount = 0;

  for (const subscriptionId of SUBSCRIPTION_IDS) {
    const body = { Id: subscriptionId, StartDate: startDate };

    if (DRY_RUN) {
      console.log(`🔍 [DRY RUN] Would update subscription ${subscriptionId}`);
      console.log("   POST https://api.cloudpayments.ru/subscriptions/update");
      console.log(`   Body: ${JSON.stringify(body)}\n`);
      okCount++;
      continue;
    }

    try {
      const response = await fetch(
        "https://api.cloudpayments.ru/subscriptions/update",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          body: JSON.stringify(body),
        }
      );

      const data = (await response.json()) as CloudPaymentsResponse;

      if (data.Success) {
        console.log(`✅ ${subscriptionId} — OK`);
        okCount++;
      } else {
        console.log(
          `❌ ${subscriptionId} — ${data.Message ?? "Unknown error"}`
        );
        failCount++;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.log(`❌ ${subscriptionId} — Network error: ${errorMessage}`);
      failCount++;
    }
  }

  console.log("\n── Summary ──");
  console.log(
    `OK: ${okCount} | Failed: ${failCount} | Total: ${SUBSCRIPTION_IDS.length}`
  );
};

main();
