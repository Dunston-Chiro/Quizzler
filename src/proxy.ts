import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

// Route configurations
const PUBLIC_ROUTES = ["/", "/login", "/register", "/unauthorized"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Retrieve session token from cookies
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(sessionToken);

  // If user is logged in and trying to visit /login or /register, send them to their dashboard
  if (session && (pathname === "/login" || pathname === "/register")) {
    if (session.role === "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/super-admin/dashboard", request.url));
    }
    if (session.role === "ADMIN") {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    return NextResponse.redirect(new URL("/participant/dashboard", request.url));
  }

  // Helper to attach x-pathname header
  const nextWithHeader = () => {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  };

  // Public routes pass through
  if (PUBLIC_ROUTES.includes(pathname)) {
    return nextWithHeader();
  }

  // Handle protected area routing:
  // 1. Super-Admin zone: /super-admin/*
  if (pathname.startsWith("/super-admin")) {
    if (!session) {
      return NextResponse.redirect(
        new URL(`/login?redirect=${encodeURIComponent(pathname)}`, request.url)
      );
    }
    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
    return nextWithHeader();
  }

  // 2. Admin zone: /admin/*
  if (pathname.startsWith("/admin")) {
    if (!session) {
      return NextResponse.redirect(
        new URL(`/login?redirect=${encodeURIComponent(pathname)}`, request.url)
      );
    }
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.redirect(new URL("/unauthorized", request.url));
    }
    return nextWithHeader();
  }

  // 3. Participant zone: /participant/*
  if (pathname.startsWith("/participant")) {
    if (!session) {
      return NextResponse.redirect(
        new URL(`/login?redirect=${encodeURIComponent(pathname)}`, request.url)
      );
    }
    return nextWithHeader();
  }

  return nextWithHeader();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - static assets (.svg, .png, .jpg, etc.)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

export default proxy;
