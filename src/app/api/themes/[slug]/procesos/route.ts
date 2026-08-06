import { NextResponse } from "next/server";
import { getTheme } from "@/themes";
import { requireThemeRead } from "@/lib/auth/session";
import {
  findThemeProcesoByClave,
  listThemeRecordsByProcesoAndCapa,
  searchThemeProcesos,
} from "@/lib/records/puente-lookup";

type Ctx = { params: Promise<{ slug: string }> };

/** Búsqueda de procesos contractuales (contrato/convenio). */
export async function GET(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const authz = await requireThemeRead(slug);
  if (!authz.ok) return authz.response;

  const theme = getTheme(slug);
  if (!theme || theme.id !== "puentes") {
    return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  }

  const url = new URL(req.url);
  const clave = (url.searchParams.get("clave") || "").trim();
  const contrato = (url.searchParams.get("contrato") || "").trim();
  const listAll = url.searchParams.get("all") === "1";
  const capa = url.searchParams.get("capa") || "Contrato estructuración";

  if (clave || contrato) {
    if (listAll) {
      const rows = await listThemeRecordsByProcesoAndCapa({
        claveProceso: clave,
        contratoConvenio: contrato,
        capa,
      });
      return NextResponse.json({
        themeId: theme.id,
        capa,
        clave,
        contrato,
        all: true,
        found: rows.length > 0,
        count: rows.length,
        procesos: rows,
      });
    }
    const hit = clave
      ? await findThemeProcesoByClave({ clave })
      : (await searchThemeProcesos({ q: contrato, limit: 1 }))[0] || null;
    return NextResponse.json({
      themeId: theme.id,
      capa,
      found: Boolean(hit),
      count: hit ? 1 : 0,
      procesos: hit ? [hit] : [],
    });
  }

  const procesos = await searchThemeProcesos({
    q: url.searchParams.get("q") || "",
    limit: Number(url.searchParams.get("limit") || 40) || 40,
    from:
      url.searchParams.get("from") === "inventario"
        ? "inventario"
        : "estructuracion",
  });

  return NextResponse.json({
    themeId: theme.id,
    count: procesos.length,
    procesos,
  });
}
