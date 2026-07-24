import { jsPDF } from "jspdf";
import type { NationalBrief } from "@/lib/analytics/national";
import { formatCop, formatNumber } from "@/lib/records/types";
import {
  drawUngrdHeader,
  PDF_MARGIN,
  PDF_MUTED,
  PDF_NAVY,
  PDF_TEXT,
  pdfToArrayBuffer,
  savePdf,
  stampFooters,
} from "@/lib/pdf/brand";

/** Construye el PDF nacional (1 página densa + footer). */
export async function buildNationalBriefingPdf(
  brief: NationalBrief,
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = PDF_MARGIN;
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - margin * 2;

  let y = await drawUngrdHeader(doc, {
    title: "Briefing ejecutivo nacional",
    subtitle: "Centro de Mando Nacional",
    generatedAt: brief.generatedAt,
    criteriaVersion: brief.criteriaVersion,
  });

  doc.setTextColor(...PDF_NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const head = doc.splitTextToSize(brief.briefing.headline, contentW);
  doc.text(head, margin, y);
  y += head.length * 5 + 4;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_TEXT);
  for (const kpi of brief.kpis) {
    doc.setFont("helvetica", "bold");
    doc.text(`${kpi.label}: `, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(kpi.value, margin + doc.getTextWidth(`${kpi.label}: `) + 1, y);
    y += 5;
  }
  y += 3;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_NAVY);
  doc.text("Puntos clave", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_TEXT);
  for (const b of brief.briefing.bullets) {
    const lines = doc.splitTextToSize(`• ${b}`, contentW);
    if (y + lines.length * 4.2 > 270) break;
    doc.text(lines, margin, y);
    y += lines.length * 4.2 + 1;
  }
  y += 3;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_NAVY);
  doc.text("Alertas prioritarias", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_TEXT);
  for (const a of brief.alerts.slice(0, 5)) {
    const block = doc.splitTextToSize(
      `[${a.severity.toUpperCase()}] ${a.title} — ${a.detail}${a.action ? ` | Acción: ${a.action}` : ""}`,
      contentW,
    );
    if (y + block.length * 4 > 270) break;
    doc.text(block, margin, y);
    y += block.length * 4 + 2;
  }
  y += 2;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_NAVY);
  doc.text("Top departamentos (presión)", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_TEXT);
  for (const d of brief.priorityDepts.slice(0, 8)) {
    if (y > 280) break;
    doc.text(
      `${d.departamento} · presión ${d.pressure} · ${formatCop(d.valorTotal)} · decl. ${d.declaratoriaAbierta} · interv. ${d.intervenciones}`,
      margin,
      y,
    );
    y += 4.5;
  }
  y += 2;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_NAVY);
  doc.text("Claves a desbloquear", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_TEXT);
  for (const k of brief.priorityKeys.slice(0, 8)) {
    if (y > 285) break;
    doc.text(
      `${k.label}${k.extra ? ` (${k.extra})` : ""} · ${formatCop(k.valor)}`,
      margin,
      y,
    );
    y += 4.5;
  }

  doc.setFontSize(7);
  doc.setTextColor(...PDF_MUTED);
  doc.text(
    `Registros: ${formatNumber(brief.totals.records)} · Bases: ${brief.totals.themesWithData} · Dinero en riesgo (alertas): ${formatCop(brief.briefing.moneyAtRisk)}`,
    margin,
    288,
  );

  stampFooters(doc);
  return doc;
}

/** Briefing de 1 página para el Director / liderazgo nacional. */
export async function downloadNationalBriefingPdf(brief: NationalBrief) {
  const doc = await buildNationalBriefingPdf(brief);
  savePdf(
    doc,
    `briefing_mando_nacional_${new Date().toISOString().slice(0, 10)}.pdf`,
  );
}

export async function nationalBriefingPdfBytes(
  brief: NationalBrief,
): Promise<ArrayBuffer> {
  const doc = await buildNationalBriefingPdf(brief);
  return pdfToArrayBuffer(doc);
}
