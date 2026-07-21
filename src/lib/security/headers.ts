import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isProd = () => process.env.NODE_ENV === "production";

/**
 * Headers de endurecimiento HTTP (OWASP-ish).
 */
export function applySecurityHeaders(
  res: NextResponse,
  req?: NextRequest,
): NextResponse {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  res.headers.set("X-DNS-Prefetch-Control", "off");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-origin");

  // CSP: permite Leaflet tiles OSM + mismos orígenes app
  const csp = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next dev necesita eval; prod igual por bundler
    "connect-src 'self' https://*.tile.openstreetmap.org",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
  ].join("; ");
  res.headers.set("Content-Security-Policy", csp);

  if (isProd()) {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  res.headers.set("X-UNGRD-Security", "protocol-v1");

  // No filtrar server tech
  res.headers.delete("X-Powered-By");

  if (req) {
    // marca de request para correlación
    const rid =
      req.headers.get("x-request-id") ||
      req.headers.get("cf-ray") ||
      crypto.randomUUID();
    res.headers.set("X-Request-Id", rid);
  }

  return res;
}

export function jsonSecurityError(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, string | number>,
) {
  const res = NextResponse.json(
    { error: message, code, ...extra },
    { status },
  );
  applySecurityHeaders(res);
  if (status === 429 && extra?.retryAfter) {
    res.headers.set("Retry-After", String(extra.retryAfter));
  }
  return res;
}
