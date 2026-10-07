import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

// Force Node.js runtime for crypto module compatibility with NextAuth
export const runtime = "nodejs";

// Routes that require authentication. /checkout is deliberately public —
// guest COD checkout (G2 spec §5); orders still link to the account when a
// session exists.
const protectedRoutes = ["/account"];

// Routes that require admin role
const adminRoutes = ["/admin"];

// Routes that should redirect to home if already authenticated
const authRoutes = ["/login", "/register"];

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const userRole = req.auth?.user?.role;

  const isProtectedRoute = protectedRoutes.some((route) => nextUrl.pathname.startsWith(route));
  const isAdminRoute = adminRoutes.some((route) => nextUrl.pathname.startsWith(route));
  const isAuthRoute = authRoutes.some((route) => nextUrl.pathname.startsWith(route));
  const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");

  // Allow API auth routes
  if (isApiAuthRoute) {
    return NextResponse.next();
  }

  // Redirect authenticated users away from auth pages
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  // Redirect unauthenticated users to login for protected routes
  if (isProtectedRoute && !isLoggedIn) {
    const callbackUrl = encodeURIComponent(nextUrl.pathname + nextUrl.search);
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, nextUrl));
  }

  // Check admin routes
  if (isAdminRoute) {
    if (!isLoggedIn) {
      const callbackUrl = encodeURIComponent(nextUrl.pathname + nextUrl.search);
      return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, nextUrl));
    }

    if (userRole !== "ADMIN") {
      return NextResponse.redirect(new URL("/", nextUrl));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
