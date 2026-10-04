import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const MAX_MESSAGE_LENGTH = 2000;

const clientLogSchema = z.object({
  level: z.enum(["error", "info"]),
  message: z.string().max(MAX_MESSAGE_LENGTH),
  context: z.unknown().optional(),
});

/**
 * Sink for client-side logs (`lib/client-logger.ts`, sent via sendBeacon).
 * Adds the request's own user agent and Vercel request id, which survive even
 * when the client payload is incomplete.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const parsed = clientLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { level, message, context } = parsed.data;
  const logFn = level === "error" ? console.error : console.log;
  logFn(`[CLIENT ${level.toUpperCase()}]`, message, context ?? "", {
    requestUserAgent: request.headers.get("user-agent"),
    vercelId: request.headers.get("x-vercel-id"),
  });
  return NextResponse.json({ ok: true });
}
