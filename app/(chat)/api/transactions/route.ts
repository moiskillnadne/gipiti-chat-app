import { auth } from "@/app/(auth)/auth";
import {
  getTransactionsWithChats,
  getUsageSummary,
} from "@/lib/db/queries-transactions";

export async function GET(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(50, Number(searchParams.get("limit")) || 20);
  const offset = Number(searchParams.get("offset")) || 0;

  const [transactionsData, summaryData] = await Promise.all([
    getTransactionsWithChats({
      userId: session.user.id,
      limit,
      offset,
    }),
    getUsageSummary(session.user.id),
  ]);

  return Response.json({
    transactions: transactionsData.transactions,
    total: transactionsData.total,
    hasMore: offset + limit < transactionsData.total,
    summary: summaryData,
  });
}
