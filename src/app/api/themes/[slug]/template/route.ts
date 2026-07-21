import { NextResponse } from "next/server";
import { getTheme } from "@/themes";
import { requireThemeRead } from "@/lib/auth/session";
import { buildThemeTemplate } from "@/lib/excel/template";
import { upsertThemeCatalog } from "@/lib/records/repository";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const authz = await requireThemeRead(slug);
  if (!authz.ok) return authz.response;

  const theme = getTheme(slug);
  if (!theme) {
    return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  }

  await upsertThemeCatalog(theme);
  const buffer = await buildThemeTemplate(theme);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="plantilla_${theme.id}_v${theme.schemaVersion ?? 1}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
