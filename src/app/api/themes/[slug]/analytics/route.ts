import { NextResponse } from "next/server";
import { getTheme } from "@/themes";
import { requireThemeRead } from "@/lib/auth/session";
import { getThemeAggregates } from "@/lib/records/repository";
import { GEO_SOURCE } from "@/lib/geo";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const authz = await requireThemeRead(slug);
  if (!authz.ok) return authz.response;

  const theme = getTheme(slug);
  if (!theme) {
    return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  }

  const aggregates = await getThemeAggregates(theme.id);
  return NextResponse.json({
    themeId: theme.id,
    geo: GEO_SOURCE,
    ...aggregates,
  });
}
