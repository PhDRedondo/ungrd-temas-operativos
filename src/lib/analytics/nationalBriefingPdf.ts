import { jsPDF } from "jspdf";
import type { NationalBrief } from "@/lib/analytics/national";
import { formatCop, formatNumber } from "@/lib/records/types";

const NAVY: [number, number, number] = [0, 45, 90];
const NAVY_DEEP: [number, number, number] = [0, 26, 54];
const YELLOW: [number, number, number] = [255, 209, 0];

/** Briefing de 1 página para el Director / liderazgo nacional. */
export function downloadNationalBriefingPdf(brief: NationalBrief) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentW = pageW - margin * 2;
  let y = 0;

  doc.setFillColor(...NAVY_DEEP);
  doc.rect(0, 0, pageW, 36, "F");
  doc.setFillColor(...YELLOW);
  doc.rect(0, 36, pageW, 2, "F");

  doc.setTextColor(...YELLOW);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("UNGRD · Centro de Mando Nacional", margin, 12);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text("Briefing ejecutivo", margin, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 220, 240);
  doc.text(
    `Generado: ${new Date(brief.generatedAt).toLocaleString("es-CO")} · Criterios ${brief.criteriaVersion}`,
    margin,
    30,
  );

  y = 46;
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const head = doc.splitTextToSize(brief.briefing.headline, contentW);
  doc.text(head, margin, y);
  y += head.length * 5 + 4;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  for (const kpi of brief.kpis) {
    doc.setFont("helvetica", "bold");
    doc.text(`${kpi.label}: `, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(kpi.value, margin + doc.getTextWidth(`${kpi.label}: `) + 1, y);
    y += 5;
  }
  y += 3;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("Puntos clave", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  for (const b of brief.briefing.bullets) {
    const lines = doc.splitTextToSize(`• ${b}`, contentW);
    if (y + lines.length * 4.2 > 270) break;
    doc.text(lines, margin, y);
    y += lines.length * 4.2 + 1;
  }
  y += 3;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("Alertas prioritarias", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(30, 41, 59);
  for (const a of brief.alerts.slice(0, 5)) {
    const block = doc.splitTextToSize(
      `[${a.severity.toUpperCase()}] ${a.title} — ${a.detail}${a.action ? ` | Qué hacer: ${a.action}` : ""}`,
      contentW,
    );
    if (y + block.length * 4 > 270) break;
    doc.text(block, margin, y);
    y += block.length * 4 + 2;
  }
  y += 2;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...NAVY);
  doc.text("Top departamentos (presión)", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
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
  doc.setTextColor(...NAVY);
  doc.text("Claves a desbloquear", margin, y);
  y += 6;
  doc.setFont("helvetica", "normal");
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
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Registros: ${formatNumber(brief.totals.records)} · Bases: ${brief.totals.themesWithData} · Dinero en riesgo (alertas): ${formatCop(brief.briefing.moneyAtRisk)}`,
    margin,
    290,
  );

  doc.save(`briefing_mando_nacional_${new Date().toISOString().slice(0, 10)}.pdf`);
}
