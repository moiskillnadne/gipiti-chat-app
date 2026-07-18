import { ChatSDKError } from "@/lib/errors";

/**
 * Convert an error thrown inside an API route handler into a safe JSON
 * response. ChatSDKError keeps its own status code and visibility rules
 * (database errors are logged server-side and sanitized); anything else is
 * logged and returned as a generic 500 so a failing query never escapes the
 * handler as an unstructured crash.
 */
export function handleRouteError(error: unknown): Response {
  if (error instanceof ChatSDKError) {
    return error.toResponse();
  }

  console.error("Unhandled API route error:", error);

  return Response.json(
    { code: "", message: "Something went wrong. Please try again later." },
    { status: 500 }
  );
}
