/**
 * Marcas de cambio / versiones por registro (resaltar celdas en vista Excel).
 */
import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { recordVersions } from "@/db/schema";
import { getTheme } from "@/themes";
import { requireThemeRead } from "@/lib/auth/session";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const authz = await requireThemeRead(slug);
  if (!authz.ok) return authz.response;

  const theme = getTheme(slug);
  if (!theme) {
    return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  }

  const rows = await db
    .select({
      recordId: recordVersions.recordId,
      version: recordVersions.version,
      changedFields: recordVersions.changedFields,
    })
    .from(recordVersions)
    .where(eq(recordVersions.themeId, theme.id))
    .orderBy(asc(recordVersions.recordId), asc(recordVersions.version));

  const marks: Record<
    string,
    { versionCount: number; maxVersion: number; changedFields: string[] }
  > = {};

  for (const r of rows) {
    const id = r.recordId;
    if (!marks[id]) {
      marks[id] = { versionCount: 0, maxVersion: 0, changedFields: [] };
    }
    const m = marks[id]!;
    m.versionCount += 1;
    m.maxVersion = Math.max(m.maxVersion, r.version);
    const fields = Array.isArray(r.changedFields)
      ? (r.changedFields as string[])
      : [];
    for (const f of fields) {
      if (f && !m.changedFields.includes(f)) m.changedFields.push(f);
    }
  }

  return NextResponse.json({
    themeId: theme.id,
    marks,
    count: Object.keys(marks).length,
  });
}
