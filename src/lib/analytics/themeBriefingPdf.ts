/**
 * Briefing PDF ejecutivo por tema (DecisionBrief).
 * Solo lectura — no inventa métricas.
 */
import { jsPDF } from "jspdf";
import {
  DECISION_THRESHOLDS,
  type DecisionBrief,
} from "@/lib/analytics/decision";
import { formatCop, formatNumber } from "@/lib/records/types";
import {
  drawUngrdHeader,
  ensureSpace,
  PDF_MARGIN,
  PDF_MUTED,
  PDF_NAVY,
  PDF_TEXT,
  pdfToArrayBuffer,
  savePdf,
  stampFooters,
} from "@/lib/pdf/brand";

export type ThemeBriefingPdfInput = {
  themeId: string;
  themeName: string;
  brief: DecisionBrief;
  filterSummary: string;
  recordCount: number;
};

export async function buildThemeBriefingPdf(
  input: ThemeBriefingPdfInput,
): Promise<jsPDF> {
  const { brief, themeName, filterSummary, recordCount } = input;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = PDF_MARGIN;
  const pageW = doc.internal.pageSize.getWidth();
  const contentW = pageW - margin * 2;

  let y = await drawUngrdHeader(doc, {
    title: `Briefing · ${themeName}`,
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
  y += scope.length * 4 + 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_NAVY);
  const sub = doc.splitTextToSize(brief.subtitle, contentW);
  doc.text(sub, margin, y);
  y += sub.length * 4.5 + 4;

  // KPIs
  if (brief.kpis.length > 0) {
    y = ensureSpace(doc, y, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_NAVY);
    doc.text("Indicadores clave", margin, y);
    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(...PDF_TEXT);
    for (const kpi of brief.kpis) {
      y = ensureSpace(doc, y, 8);
      doc.setFont("helvetica", "bold");
      doc.text(`${kpi.label}: `, margin, y);
      const x = margin + doc.getTextWidth(`${kpi.label}: `) + 1;
      doc.setFont("helvetica", "normal");
      doc.text(kpi.value, x, y);
      y += 5;
      if (kpi.hint) {
        doc.setFontSize(7);
        doc.setTextColor(...PDF_MUTED);
        const hint = doc.splitTextToSize(kpi.hint, contentW);
        doc.text(hint, margin + 2, y);
        y += hint.length * 3.5 + 1;
        doc.setFontSize(9);
        doc.setTextColor(...PDF_TEXT);
      }
    }
    y += 3;
  }

  // Semáforo
  if (brief.semaphores.length > 0) {
    y = ensureSpace(doc, y, 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_NAVY);
    doc.text("Semáforo operativo", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...PDF_TEXT);
    for (const s of brief.semaphores) {
      y = ensureSpace(doc, y, 5);
      doc.text(
        `${s.label}: ${formatNumber(s.count)} · ${formatCop(s.valor)}`,
        margin,
        y,
      );
      y += 4.5;
    }
    y += 3;
  }

  // Alertas
  const alerts = brief.alerts.slice(0, 6);
  if (alerts.length > 0) {
    y = ensureSpace(doc, y, 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_NAVY);
    doc.text("Alertas y acciones", margin, y);
    y += 6;
    doc.setFontSize(8);
    doc.setTextColor(...PDF_TEXT);
    for (const a of alerts) {
      const block = `[${a.severity.toUpperCase()}] ${a.title} — ${a.detail}${
        a.action ? ` | Acción: ${a.action}` : ""
      }`;
      const lines = doc.splitTextToSize(block, contentW);
      y = ensureSpace(doc, y, lines.length * 3.8 + 2);
      doc.setFont("helvetica", "bold");
      doc.text(lines[0]!, margin, y);
      y += 3.8;
      if (lines.length > 1) {
        doc.setFont("helvetica", "normal");
        doc.text(lines.slice(1), margin, y);
        y += (lines.length - 1) * 3.8;
      }
      y += 2;
    }
    y += 2;
  }

  // Capas
  const layers = brief.byLayer.slice(0, 8);
  if (layers.length > 0) {
    y = ensureSpace(doc, y, 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_NAVY);
    doc.text("Distribución por capa / tipo", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_TEXT);
    for (const item of layers) {
      y = ensureSpace(doc, y, 5);
      doc.text(
        `${item.label}: ${formatNumber(item.count)} · ${formatCop(item.valor)}`,
        margin,
        y,
      );
      y += 4.2;
    }
    y += 3;
  }

  // Prioridades
  const priorities = brief.priorityList.slice(0, 10);
  if (priorities.length > 0) {
    y = ensureSpace(doc, y, 16);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_NAVY);
    doc.text(brief.focusLabel || "Prioridades", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_TEXT);
    priorities.forEach((item, idx) => {
      const line = `${idx + 1}. ${item.label}${
        item.extra ? ` — ${item.extra}` : ""
      } · ${formatCop(item.valor)}`;
      const lines = doc.splitTextToSize(line, contentW);
      y = ensureSpace(doc, y, lines.length * 3.8 + 1);
      doc.text(lines, margin, y);
      y += lines.length * 3.8 + 1;
    });
  }

  stampFooters(
    doc,
    `UNGRD · ${themeName} · solo lectura · criterios ${DECISION_THRESHOLDS.version}`,
  );
  return doc;
}

export async function downloadThemeBriefingPdf(input: ThemeBriefingPdfInput) {
  const doc = await buildThemeBriefingPdf(input);
  const stamp = new Date().toISOString().slice(0, 10);
  savePdf(doc, `briefing_${input.themeId}_${stamp}.pdf`);
}

export async function themeBriefingPdfBytes(
  input: ThemeBriefingPdfInput,
): Promise<ArrayBuffer> {
  const doc = await buildThemeBriefingPdf(input);
  return pdfToArrayBuffer(doc);
}
