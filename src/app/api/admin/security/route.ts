import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import {
  clearBan,
  getSecurityConfig,
  listBans,
  securityStats,
  setBan,
} from "@/lib/security";

/**
 * GET  /api/admin/security — estado del protocolo (bans, stats)
 * POST /api/admin/security — { action: "ban"|"unban", ip, minutes?, reason? }
 */
export async function GET() {
  const authz = await requireAdmin();
  if (!authz.ok) return authz.response;

  const cfg = getSecurityConfig();
  return NextResponse.json({
    enabled: cfg.enabled,
    limits: {
      apiRpm: cfg.apiRpm,
      authRpm: cfg.authRpm,
      uploadRpm: cfg.uploadRpm,
      healthRpm: cfg.healthRpm,
      windowMs: cfg.windowMs,
      banThreshold: cfg.banThreshold,
      maxBodyMb: Math.floor(cfg.maxBodyBytes / (1024 * 1024)),
    },
    stats: securityStats(),
    bans: listBans(),
    allowlistSize: cfg.allowlist.size,
    denylistSize: cfg.denylist.size,
  });
}

export async function POST(req: Request) {
  const authz = await requireAdmin();
  if (!authz.ok) return authz.response;

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    ip?: string;
    minutes?: number;
    reason?: string;
  } | null;

  const action = body?.action;
  const ip = String(body?.ip || "").trim();
  if (!ip || !action) {
    return NextResponse.json(
      { error: "Requiere action e ip" },
      { status: 400 },
    );
  }

  if (action === "unban") {
    clearBan(ip);
    return NextResponse.json({ ok: true, action: "unban", ip });
  }

  if (action === "ban") {
    const minutes = Math.min(Math.max(Number(body?.minutes) || 60, 1), 60 * 24 * 7);
    setBan(
      ip,
      minutes * 60_000,
      body?.reason || "manual_admin",
      99,
    );
    return NextResponse.json({ ok: true, action: "ban", ip, minutes });
  }

  return NextResponse.json({ error: "action inválida" }, { status: 400 });
}
