import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { level, message, context } = await request.json();
  const logFn = level === "error" ? console.error : console.log;
  logFn(`[CLIENT ${level.toUpperCase()}]`, message, context ?? "");
  return NextResponse.json({ ok: true });
}
