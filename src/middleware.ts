import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  enforceSecurity,
  finalizeResponse,
} from "@/lib/security";

/**
 * Middleware UNGRD:
 * 1) Protocolo de seguridad (rate limit, ban IP, inspección)
 * 2) Auth JWT para /app y APIs de datos
 */
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const guard = enforceSecurity(req);
  if (!guard.ok) {
    return guard.response;
  }

  // Rutas públicas de auth/health: solo seguridad, sin JWT
  const publicApi =
    pathname.startsWith("/api/auth") || pathname === "/api/health";
  const publicPage =
    pathname === "/login" ||
    pathname === "/" ||
    pathname.startsWith("/geo/");

  if (publicApi || publicPage) {
    const res = NextResponse.next();
    return finalizeResponse(res, req, guard.headers);
  }

  const needsAuth =
    pathname.startsWith("/app") ||
    pathname.startsWith("/api/v1") ||
    pathname.startsWith("/api/themes") ||
    pathname.startsWith("/api/uploads") ||
    pathname.startsWith("/api/me") ||
    pathname.startsWith("/api/admin");

  if (!needsAuth) {
    const res = NextResponse.next();
    return finalizeResponse(res, req, guard.headers);
  }

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET || "ungrd-dev-secret-change-me",
  });

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return finalizeResponse(
        NextResponse.json({ error: "No autenticado" }, { status: 401 }),
        req,
        guard.headers,
      );
    }
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    return finalizeResponse(NextResponse.redirect(login), req, guard.headers);
  }

  const res = NextResponse.next();
  return finalizeResponse(res, req, guard.headers);
}

export const config = {
  matcher: [
    /*
     * Todo excepto estáticos de Next / favicon.
     * Así también se bloquean sondas (/wp-admin, /.env, etc.).
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
