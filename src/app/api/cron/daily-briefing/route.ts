import { NextResponse } from "next/server";
import { SOURCE_THEME_IDS } from "@/lib/analytics/decision";
import { buildNationalBrief } from "@/lib/analytics/national";
import { nationalBriefingPdfBytes } from "@/lib/analytics/nationalBriefingPdf";
import { sendBriefingPdfEmail } from "@/lib/pdf/sendBriefingEmail";
import { formatCop, formatNumber } from "@/lib/records/types";
import { getRecordsForThemes } from "@/lib/records/repository";

function authorizeCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = req.headers.get("authorization") || "";
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

/**
 * Cron diario: genera briefing nacional PDF y lo envía por correo si hay config.
 * Protección: CRON_SECRET (Bearer o ?secret=).
 */
export async function GET(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const bundle = await getRecordsForThemes([...SOURCE_THEME_IDS]);
    const brief = buildNationalBrief(bundle);
    const pdf = await nationalBriefingPdfBytes(brief);
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `briefing_mando_nacional_${stamp}.pdf`;

    const mail = await sendBriefingPdfEmail({
      pdf,
      filename,
      subject: `UNGRD · Briefing nacional ${stamp}`,
      htmlBody: `
        <p><strong>UNGRD · Centro de Mando Nacional</strong></p>
        <p>${brief.briefing.headline}</p>
        <ul>
          ${brief.briefing.bullets.map((b) => `<li>${b}</li>`).join("")}
        </ul>
        <p>
          Registros: ${formatNumber(brief.totals.records)} ·
          Bases con dato: ${brief.totals.themesWithData} ·
          Dinero en riesgo (alertas): ${formatCop(brief.briefing.moneyAtRisk)}
        </p>
        <p style="color:#64748b;font-size:12px">
          Adjunto: briefing PDF con identidad UNGRD. Solo datos cargados; no inventa métricas.
        </p>
      `,
    });

    console.info("[cron/daily-briefing]", {
      records: brief.totals.records,
      mail,
      pdfBytes: pdf.byteLength,
    });

    return NextResponse.json({
      ok: true,
      generatedAt: brief.generatedAt,
      records: brief.totals.records,
      pdfBytes: pdf.byteLength,
      mail,
    });
  } catch (err) {
    console.error("[cron/daily-briefing]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Error en briefing diario",
      },
      { status: 500 },
    );
  }
}
