import { auth } from "@/app/(auth)/auth";
import { grantQuizBonus } from "@/lib/billing/balance";
import { createQuizResponse } from "@/lib/db/query/quiz/create-quiz-response";
import { getQuizResponse } from "@/lib/db/query/quiz/get-quiz-response";
import { ChatSDKError } from "@/lib/errors";
import { getQuizDefinition } from "@/lib/quiz/registry";
import type { QuizAnswers } from "@/lib/quiz/types";

type RouteContext = { params: Promise<{ key: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const { key } = await params;
  const existing = await getQuizResponse({
    userId: session.user.id,
    quizKey: key,
  });

  return Response.json({ completed: existing !== null });
}

export async function POST(request: Request, { params }: RouteContext) {
  const session = await auth();
  if (!session?.user?.id) {
    return new ChatSDKError("unauthorized:chat").toResponse();
  }

  const { key } = await params;
  const definition = getQuizDefinition(key);
  if (!definition) {
    return new ChatSDKError(
      "bad_request:api",
      `Unknown quiz "${key}"`
    ).toResponse();
  }

  let answers: QuizAnswers;
  try {
    const body = await request.json();
    answers = definition.schema.parse(body?.answers);
  } catch {
    return new ChatSDKError(
      "bad_request:api",
      "Invalid quiz answers"
    ).toResponse();
  }

  const userId = session.user.id;

  // Already completed — idempotent success, no second reward.
  const existing = await getQuizResponse({ userId, quizKey: key });
  if (existing) {
    return Response.json({ completed: true });
  }

  await createQuizResponse({ userId, quizKey: key, answers });
  await grantQuizBonus(userId, key, definition.bonusMajorUnits);

  return Response.json({ completed: true });
}
