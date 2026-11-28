import { ChatSDKError } from "@/lib/errors";
import { getTranslations } from "@/lib/i18n/translate";
import { auth } from "@/server/modules/auth/next-auth";
import { getQuizResponse } from "@/server/modules/quiz/queries/get-quiz-response";
import { submitQuiz } from "@/server/modules/quiz/submit-quiz";

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

  // A body that is not JSON is judged like any other bad answers, after the
  // quiz key: the service checks the key first.
  let answers: unknown;
  try {
    const body = await request.json();
    answers = body?.answers;
  } catch {
    answers = undefined;
  }

  const result = await submitQuiz({
    userId: session.user.id,
    quizKey: key,
    answers,
  });

  switch (result.status) {
    case "completed":
      // Also for answers saved earlier: a repeat is an idempotent success,
      // and pays nothing a second time.
      return Response.json({ completed: true });
    case "unknown_quiz":
      return new ChatSDKError(
        "bad_request:api",
        `Unknown quiz "${key}"`
      ).toResponse();
    case "invalid_answers":
      return new ChatSDKError(
        "bad_request:api",
        "Invalid quiz answers"
      ).toResponse();
    case "email_not_verified": {
      const t = await getTranslations("onboardingQuiz.api");
      return new ChatSDKError(
        "forbidden:auth",
        "Email is not verified",
        t("emailNotVerified")
      ).toResponse();
    }
    default: {
      const unhandled: never = result;
      throw new Error(`Unhandled result: ${JSON.stringify(unhandled)}`);
    }
  }
}
