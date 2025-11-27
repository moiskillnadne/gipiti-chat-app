import { type NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  defaultLocale,
  LOCALE_COOKIE_NAME,
  type Locale,
  locales,
} from "./i18n/config";
import { getAuthSecret } from "./lib/auth/secret";
import { isDevelopmentEnvironment } from "./lib/constants";

function getLocaleFromRequest(request: NextRequest): Locale {
  const localeCookie = request.cookies.get(LOCALE_COOKIE_NAME)?.value as
    | Locale
    | undefined;

  if (localeCookie && locales.includes(localeCookie)) {
    return localeCookie;
  }

  const acceptLanguage = request.headers.get("accept-language");
  if (acceptLanguage) {
    const browserLocale = acceptLanguage.split(",")[0]?.split("-")[0] as Locale;
    if (locales.includes(browserLocale)) {
      return browserLocale;
    }
  }

  return defaultLocale;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  /*
   * Playwright starts the dev server and requires a 200 status to
   * begin the tests, so this ensures that the tests can start
   */
  if (pathname.startsWith("/ping")) {
    return new Response("pong", { status: 200 });
  }

  // Allow webhook and auth API routes through without auth
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/webhooks")
  ) {
    return NextResponse.next();
  }

  const locale = getLocaleFromRequest(request);
  const response = NextResponse.next();

  if (!request.cookies.has(LOCALE_COOKIE_NAME)) {
    response.cookies.set(LOCALE_COOKIE_NAME, locale, {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
      secure: !isDevelopmentEnvironment,
    });
  }

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

  const isPublicRoute = pathname.startsWith("/legal/");

  // Unauthenticated users can only access auth routes and public routes
  if (!token && !isAuthRoute && !isPublicRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated but unverified users - email verification gate
  if (token && !token.emailVerified) {
    // Allow access to verify-email page and public routes
    if (pathname === "/verify-email" || isPublicRoute) {
      return response;
    }
    // Redirect unverified users to verification page
    return NextResponse.redirect(new URL("/verify-email", request.url));
  }

  // Authenticated and verified but no subscription - subscription gate
  if (token?.emailVerified && !token?.hasActiveSubscription) {
    // Allow access to subscribe page and public routes
    if (pathname === "/subscribe" || isPublicRoute) {
      return response;
    }
    // Redirect users without subscription to paywall
    return NextResponse.redirect(new URL("/subscribe", request.url));
  }

  // Authenticated, verified, and subscribed users cannot access auth routes
  if (token && isAuthRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Also redirect subscribed users away from subscribe page
  if (token?.hasActiveSubscription && pathname === "/subscribe") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/chat/:id",
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/subscribe",
    "/legal/:path*",

    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - icon.png, apple-icon.png, sitemap.xml, robots.txt (metadata files)
     */
    "/((?!_next/static|_next/image|icon.png|apple-icon.png|sitemap.xml|robots.txt).*)",
  ],
};
