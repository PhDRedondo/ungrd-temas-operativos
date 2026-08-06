import { NextResponse } from "next/server";
import { getTheme } from "@/themes";
import { requireThemeRead } from "@/lib/auth/session";
import {
  findThemePuenteById,
  listThemePuentesByProceso,
  listThemeRecordsByPuenteAndCapa,
  searchThemePuentes,
  searchThemePuentesWithFacets,
} from "@/lib/records/puente-lookup";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * Búsqueda facetada de puentes (inventario).
 * Query: q, origen, proceso, departamento, municipio, tipo, configuracion,
 *        ubicacion, contrato · facets=1 devuelve opciones disponibles
 *        id + capa → exacto; id + capa + all=1 → historial capa
 */
export async function GET(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const authz = await requireThemeRead(slug);
  if (!authz.ok) return authz.response;

  const theme = getTheme(slug);
  if (!theme || theme.id !== "puentes") {
    return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  }

  const url = new URL(req.url);
  const exactId = (url.searchParams.get("id") || "").trim();
  const listAll = url.searchParams.get("all") === "1";
  const capa =
    url.searchParams.get("capa") ||
    theme.captureForms?.find(
      (f) => f.id === "inventario" || f.capa === "Inventario puente",
    )?.capa ||
    theme.captureForms?.find((f) => f.mode === "create-once")?.capa ||
    "Inventario puente";

  if (exactId) {
    if (listAll) {
      const hits = await listThemeRecordsByPuenteAndCapa({
        idPuente: exactId,
        capa,
        limit: 300,
      });
      return NextResponse.json({
        themeId: theme.id,
        capa,
        id: exactId,
        exact: true,
        all: true,
        found: hits.length > 0,
        count: hits.length,
        puentes: hits,
      });
    }
    const hit = await findThemePuenteById({ idPuente: exactId, capa });
    return NextResponse.json({
      themeId: theme.id,
      capa,
      id: exactId,
      exact: true,
      found: Boolean(hit),
      count: hit ? 1 : 0,
      puentes: hit ? [hit] : [],
    });
  }

  const proceso = (url.searchParams.get("proceso") || "").trim();
  const contrato = (url.searchParams.get("contrato") || "").trim();

  // Inventario / bitácora: todos los puentes del convenio o contrato (sin tope de búsqueda).
  const convenio = (url.searchParams.get("convenio") || "").trim();
  if (listAll && (proceso || contrato || convenio)) {
    const puentes = await listThemePuentesByProceso({
      proceso,
      contrato: contrato || convenio,
      capa,
      limit: 1000,
    });
    // Si vino convenio_o_cto y no coincidió por contrato, filtrar en memoria.
    const filtered =
      convenio && !contrato && !proceso
        ? puentes.filter(
            (p) =>
              p.convenio_o_cto.toLowerCase() === convenio.toLowerCase() ||
              p.contrato_convenio.toLowerCase() === convenio.toLowerCase() ||
              p.clave_proceso.toLowerCase() === convenio.toLowerCase(),
          )
        : puentes;
    return NextResponse.json({
      themeId: theme.id,
      capa,
      proceso: proceso || undefined,
      contrato: contrato || undefined,
      convenio: convenio || undefined,
      all: true,
      count: filtered.length,
      puentes: filtered,
    });
  }

  const withFacets = url.searchParams.get("facets") === "1";
  const searchParams = {
    q: url.searchParams.get("q") || "",
    origen: url.searchParams.get("origen") || "",
    proceso,
    convenio: url.searchParams.get("convenio") || "",
    departamento: url.searchParams.get("departamento") || "",
    municipio: url.searchParams.get("municipio") || "",
    tipo: url.searchParams.get("tipo") || "",
    configuracion: url.searchParams.get("configuracion") || "",
    ubicacion: url.searchParams.get("ubicacion") || "",
    contrato,
    capa,
    limit: Number(url.searchParams.get("limit") || 15) || 15,
  };

  if (withFacets) {
    const { puentes, facets } = await searchThemePuentesWithFacets(searchParams);
    return NextResponse.json({
      themeId: theme.id,
      capa,
      count: puentes.length,
      puentes,
      facets,
    });
  }

  const puentes = await searchThemePuentes(searchParams);

  return NextResponse.json({
    themeId: theme.id,
    capa,
    count: puentes.length,
    puentes,
  });
}
