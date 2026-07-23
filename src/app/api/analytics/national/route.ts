import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { SOURCE_THEME_IDS } from "@/lib/analytics/decision";
import { buildNationalBrief } from "@/lib/analytics/national";
import { getRecordsForThemes } from "@/lib/records/repository";

export async function GET() {
  const authz = await requireSession();
  if (!authz.ok) return authz.response;

  try {
    const bundle = await getRecordsForThemes([...SOURCE_THEME_IDS]);
    const brief = buildNationalBrief(bundle);
    return NextResponse.json({ ok: true, ...brief });
  } catch (err) {
    console.error("[national analytics]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Error al construir mando nacional",
      },
      { status: 500 },
    );
  }
}
