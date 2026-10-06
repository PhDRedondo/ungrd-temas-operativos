/**
 * PDF del resumen FIC: mismas secciones y la misma tabla operativa
 * que el tablero, sobre las filas ya filtradas.
 */
import { jsPDF } from "jspdf";
import type { DecisionBrief } from "@/lib/analytics/decision";
import { DECISION_THRESHOLDS } from "@/lib/analytics/decisionThresholds";
import { formatCop, formatNumber } from "@/lib/records/types";
import {
  drawUngrdHeader,
  PDF_MARGIN,
  PDF_MUTED,
  PDF_NAVY,
  PDF_NAVY_DEEP,
  PDF_TEXT,
  PDF_YELLOW,
  pdfSafe,
  stampFooters,
} from "@/lib/pdf/brand";
import type { FicOperativeRow } from "@/themes/fic/dashboard";

type Col = {
  title: string;
  weight: number;
  align?: "right";
  danger?: boolean;
  value: (row: FicOperativeRow, index: number) => string;
};

const COLUMNS: Col[] = [
  { title: "#", weight: 8, value: (_r, i) => String(i + 1) },
  { title: "Nº FIC", weight: 22, value: (r) => r.noCdp },
  { title: "Departamento", weight: 24, value: (r) => r.departamento },
  { title: "Municipio", weight: 22, value: (r) => r.municipio },
  { title: "Vigencia", weight: 16, value: (r) => r.vigencia },
  { title: "Estado", weight: 28, value: (r) => r.estado },
  { title: "Plazo ejecución", weight: 18, value: (r) => r.plazoEjecucion },
  { title: "Plazo adición", weight: 18, value: (r) => r.plazoAdicion },
  { title: "Plazo final", weight: 16, value: (r) => r.plazoFinal },
  {
    title: "Fecha vencimiento",
    weight: 22,
    danger: true,
    value: (r) => r.fechaVencimiento,
  },
  { title: "Nº RC", weight: 14, value: (r) => r.noRc },
  { title: "Formato", weight: 28, value: (r) => r.formatoAprobacion },
  { title: "Acto admin.", weight: 30, value: (r) => r.acto },
  { title: "Acto 2", weight: 18, value: (r) => r.acto2 },
  { title: "Fecha acto", weight: 20, value: (r) => r.fechaActo },
  { title: "Fecha acto 2", weight: 20, value: (r) => r.fechaActo2 },
  { title: "Desembolso", weight: 20, value: (r) => r.fechaDesembolso },
  { title: "Fecha mod.", weight: 18, value: (r) => r.fechaModificacion },
  { title: "% avance", weight: 14, value: (r) => r.avancePct },
  {
    title: "Valor desembolso",
    weight: 32,
    align: "right",
    value: (r) => formatCop(r.valor),
  },
  {
    title: "Por legalizar",
    weight: 32,
    align: "right",
    value: (r) => formatCop(r.porLegalizar),
  },
];

function wrap(doc: jsPDF, text: string, width: number): string[] {
  const lines = doc.splitTextToSize(pdfSafe(text), Math.max(4, width - 1.6));
  return lines.length ? lines : ["—"];
}

function contentBottom(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight() - 12;
}

export async function buildFicDashboardPdf(input: {
  themeName: string;
  brief: DecisionBrief;
  filterSummary: string;
  recordCount: number;
  ficRows: FicOperativeRow[];
}): Promise<jsPDF> {
  const { brief, ficRows, recordCount } = input;
  const filterSummary = pdfSafe(input.filterSummary);
  const doc = new jsPDF({
    unit: "mm",
    format: "a3",
    orientation: "landscape",
  });
  const margin = PDF_MARGIN;
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - margin * 2;

  let y = await drawUngrdHeader(doc, {
    title: `Briefing · ${input.themeName}`,
    subtitle: brief.title,
    generatedAt: new Date(),
    criteriaVersion: DECISION_THRESHOLDS.version,
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_MUTED);
  const scope = doc.splitTextToSize(
    `${formatNumber(recordCount)} registros · ${filterSummary}`,
    contentW,
  );
  doc.text(scope, margin, y);
  y += scope.length * 3.6 + 3;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_NAVY);
  const sub = doc.splitTextToSize(pdfSafe(brief.subtitle), contentW);
  doc.text(sub, margin, y);
  y += sub.length * 4.2 + 4;

  y = drawKpis(doc, brief, y, margin, contentW);
  y = drawSemaphoreAndAlerts(doc, brief, y, margin, contentW);
  y = drawVigencia(doc, brief, y, margin);
  drawOperativeTable(doc, ficRows, y, margin);

  stampFooters(
    doc,
    `UNGRD · ${input.themeName} · tablero filtrado · criterios ${DECISION_THRESHOLDS.version}`,
  );
  return doc;
}

function drawKpis(
  doc: jsPDF,
  brief: DecisionBrief,
  y: number,
  margin: number,
  contentW: number,
): number {
  if (brief.kpis.length === 0) return y;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_NAVY);
  doc.text("Indicadores clave", margin, y);
  y += 4;
  const gap = 3;
  const boxW = (contentW - gap * (brief.kpis.length - 1)) / brief.kpis.length;
  const boxH = 18;
  brief.kpis.forEach((kpi, i) => {
    const x = margin + i * (boxW + gap);
    doc.setFillColor(245, 247, 250);
    doc.setDrawColor(210, 218, 228);
    doc.roundedRect(x, y, boxW, boxH, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_MUTED);
    doc.text(pdfSafe(kpi.label).toUpperCase(), x + 2, y + 4.5);
    doc.setFontSize(11);
    doc.setTextColor(...toneRgb(kpi.tone));
    doc.text(pdfSafe(kpi.value), x + 2, y + 10);
    if (kpi.hint) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...PDF_MUTED);
      const hint = doc.splitTextToSize(pdfSafe(kpi.hint), boxW - 4);
      doc.text(hint.slice(0, 2), x + 2, y + 14);
    }
  });
  return y + boxH + 6;
}

function toneRgb(
  tone: DecisionBrief["kpis"][number]["tone"],
): [number, number, number] {
  if (tone === "rojo") return [198, 40, 40];
  if (tone === "amarillo") return [230, 81, 0];
  if (tone === "verde") return [46, 125, 50];
  return PDF_NAVY_DEEP;
}

function drawSemaphoreAndAlerts(
  doc: jsPDF,
  brief: DecisionBrief,
  y: number,
  margin: number,
  contentW: number,
): number {
  const gap = 6;
  const leftW = contentW * 0.38;
  const rightX = margin + leftW + gap;
  const rightW = contentW - leftW - gap;
  let leftY = y;
  let rightY = y;

  if (brief.semaphores.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_NAVY);
    doc.text("Estado de legalización", margin, leftY);
    leftY += 5;
    const total = brief.semaphores.reduce((a, s) => a + s.count, 0) || 1;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_TEXT);
    for (const s of brief.semaphores) {
      const pct = Math.round((s.count / total) * 100);
      doc.setFont("helvetica", "bold");
      doc.text(
        pdfSafe(`${s.label}: ${formatNumber(s.count)} · ${pct}%`),
        margin,
        leftY,
      );
      leftY += 3.6;
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...PDF_MUTED);
      doc.text(`Valor asociado: ${pdfSafe(formatCop(s.valor))}`, margin + 2, leftY);
      leftY += 5;
      doc.setTextColor(...PDF_TEXT);
    }
  }

  const alerts = brief.alerts.slice(0, 6);
  if (alerts.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_NAVY);
    doc.text("Alertas", rightX, rightY);
    rightY += 5;
    for (const a of alerts) {
      const money =
        a.valor != null ? ` · ${pdfSafe(formatCop(a.valor))}` : "";
      const count = a.count != null ? ` · ${formatNumber(a.count)} casos` : "";
      const head = `[${a.severity.toUpperCase()}] ${a.title}${count}${money}`;
      const body = `${a.detail}${a.action ? ` Qué hacer: ${a.action}` : ""}`;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(...PDF_TEXT);
      const headLines = doc.splitTextToSize(pdfSafe(head), rightW);
      doc.text(headLines, rightX, rightY);
      rightY += headLines.length * 3.4 + 0.6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...PDF_MUTED);
      const bodyLines = doc.splitTextToSize(pdfSafe(body), rightW);
      doc.text(bodyLines, rightX, rightY);
      rightY += bodyLines.length * 3.2 + 2.4;
      doc.setTextColor(...PDF_TEXT);
    }
  }

  return Math.max(leftY, rightY) + 2;
}

function drawVigencia(
  doc: jsPDF,
  brief: DecisionBrief,
  y: number,
  margin: number,
): number {
  if (brief.byLayer.length === 0) return y;
  if (y > contentBottom(doc) - 16) {
    doc.addPage("a3", "landscape");
    y = PDF_MARGIN;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_NAVY);
  doc.text(pdfSafe(brief.layerLabel || "Por vigencia"), margin, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_TEXT);
  for (const item of brief.byLayer) {
    const label = /^vigencia/i.test(item.label)
      ? item.label
      : `Vigencia ${item.label}`;
    doc.text(
      pdfSafe(
        `${label}: ${formatNumber(item.count)} · ${formatCop(item.valor)}`,
      ),
      margin,
      y,
    );
    y += 4.2;
  }
  return y + 3;
}

function drawOperativeTable(
  doc: jsPDF,
  rows: FicOperativeRow[],
  y: number,
  margin: number,
): void {
  const pageW = doc.internal.pageSize.getWidth();
  const tableW = pageW - margin * 2;
  const weightSum = COLUMNS.reduce((a, c) => a + c.weight, 0);
  const widths = COLUMNS.map((c) => (c.weight / weightSum) * tableW);

  const paintHeader = (): number => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.6);
    const headerLines = COLUMNS.map((c, i) => wrap(doc, c.title, widths[i]!));
    const headerH =
      Math.max(...headerLines.map((l) => l.length)) * 2.5 + 2.2;
    if (y + headerH > contentBottom(doc)) {
      doc.addPage("a3", "landscape");
      y = PDF_MARGIN;
    }
    let x = margin;
    doc.setFillColor(...PDF_NAVY_DEEP);
    doc.rect(margin, y, tableW, headerH, "F");
    doc.setTextColor(...PDF_YELLOW);
    headerLines.forEach((lines, i) => {
      const align = COLUMNS[i]?.align;
      const tx =
        align === "right" ? x + widths[i]! - 1 : x + 0.8;
      doc.text(lines, tx, y + 2.8, {
        align: align === "right" ? "right" : "left",
      });
      x += widths[i]!;
    });
    y += headerH;
    return y;
  };

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_NAVY);
  if (y > contentBottom(doc) - 20) {
    doc.addPage("a3", "landscape");
    y = PDF_MARGIN;
  }
  doc.text(`Tabla operativa · ${formatNumber(rows.length)} FIC`, margin, y);
  y += 4;

  if (rows.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_MUTED);
    doc.text("No hay FIC en este filtro.", margin, y + 4);
    return;
  }

  y = paintHeader();
  doc.setFontSize(5.8);

  rows.forEach((row, index) => {
    doc.setFont("helvetica", "normal");
    const cellLines = COLUMNS.map((c, i) =>
      wrap(doc, c.value(row, index), widths[i]!),
    );
    const rowH = Math.max(...cellLines.map((l) => l.length)) * 2.6 + 1.8;
    if (y + rowH > contentBottom(doc)) {
      doc.addPage("a3", "landscape");
      y = PDF_MARGIN;
      y = paintHeader();
    }
    const fill: [number, number, number] = row.critico
      ? [255, 228, 225]
      : index % 2
        ? [245, 247, 250]
        : [255, 255, 255];
    doc.setFillColor(...fill);
    doc.rect(margin, y, tableW, rowH, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, tableW, rowH, "S");

    let x = margin;
    cellLines.forEach((lines, i) => {
      const col = COLUMNS[i]!;
      const danger = Boolean(col.danger && row.critico);
      doc.setTextColor(...(danger ? [198, 40, 40] : PDF_TEXT));
      doc.setFont("helvetica", danger || i === 1 ? "bold" : "normal");
      const tx = col.align === "right" ? x + widths[i]! - 1 : x + 0.8;
      doc.text(lines, tx, y + 2.6, {
        align: col.align === "right" ? "right" : "left",
      });
      x += widths[i]!;
    });
    y += rowH;
  });
}
