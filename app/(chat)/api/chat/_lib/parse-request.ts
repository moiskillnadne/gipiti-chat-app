import { z } from "zod";
import { ChatSDKError } from "@/lib/errors";
import { type PostRequestBody, postRequestBodySchema } from "../schema";

const MAX_MESSAGE_LENGTH = 50_000;

export type ParseRequestResult =
  | { ok: true; body: PostRequestBody }
  | { ok: false; response: Response };

/**
 * Parse and validate the chat POST body. Returns a shaped 400 describing the
 * limit when the message is over-length, otherwise a generic bad_request.
 */
export async function parseRequestBody(
  request: Request
): Promise<ParseRequestResult> {
  try {
    const json = await request.json();
    const body = postRequestBodySchema.parse(json);
    return { ok: true, body };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const textLengthError = error.errors.find(
        (err) => err.path.includes("text") && err.code === "too_big"
      );

      if (textLengthError && textLengthError.code === "too_big") {
        const received =
          "received" in textLengthError ? textLengthError.received : "unknown";
        return {
          ok: false,
          response: Response.json(
            {
              code: "bad_request:api",
              message: `Your message is too long. Please reduce it to ${MAX_MESSAGE_LENGTH} characters or less.`,
              cause: `Current length: ${received} characters`,
            },
            { status: 400 }
          ),
        };
      }
    }

    return {
      ok: false,
      response: new ChatSDKError("bad_request:api").toResponse(),
    };
  }
}
