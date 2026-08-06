/**
 * Admin: reimporta Puentes completo desde Excel (multipart field `file`).
 * Misma lógica que scripts/reimport-puentes.ts — para prod sin DATABASE_URL local.
 *
 * Form fields:
 *   file            — Excel (.xlsx)
 *   seedProcesos    — "1" | "true" para sembrar procesos huérfanos
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/session";
import { writeAudit } from "@/lib/records/repository";
import { runPuentesReimport } from "@/lib/uploads/puentes-reimport";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: Request) {
  const authz = await requireAdmin();
  if (!authz.ok) return authz.response;

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Adjunte el Excel en el campo file" },
      { status: 400 },
    );
  }

  const seedRaw = String(form.get("seedProcesos") || "").trim().toLowerCase();
  const seedProcesos = seedRaw === "1" || seedRaw === "true" || seedRaw === "yes";

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await runPuentesReimport({
      buffer,
      userId: authz.actor.userId,
      seedProcesos,
    });

    await writeAudit({
      userId: authz.actor.userId,
      action: "admin.puentes_reimport",
      entity: "records",
      entityId: "puentes",
      after: {
        fileName: file.name,
        seedProcesos,
        ...result,
        errorSample: result.errorSample.slice(0, 5),
      },
    });

    return NextResponse.json({
      ok: true,
      fileName: file.name,
      seedProcesos,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
