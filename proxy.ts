import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { getAuthSecret } from "./lib/auth/secret";
import { isDevelopmentEnvironment } from "./lib/constants";
import { isSignupEnabled } from "./lib/flags";

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

  const response = NextResponse.next();

  const token = await getToken({
    req: request,
    secret: getAuthSecret(),
    secureCookie: !isDevelopmentEnvironment,
  });

  const isAuthRoute = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
  ].includes(pathname);

  const isPublicRoute = pathname.startsWith("/legal/") || pathname === "/";

  // Redirect authenticated from landing page to chat
  if (token && pathname === "/") {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  // Unauthenticated users can only access auth routes and public routes
  if (!token && !isAuthRoute && !isPublicRoute) {
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
