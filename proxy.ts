import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAuthSecret } from "./lib/auth/secret";
import { isDevelopmentEnvironment } from "./lib/constants";
import { isSignupEnabled } from "./lib/flags";

const AUTH_ROUTES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

/**
 * Routes that exist and require a session. Anything not listed here is either
 * public or does not exist, and in both cases must fall through to Next so an
 * unknown path renders `not-found.tsx` with a 404.
 *
 * Sending unknown paths to `/login?callbackUrl=…` instead turns every stray URL
 * a crawler stumbles on into its own indexable copy of the login page — Search
 * Console reported exactly that as "Duplicate without user-selected canonical".
 * Each protected page also enforces its own `auth()` guard, so this list is
 * defence in depth rather than the only gate.
 */
const PROTECTED_ROUTE_PATTERNS = [
  /^\/chat(?:\/[^/]+)?$/,
  /^\/projects(?:\/[^/]+)?$/,
  /^\/prompts$/,
  /^\/subscription(?:\/(?:manage|usage|verify-email))?$/,
  /^\/manage-subscription$/,
];

const isProtectedRoute = (pathname: string): boolean =>
  PROTECTED_ROUTE_PATTERNS.some((pattern) => pattern.test(pathname));

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/register")) {
    if (await isSignupEnabled()) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Machine metadata endpoints (Flags Explorer discovery, Vercel Toolbar
  // microfrontends config, etc.) expect JSON or 404 — never a login redirect.
  // The flags endpoint authenticates itself via FLAGS_SECRET.
  if (pathname.startsWith("/.well-known/")) {
    return NextResponse.next();
  }

  /*
   * Playwright starts the dev server and requires a 200 status to
   * begin the tests, so this ensures that the tests can start
   */
  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  // Allow webhook, auth, payment, and log API routes through without auth
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/payment") ||
    pathname.startsWith("/api/log")
  ) {
    return NextResponse.next();
  }

  // Author preview tool: no login (external author), never indexed, hidden behind
  // a shared secret in production. Dev is open for convenience.
  if (pathname === "/blog/preview") {
    const expectedKey = process.env.BLOG_PREVIEW_KEY;
    const providedKey = request.nextUrl.searchParams.get("key");
    const isAllowed = isDevelopmentEnvironment
      ? true
      : Boolean(expectedKey) && providedKey === expectedKey;
    return isAllowed
      ? NextResponse.next()
      : new NextResponse(null, { status: 404 });
  }

  const response = NextResponse.next();

  const token = await getToken({
    req: request,
    secret: getAuthSecret(),
    secureCookie: !isDevelopmentEnvironment,
  });

  const isAuthRoute = AUTH_ROUTES.includes(pathname);

  // Redirect authenticated from landing page to chat
  if (token && pathname === "/") {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  // Only real, session-gated routes bounce anonymous visitors to `/login`.
  // Public pages and unknown paths alike fall through to Next, which renders
  // them or returns a 404 — see PROTECTED_ROUTE_PATTERNS.
  if (!token && isProtectedRoute(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated, verified users cannot access auth routes
  if (token && isAuthRoute) {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/chat",
    "/chat/:id",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/legal/:path*",

    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - icon.png, apple-icon.png, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|api/|images/|videos/|icon.png|apple-icon.png|sitemap.xml|robots.txt|manifest.webmanifest).*)",
  ],
};
