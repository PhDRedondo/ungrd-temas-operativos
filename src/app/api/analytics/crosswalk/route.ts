import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/session";
import { SOURCE_THEME_IDS } from "@/lib/analytics/decision";
import {
  buildCrosswalk,
  isCrosswalkType,
} from "@/lib/analytics/crosswalk";
import { getRecordsForThemes } from "@/lib/records/repository";

export async function GET(req: Request) {
  const authz = await requireSession();
  if (!authz.ok) return authz.response;

  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "";
  const key = url.searchParams.get("key") || "";

  if (!isCrosswalkType(type)) {
    return NextResponse.json(
      {
        error: "type inválido (use op|placa|cdp|declaratoria)",
      },
      { status: 400 },
    );
  }
  if (!key.trim()) {
    return NextResponse.json({ error: "key requerido" }, { status: 400 });
  }

  try {
    const bundle = await getRecordsForThemes([...SOURCE_THEME_IDS]);
    const result = buildCrosswalk(bundle, type, key.trim());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[crosswalk]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Error en cruce",
      },
      { status: 500 },
    );
  }
}
