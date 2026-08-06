import { NextResponse } from "next/server";
import { getTheme } from "@/themes";
import { requireThemeWrite, requireThemeRead } from "@/lib/auth/session";
import {
  getRecordById,
  listRecordVersions,
  patchRecordWithVersion,
  restoreRecordVersion,
} from "@/lib/records/versions";
import { sanitizePuentePatch } from "@/themes/puentes/proceso-chain";

type Ctx = { params: Promise<{ slug: string; id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { slug, id } = await ctx.params;
  const authz = await requireThemeRead(slug);
  if (!authz.ok) return authz.response;

  const theme = getTheme(slug);
  if (!theme) {
    return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  }

  const row = await getRecordById(id);
  if (!row || row.themeId !== theme.id) {
    return NextResponse.json({ error: "Registro no encontrado" }, { status: 404 });
  }

  const versions = await listRecordVersions(id);
  return NextResponse.json({
    recordId: id,
    currentVersion: versions[0]?.version || 0,
    versions,
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { slug, id } = await ctx.params;
  const authz = await requireThemeWrite(slug);
  if (!authz.ok) return authz.response;

  const theme = getTheme(slug);
  if (!theme) {
    return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  }

  const body = (await req.json()) as {
    values?: Record<string, unknown>;
    reason?: string;
  };

  try {
    let patch = body.values || {};
    // Puentes: el contrato solo se edita en la capa que lo origina.
    if (theme.id === "puentes") {
      patch = await sanitizePuentePatch(id, patch);
    }
    const result = await patchRecordWithVersion({
      theme,
      recordId: id,
      patch,
      userId: authz.actor.userId,
      reason: body.reason,
    });
    return NextResponse.json({
      ok: true,
      record: result.record,
      version: result.version,
      changedFields: result.changedFields,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al actualizar";
    const status = msg.includes("no encontrado") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
