import { and, desc, eq, gte, lte } from "drizzle-orm";
import { auth } from "@/app/(auth)/auth";
import { getUserBalance, formatTokenBalance } from "@/lib/ai/token-balance";
import { getUserQuotaInfo } from "@/lib/ai/token-quota";
import { db } from "@/lib/db/queries";
import { type TokenUsageLog, tokenUsageLog } from "@/lib/db/schema";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "current"; // "current", "all", "YYYY-MM"

  // Get balance info (new balance-based system)
  const balanceInfo = await getUserBalance(session.user.id);

  // Get quota info (for backward compatibility and additional details)
  const quotaInfo = await getUserQuotaInfo(session.user.id);

  if (!quotaInfo) {
    return Response.json(
      {
        error: "No active subscription",
      },
      { status: 404 }
    );
  }

  // Get detailed usage logs
  let usageLogs: TokenUsageLog[];

  if (period === "current") {
    usageLogs = await db
      .select()
      .from(tokenUsageLog)
      .where(
        and(
          eq(tokenUsageLog.userId, session.user.id),
          gte(
            tokenUsageLog.createdAt,
            quotaInfo.subscription.currentPeriodStart
          ),
          lte(tokenUsageLog.createdAt, quotaInfo.subscription.currentPeriodEnd)
        )
      )
      .orderBy(desc(tokenUsageLog.createdAt))
      .limit(100);
  } else {
    usageLogs = await db
      .select()
      .from(tokenUsageLog)
      .where(eq(tokenUsageLog.userId, session.user.id))
      .orderBy(desc(tokenUsageLog.createdAt))
      .limit(100);
  }

  return Response.json({
    // New balance-based info (primary)
    balance: {
      current: balanceInfo?.balance ?? 0,
      formatted: formatTokenBalance(balanceInfo?.balance ?? 0),
      lastResetAt: balanceInfo?.lastResetAt,
    },
    subscription: {
      plan: quotaInfo.plan.name,
      displayName: quotaInfo.plan.displayName,
      periodStart: quotaInfo.subscription.currentPeriodStart,
      periodEnd: quotaInfo.subscription.currentPeriodEnd,
      billingPeriod: quotaInfo.subscription.billingPeriod,
      tokenQuota: quotaInfo.plan.tokenQuota,
    },
    // Keep quota info for backward compatibility
    quota: {
      total: quotaInfo.quota,
      used: quotaInfo.usage.totalTokens,
      remaining: quotaInfo.remaining,
      percentUsed: quotaInfo.percentUsed.toFixed(2),
    },
    usage: {
      totalInputTokens: quotaInfo.usage.totalInputTokens,
      totalOutputTokens: quotaInfo.usage.totalOutputTokens,
      totalCost: quotaInfo.usage.totalCost,
      totalRequests: quotaInfo.usage.totalRequests,
      modelBreakdown: quotaInfo.usage.modelBreakdown,
    },
    recentActivity: usageLogs,
  });
}
