import { NextResponse } from "next/server";
import { requireThemeRead } from "@/lib/auth/session";
import {
  buildDecisionBrief,
  isSourceTheme,
} from "@/lib/analytics/decision";
import { enrichRecordsForDecision } from "@/lib/analytics/enrichRecords";
import {
  applyRecordFilters,
  EMPTY_RECORD_FILTERS,
  parseFiltersFromParams,
  summarizeFilters,
  type RecordFilterState,
} from "@/lib/analytics/recordFilters";
import { themeBriefingPdfBytes } from "@/lib/analytics/themeBriefingPdf";
import { getRecordsForTheme } from "@/lib/records/repository";
import { getTheme } from "@/lib/themes";

type Body = {
  themeId?: string;
  filters?: Partial<RecordFilterState>;
};

export async function POST(req: Request) {
  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const themeId = String(body.themeId || "").trim();
  if (!themeId) {
    return NextResponse.json({ error: "themeId requerido" }, { status: 400 });
  }

  const authz = await requireThemeRead(themeId);
  if (!authz.ok) return authz.response;

  const theme = getTheme(themeId);
  if (!theme) {
    return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  }

  try {
    const raw = await getRecordsForTheme(themeId);
    const enriched = isSourceTheme(themeId)
      ? enrichRecordsForDecision(raw)
      : raw;
    const filters: RecordFilterState = {
      ...EMPTY_RECORD_FILTERS,
      ...body.filters,
    };
    const thirdKey = theme.fields.some((f) => f.name === "tipo_registro")
      ? "tipo_registro"
      : "municipio";
    const filtered = applyRecordFilters(enriched, filters, {
      themeId,
      thirdKey,
    });
    const brief = buildDecisionBrief(themeId, filtered);
    const bytes = await themeBriefingPdfBytes({
      themeId,
      themeName: theme.name,
      brief,
      filterSummary: summarizeFilters(filters),
      recordCount: filtered.length,
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="briefing_${themeId}_${stamp}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[reports/theme]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Error al generar briefing PDF",
      },
      { status: 500 },
    );
  }
}

/** GET con query params de filtros (alternativa a POST). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const themeId = url.searchParams.get("themeId") || "";
  if (!themeId) {
    return NextResponse.json({ error: "themeId requerido" }, { status: 400 });
  }

  const authz = await requireThemeRead(themeId);
  if (!authz.ok) return authz.response;

  const theme = getTheme(themeId);
  if (!theme) {
    return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  }

  try {
    const raw = await getRecordsForTheme(themeId);
    const enriched = isSourceTheme(themeId)
      ? enrichRecordsForDecision(raw)
      : raw;
    const filters = parseFiltersFromParams(url.searchParams);
    const thirdKey = theme.fields.some((f) => f.name === "tipo_registro")
      ? "tipo_registro"
      : "municipio";
    const filtered = applyRecordFilters(enriched, filters, {
      themeId,
      thirdKey,
    });
    const brief = buildDecisionBrief(themeId, filtered);
    const bytes = await themeBriefingPdfBytes({
      themeId,
      themeName: theme.name,
      brief,
      filterSummary: summarizeFilters(filters),
      recordCount: filtered.length,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="briefing_${themeId}_${stamp}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[reports/theme GET]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Error al generar briefing PDF",
      },
      { status: 500 },
    );
  }
}
