import { NextResponse } from "next/server";
import { getTheme } from "@/themes";
import { requireThemeWrite } from "@/lib/auth/session";
import { restoreRecordVersion } from "@/lib/records/versions";

type Ctx = {
  params: Promise<{ slug: string; id: string }>;
};

export async function POST(req: Request, ctx: Ctx) {
  const { slug, id } = await ctx.params;
  const authz = await requireThemeWrite(slug);
  if (!authz.ok) return authz.response;

  const theme = getTheme(slug);
  if (!theme) {
    return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  }

  const body = (await req.json()) as { version?: number };
  const version = Number(body.version);
  if (!Number.isFinite(version) || version < 1) {
    return NextResponse.json(
      { error: "Indique version (número ≥ 1)" },
      { status: 400 },
    );
  }

  try {
    const result = await restoreRecordVersion({
      theme,
      recordId: id,
      version,
      userId: authz.actor.userId,
    });
    return NextResponse.json({
      ok: true,
      record: result.record,
      version: result.version,
      restoredFrom: version,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al restaurar";
    const status = msg.includes("no encontrad") ? 404 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
}
