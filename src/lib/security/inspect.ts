import type { NextRequest } from "next/server";

const SUSPICIOUS =
  /(\.\.|%2e%2e|%00|\x00|<|>|`|\$\(|\bunion\b.+\bselect\b|\bscript\b)/i;

const BLOCKED_EXTENSIONS =
  /\.(env|git|sql|bak|old|swp|php|asp|aspx|cgi|exe)$/i;

/**
 * Rechaza paths/query claramente maliciosos o de reconocimiento.
 */
export function inspectRequest(req: NextRequest): {
  ok: boolean;
  reason?: string;
} {
  const { pathname, search } = req.nextUrl;
  const full = pathname + search;

  if (full.length > 2048) {
    return { ok: false, reason: "path_too_long" };
  }

  if (SUSPICIOUS.test(full)) {
    return { ok: false, reason: "suspicious_pattern" };
  }

  if (BLOCKED_EXTENSIONS.test(pathname)) {
    return { ok: false, reason: "blocked_extension" };
  }

  // Sondeo típico
  const lower = pathname.toLowerCase();
  if (
    lower.includes("wp-admin") ||
    lower.includes("wp-login") ||
    lower.includes("phpmyadmin") ||
    lower.includes("/.git") ||
    lower.includes("/.env") ||
    lower.includes("/actuator")
  ) {
    return { ok: false, reason: "probe_blocked" };
  }

  const cl = req.headers.get("content-length");
  if (cl) {
    const n = Number(cl);
    if (Number.isFinite(n) && n < 0) {
      return { ok: false, reason: "bad_content_length" };
    }
  }

  return { ok: true };
}
