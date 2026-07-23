import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  classifyPath,
  getSecurityConfig,
  rpmForClass,
} from "./config";
import { clientIp } from "./ip";
import { inspectRequest } from "./inspect";
import { applySecurityHeaders, jsonSecurityError } from "./headers";
import {
  addStrike,
  getBan,
  getStrikeCount,
  hitRateLimit,
  setBan,
} from "./store";

export type GuardResult =
  | { ok: true; ip: string; headers: Record<string, string> }
  | { ok: false; response: NextResponse; ip: string };

function banDuration(cfg: ReturnType<typeof getSecurityConfig>, strikes: number) {
  const factor = Math.pow(cfg.banBackoff, Math.max(0, strikes - 1));
  return Math.min(cfg.banMs * factor, cfg.banMaxMs);
}

/**
 * Protocolo de seguridad — ejecutar al inicio del middleware.
 */
export function enforceSecurity(req: NextRequest): GuardResult {
  const cfg = getSecurityConfig();
  const ip = clientIp(req);

  if (!cfg.enabled) {
    return { ok: true, ip, headers: {} };
  }

  if (cfg.denylist.has(ip)) {
    return {
      ok: false,
      ip,
      response: jsonSecurityError(
        403,
        "IP_DENIED",
        "Acceso denegado desde esta dirección.",
      ),
    };
  }

  const allowlisted = cfg.allowlist.has(ip);

  const ban = getBan(ip);
  if (ban && !allowlisted) {
    const retryAfter = Math.max(1, Math.ceil((ban.until - Date.now()) / 1000));
    return {
      ok: false,
      ip,
      response: jsonSecurityError(
        403,
        "IP_BANNED",
        "IP temporalmente bloqueada por abuso o reintentos excesivos.",
        { retryAfter, reason: ban.reason },
      ),
    };
  }

  const inspection = inspectRequest(req);
  if (!inspection.ok) {
    const strikes = addStrike(ip, cfg.windowMs * 5);
    if (strikes >= Math.max(3, Math.floor(cfg.banThreshold / 2))) {
      setBan(
        ip,
        banDuration(cfg, getStrikeCount(ip)),
        inspection.reason || "suspicious",
        getStrikeCount(ip),
      );
    }
    return {
      ok: false,
      ip,
      response: jsonSecurityError(
        400,
        "BAD_REQUEST",
        "Solicitud rechazada por el filtro de seguridad.",
        { reason: inspection.reason || "invalid" },
      ),
    };
  }

  // Límite de body por Content-Length (uploads / POST)
  const cl = req.headers.get("content-length");
  if (cl) {
    const n = Number(cl);
    if (Number.isFinite(n) && n > cfg.maxBodyBytes) {
      addStrike(ip, cfg.windowMs);
      return {
        ok: false,
        ip,
        response: jsonSecurityError(
          413,
          "PAYLOAD_TOO_LARGE",
          `Cuerpo demasiado grande (máx ${Math.floor(cfg.maxBodyBytes / (1024 * 1024))} MB).`,
        ),
      };
    }
  }

  const cls = classifyPath(req.nextUrl.pathname, req.method);
  const limit = allowlisted
    ? rpmForClass(cfg, cls) * 5
    : rpmForClass(cfg, cls);
  const rlKey = `${cls}:${ip}`;
  const rl = hitRateLimit(rlKey, limit, cfg.windowMs);

  if (!rl.allowed) {
    // Solo acumular strikes en API/auth/upload (no por navegar páginas).
    if (cls !== "page") {
      const strikes = addStrike(ip, cfg.windowMs * 10);
      if (strikes >= cfg.banThreshold) {
        const prev = getStrikeCount(ip);
        setBan(ip, banDuration(cfg, prev), `rate_limit_${cls}`, prev);
      }
    }
    return {
      ok: false,
      ip,
      response: jsonSecurityError(
        429,
        "RATE_LIMITED",
        "Demasiadas peticiones. Espere e intente de nuevo.",
        { retryAfter: rl.retryAfterSec },
      ),
    };
  }

  return {
    ok: true,
    ip,
    headers: {
      "X-RateLimit-Limit": String(limit),
      "X-RateLimit-Remaining": String(rl.remaining),
      "X-Client-IP-Class": allowlisted ? "allowlist" : "standard",
    },
  };
}

export function finalizeResponse(
  res: NextResponse,
  req: NextRequest,
  guardHeaders?: Record<string, string>,
) {
  applySecurityHeaders(res, req);
  if (guardHeaders) {
    for (const [k, v] of Object.entries(guardHeaders)) {
      res.headers.set(k, v);
    }
  }
  return res;
}

/** Registrar fallo de autenticación (llamar desde authorize / route). */
export function registerAuthFailure(ip: string) {
  const cfg = getSecurityConfig();
  if (!cfg.enabled) return;
  if (cfg.allowlist.has(ip)) return;
  const strikes = addStrike(`authfail:${ip}`, cfg.windowMs);
  // umbral más bajo para fuerza bruta de login
  const threshold = Math.max(5, Math.floor(cfg.banThreshold / 2));
  if (strikes >= threshold) {
    setBan(
      ip,
      banDuration(cfg, strikes),
      "auth_bruteforce",
      strikes,
    );
  }
}
