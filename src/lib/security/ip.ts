import type { NextRequest } from "next/server";
import { getSecurityConfig } from "./config";

/**
 * Resuelve IP del cliente. Con SECURITY_TRUST_PROXY=true usa
 * CF-Connecting-IP / X-Real-IP / X-Forwarded-For (primer hop).
 */
export function clientIp(req: NextRequest): string {
  const cfg = getSecurityConfig();
  if (cfg.trustProxy) {
    // Vercel documenta este header como IP del cliente.
    const vercel = req.headers.get("x-vercel-forwarded-for");
    if (vercel?.trim()) return vercel.split(",")[0]!.trim();

    const cf = req.headers.get("cf-connecting-ip");
    if (cf?.trim()) return cf.trim();

    const real = req.headers.get("x-real-ip");
    if (real?.trim()) return real.trim();

    const xff = req.headers.get("x-forwarded-for");
    if (xff) {
      const first = xff.split(",")[0]?.trim();
      if (first) return first;
    }
  }

  return "127.0.0.1";
}
