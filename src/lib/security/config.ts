/**
 * Protocolo de seguridad UNGRD — configuración por entorno.
 * Edge-compatible (sin Node APIs).
 */

function num(key: string, fallback: number): number {
  const v = Number(process.env[key]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

function bool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === "") return fallback;
  return !["0", "false", "off", "no"].includes(v.toLowerCase());
}

export type SecurityConfig = {
  enabled: boolean;
  trustProxy: boolean;
  /** Requests por ventana (API general) */
  apiRpm: number;
  /** Auth / login */
  authRpm: number;
  /** Uploads Excel */
  uploadRpm: number;
  /** Health / estáticos sensibles */
  healthRpm: number;
  /** Ventana en ms */
  windowMs: number;
  /** Strikes (429/401 auth) antes de ban */
  banThreshold: number;
  /** Ban inicial (ms) */
  banMs: number;
  /** Multiplicador por reincidencia */
  banBackoff: number;
  /** Ban máximo (ms) */
  banMaxMs: number;
  /** Tamaño máximo body (bytes) — Content-Length */
  maxBodyBytes: number;
  /** IPs en allowlist (nunca ban, rate laxo) */
  allowlist: Set<string>;
  /** IPs en denylist permanente */
  denylist: Set<string>;
};

function parseList(raw: string | undefined): Set<string> {
  if (!raw?.trim()) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function getSecurityConfig(): SecurityConfig {
  const isProd = process.env.NODE_ENV === "production";
  const allowlist = parseList(process.env.SECURITY_IP_ALLOWLIST);
  if (!isProd && bool("SECURITY_ALLOW_LOCALHOST", true)) {
    allowlist.add("127.0.0.1");
    allowlist.add("::1");
    allowlist.add("::ffff:127.0.0.1");
  }
  return {
    enabled: bool("SECURITY_ENABLED", true),
    trustProxy: bool("SECURITY_TRUST_PROXY", true),
    // Vercel: una sola vista de tema dispara records+analytics+access+assets.
    apiRpm: num("SECURITY_API_RPM", isProd ? 300 : 180),
    authRpm: num("SECURITY_AUTH_RPM", isProd ? 30 : 40),
    uploadRpm: num("SECURITY_UPLOAD_RPM", isProd ? 20 : 20),
    healthRpm: num("SECURITY_HEALTH_RPM", 60),
    windowMs: num("SECURITY_WINDOW_MS", 60_000),
    banThreshold: num("SECURITY_BAN_THRESHOLD", isProd ? 20 : 20),
    banMs: num("SECURITY_BAN_MS", 15 * 60_000),
    banBackoff: num("SECURITY_BAN_BACKOFF", 2),
    banMaxMs: num("SECURITY_BAN_MAX_MS", 24 * 60 * 60_000),
    maxBodyBytes: num("SECURITY_MAX_BODY_MB", 12) * 1024 * 1024,
    allowlist,
    denylist: parseList(process.env.SECURITY_IP_DENYLIST),
  };
}

export type RouteClass = "auth" | "upload" | "health" | "api" | "page";

export function classifyPath(pathname: string, method: string): RouteClass {
  if (pathname.startsWith("/api/auth") || pathname === "/login") return "auth";
  if (pathname.includes("/uploads") && method === "POST") return "upload";
  if (pathname === "/api/health") return "health";
  if (pathname.startsWith("/api/")) return "api";
  return "page";
}

export function rpmForClass(cfg: SecurityConfig, cls: RouteClass): number {
  switch (cls) {
    case "auth":
      return cfg.authRpm;
    case "upload":
      return cfg.uploadRpm;
    case "health":
      return cfg.healthRpm;
    case "api":
      return cfg.apiRpm;
    default:
      // Páginas HTML / navegación: mucho más laxo que API.
      return Math.max(cfg.apiRpm * 6, 1200);
  }
}
