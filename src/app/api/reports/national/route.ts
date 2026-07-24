import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { SOURCE_THEME_IDS } from "@/lib/analytics/decision";
import { buildNationalBrief } from "@/lib/analytics/national";
import { nationalBriefingPdfBytes } from "@/lib/analytics/nationalBriefingPdf";
import { getRecordsForThemes } from "@/lib/records/repository";

export async function POST() {
  const authz = await requireSession();
  if (!authz.ok) return authz.response;

  try {
    const bundle = await getRecordsForThemes([...SOURCE_THEME_IDS]);
    const brief = buildNationalBrief(bundle);
    const bytes = await nationalBriefingPdfBytes(brief);
    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="briefing_mando_nacional_${stamp}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[reports/national]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Error al generar briefing nacional",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return POST();
}
