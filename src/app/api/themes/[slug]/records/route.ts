import { NextResponse } from "next/server";
import { getTheme } from "@/themes";
import { requireThemeRead, requireThemeWrite } from "@/lib/auth/session";
import {
  getRecordsForTheme,
  insertValidatedRecords,
  upsertThemeCatalog,
  writeAudit,
} from "@/lib/records/repository";
import { validateRow } from "@/lib/validation/record-schema";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const authz = await requireThemeRead(slug);
  if (!authz.ok) return authz.response;

  const theme = getTheme(slug);
  if (!theme) {
    return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  }

  const rows = await getRecordsForTheme(theme.id);
  return NextResponse.json({
    themeId: theme.id,
    count: rows.length,
    records: rows,
    access: authz.access,
  });
}

export async function POST(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const authz = await requireThemeWrite(slug);
  if (!authz.ok) return authz.response;

  const theme = getTheme(slug);
  if (!theme) {
    return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  }

  await upsertThemeCatalog(theme);

  const body = (await req.json()) as { values?: Record<string, unknown> };
  const values = body.values || {};
  const result = validateRow(theme, values, 1);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Validación fallida", errors: result.errors },
      { status: 400 },
    );
  }

  const { inserted, duplicates } = await insertValidatedRecords({
    themeId: theme.id,
    items: [result.data],
    source: "form",
    userId: authz.actor.userId,
  });

  if (!inserted.length) {
    return NextResponse.json(
      {
        error: "Registro duplicado (misma huella de negocio ya existe)",
        duplicates,
      },
      { status: 409 },
    );
  }

  const row = inserted[0];
  await writeAudit({
    userId: authz.actor.userId,
    action: "record.create",
    entity: "records",
    entityId: row?.id,
    after: row,
  });

  return NextResponse.json({ ok: true, record: row }, { status: 201 });
}
