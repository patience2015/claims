import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { NextResponse } from "next/server";
import { getDefaultRedirect } from "@/lib/permissions";
import { UserRole } from "@/types";

// Important: Init NextAuth with only the Edge-compatible config
const { auth } = NextAuth(authConfig);

// Protected routes and their minimum required roles
const ROUTE_PERMISSIONS: Record<string, UserRole[]> = {
  "/claims": ["HANDLER", "MANAGER", "ADMIN"],
  "/dashboard": ["MANAGER", "ADMIN"],
  "/admin": ["ADMIN"],
  "/api/claims": ["HANDLER", "MANAGER", "ADMIN"],
  "/api/policyholders": ["HANDLER", "MANAGER", "ADMIN"],
  "/api/documents": ["HANDLER", "MANAGER", "ADMIN"],
  "/api/comments": ["HANDLER", "MANAGER", "ADMIN"],
  "/api/ai": ["HANDLER", "MANAGER", "ADMIN"],
  "/api/dashboard": ["MANAGER", "ADMIN"],
  "/api/notifications": ["HANDLER", "MANAGER", "ADMIN"],
  "/portail/mes-sinistres": ["POLICYHOLDER"],
  "/api/portail": ["POLICYHOLDER"],
  "/api/fraud-networks": ["MANAGER", "ADMIN"],
  "/fraud-networks": ["MANAGER", "ADMIN"],
};

export default auth(function middleware(req) {
  const { pathname } = req.nextUrl;

  // Allow public routes
  if (
    pathname.startsWith("/login") ||
    pathname.startsWith("/portail/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/notifications/check-sla")
  ) {
    // If already logged in, redirect to appropriate dashboard
    if (req.auth && (pathname === "/login" || pathname === "/portail/login")) {
      const role = req.auth.user.role as UserRole;
      return NextResponse.redirect(new URL(getDefaultRedirect(role), req.url));
    }
    return NextResponse.next();
  }

  // Require authentication for all other routes
  if (!req.auth) {
    // Portail routes redirect to portail login
    const isPortail = pathname.startsWith("/portail") || pathname.startsWith("/api/portail");
    const loginUrl = new URL(isPortail ? "/portail/login" : "/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const userRole = req.auth.user.role as UserRole;

  // POLICYHOLDER: only allowed on /portail/* and /api/portail/*
  if (userRole === "POLICYHOLDER") {
    if (
      !pathname.startsWith("/portail") &&
      !pathname.startsWith("/api/portail")
    ) {
      return NextResponse.redirect(
        new URL("/portail/mes-sinistres", req.url)
      );
    }
    return NextResponse.next();
  }

  // Check route-specific permissions
  for (const [route, allowedRoles] of Object.entries(ROUTE_PERMISSIONS)) {
    if (pathname.startsWith(route)) {
      if (!allowedRoles.includes(userRole)) {
        // Redirect to appropriate page for role
        return NextResponse.redirect(
          new URL(getDefaultRedirect(userRole), req.url)
        );
      }
      break;
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
