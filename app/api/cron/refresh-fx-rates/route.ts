import { refreshFxRates } from "@/lib/billing/fx";

/**
 * Refresh cached USD→currency FX rates. Scheduled hourly. On failure the last
 * cached rates remain authoritative (refreshFxRates never throws), so billing
 * deduction keeps working off the most recent successful fetch.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await refreshFxRates();

  return Response.json({
    updated: result.updated,
    failed: result.failed,
    timestamp: new Date().toISOString(),
  });
}
