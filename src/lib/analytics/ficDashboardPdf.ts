/**
 * PDF del resumen FIC: mismas secciones y la misma tabla operativa
 * que el tablero, sobre las filas ya filtradas.
 */
import { jsPDF } from "jspdf";
import type { DecisionBrief } from "@/lib/analytics/decision";
import { DECISION_THRESHOLDS } from "@/lib/analytics/decisionThresholds";
import { buildThemeTimeSeries, resolveEventDate } from "@/lib/analytics/timeSeries";
import { aggregateSpatial, resolveDepartment } from "@/lib/geo/spatial";
import {
  getThemeMapSemantics,
  resolveAutoMapMetric,
} from "@/lib/geo/themeMapSemantics";
import { formatCop, formatNumber, type RecordRow } from "@/lib/records/types";
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

const FIC_THEME = {
  id: "fic",
  name: "FIC",
  unit: "FIC",
  valueLabel: "Valor FIC (COP)",
};

type Col = {
  title: string;
  weight: number;
  align?: "right";
  danger?: boolean;
  value: (row: FicOperativeRow, index: number) => string;
};

const PLACE_COLUMNS: Col[] = [
  { title: "#", weight: 8, value: (_r, i) => String(i + 1) },
  { title: "Nº FIC", weight: 22, value: (r) => r.noCdp },
  { title: "Departamento", weight: 28, value: (r) => r.departamento },
  { title: "Municipio", weight: 26, value: (r) => r.municipio },
  { title: "Vigencia", weight: 16, value: (r) => r.vigencia },
  { title: "Estado", weight: 28, value: (r) => r.estado },
  { title: "Plazo ejecución", weight: 22, value: (r) => r.plazoEjecucion },
  { title: "Plazo adición", weight: 20, value: (r) => r.plazoAdicion },
  { title: "Plazo final", weight: 18, value: (r) => r.plazoFinal },
  {
    title: "Fecha vencimiento",
    weight: 26,
    danger: true,
    value: (r) => r.fechaVencimiento,
  },
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

const ACT_COLUMNS: Col[] = [
  { title: "Nº FIC", weight: 22, value: (r) => r.noCdp },
  { title: "Nº RC", weight: 16, value: (r) => r.noRc },
  { title: "Formato", weight: 36, value: (r) => r.formatoAprobacion },
  { title: "Acto admin.", weight: 40, value: (r) => r.acto },
  { title: "Acto 2", weight: 22, value: (r) => r.acto2 },
  { title: "Fecha acto", weight: 22, value: (r) => r.fechaActo },
  { title: "Fecha acto 2", weight: 22, value: (r) => r.fechaActo2 },
  { title: "Desembolso", weight: 22, value: (r) => r.fechaDesembolso },
  { title: "Fecha mod.", weight: 20, value: (r) => r.fechaModificacion },
  { title: "% avance", weight: 16, value: (r) => r.avancePct },
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
  records?: RecordRow[];
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
  y = drawVigencia(doc, brief, y, margin, contentW);
  if (input.records && input.records.length > 0) {
    y = drawPanelGraphics(doc, input.records, y, margin, contentW);
  }
  y = drawOperativeTable(
    doc,
    ficRows,
    y,
    margin,
    PLACE_COLUMNS,
    `Tabla operativa · ${formatNumber(ficRows.length)} FIC`,
    8,
  );
  drawOperativeTable(
    doc,
    ficRows,
    y,
    margin,
    ACT_COLUMNS,
    "Actos, formato y fechas",
    8,
  );

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
      leftY += 3.2;
      doc.setFillColor(226, 232, 240);
      doc.roundedRect(margin, leftY, leftW - 4, 3.2, 1, 1, "F");
      const bar: [number, number, number] =
        s.level === "rojo"
          ? [198, 40, 40]
          : s.level === "amarillo"
            ? [239, 108, 0]
            : s.level === "verde"
              ? [46, 125, 50]
              : [96, 125, 139];
      doc.setFillColor(...bar);
      doc.roundedRect(
        margin,
        leftY,
        Math.max(1.2, ((leftW - 4) * pct) / 100),
        3.2,
        1,
        1,
        "F",
      );
      leftY += 5;
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
  contentW: number,
): number {
  if (brief.byLayer.length === 0) return y;
  y = pageBreak(doc, y, 18);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_NAVY);
  doc.text("Distribución · Vigencia", margin, y);
  y += 5;
  const max = Math.max(...brief.byLayer.map((item) => item.valor || item.count), 1);
  const colors: [number, number, number][] = [
    PDF_NAVY,
    [255, 209, 0],
    [0, 105, 148],
    [239, 108, 0],
  ];
  brief.byLayer.forEach((item, i) => {
    y = pageBreak(doc, y, 8);
    const label = /^vigencia/i.test(item.label)
      ? item.label
      : `Vigencia ${item.label}`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_TEXT);
    doc.text(pdfSafe(label), margin, y + 3.2);
    const trackX = margin + 36;
    const trackW = contentW - 36 - 62;
    const amount = item.valor || item.count;
    doc.setFillColor(232, 238, 244);
    doc.roundedRect(trackX, y, trackW, 4.4, 0.8, 0.8, "F");
    doc.setFillColor(...(colors[i % colors.length] ?? PDF_NAVY));
    doc.roundedRect(
      trackX,
      y,
      Math.max(1.2, (trackW * amount) / max),
      4.4,
      0.8,
      0.8,
      "F",
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(
      pdfSafe(`${formatNumber(item.count)} · ${formatCop(item.valor)}`),
      trackX + trackW + 2,
      y + 3.2,
    );
    y += 7;
  });
  return y + 2;
}

function pageBreak(doc: jsPDF, y: number, need: number): number {
  if (y + need <= contentBottom(doc)) return y;
  doc.addPage("a3", "landscape");
  return PDF_MARGIN;
}

function heatRgb(intensity: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, intensity));
  return [
    Math.round(232 + (255 - 232) * t),
    Math.round(238 + (209 - 238) * t),
    Math.round(244 + (0 - 244) * t),
  ];
}

function shortMoney(n: number): string {
  if (!n) return "—";
  const m = Math.round(n / 1_000_000);
  return `${m}M`;
}

/** Barras, serie y calor: el mismo panel gráfico que ve el filtro. */
function drawPanelGraphics(
  doc: jsPDF,
  records: RecordRow[],
  y: number,
  margin: number,
  contentW: number,
): number {
  const sem = getThemeMapSemantics(FIC_THEME);
  const deptNames = [
    ...new Set(
      records
        .map((r) => resolveDepartment(String(r.departamento || ""))?.name)
        .filter((d): d is string => Boolean(d)),
    ),
  ];
  const onlyDept = deptNames.length === 1 ? deptNames[0] : undefined;
  const spatial = aggregateSpatial(records, { department: onlyDept });
  const useValor = spatial.metric === "valor" || spatial.areas.some((a) => a.valor > 0);
  const bars = spatial.areas
    .filter((a) => (useValor ? a.valor > 0 : a.count > 0))
    .slice(0, 10)
    .map((a) => ({
      name: a.name,
      value: useValor ? a.valor : a.count,
    }));

  if (bars.length > 0) {
    y = pageBreak(doc, y, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_NAVY);
    const barTitle = `Top ${onlyDept ? "municipios" : "departamentos"} (${sem.legendTitle(useValor ? "valor" : "count")})`;
    doc.text(pdfSafe(barTitle), margin, y);
    y += 4;
    const max = Math.max(...bars.map((b) => b.value), 1);
    const labelW = 36;
    for (const bar of bars) {
      y = pageBreak(doc, y, 7);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...PDF_TEXT);
      doc.text(pdfSafe(bar.name).slice(0, 22), margin, y + 3);
      const trackX = margin + labelW;
      const trackW = contentW - labelW - 28;
      doc.setFillColor(232, 238, 244);
      doc.roundedRect(trackX, y, trackW, 4.2, 0.8, 0.8, "F");
      doc.setFillColor(...PDF_NAVY);
      doc.roundedRect(
        trackX,
        y,
        Math.max(1.2, (trackW * bar.value) / max),
        4.2,
        0.8,
        0.8,
        "F",
      );
      doc.setFontSize(6.5);
      doc.text(
        useValor ? pdfSafe(formatCop(bar.value)) : formatNumber(bar.value),
        trackX + trackW + 1.5,
        y + 3,
      );
      y += 6;
    }
    y += 2;
  }

  const series = buildThemeTimeSeries(records, FIC_THEME, "auto", {
    window: "24",
  });
  const points = series.points.filter((p) => p.value > 0);
  if (points.length > 0) {
    y = pageBreak(doc, y, 28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_NAVY);
    doc.text(pdfSafe(series.title), margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_MUTED);
    const sub = doc.splitTextToSize(pdfSafe(series.subtitle), contentW);
    doc.text(sub.slice(0, 2), margin, y);
    y += sub.slice(0, 2).length * 3.2 + 2;
    const max = Math.max(...points.map((p) => p.value), 1);
    const gap = 1.2;
    const barW = Math.min(14, (contentW - gap * (points.length - 1)) / points.length);
    const chartH = 22;
    y = pageBreak(doc, y, chartH + 8);
    const base = y + chartH;
    points.forEach((p, i) => {
      const h = Math.max(0.8, (chartH * p.value) / max);
      const x = margin + i * (barW + gap);
      doc.setFillColor(...PDF_NAVY);
      doc.rect(x, base - h, barW, h, "F");
      doc.setFontSize(5);
      doc.setTextColor(...PDF_MUTED);
      doc.text(p.period.slice(2), x, base + 3, { angle: points.length > 10 ? 40 : 0 });
    });
    y = base + 8;
  }

  const heat = buildHeatmap(records);
  if (heat.months.length > 0 && heat.matrix.length > 0) {
    y = pageBreak(doc, y, 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...PDF_NAVY);
    doc.text(pdfSafe(heat.title), margin, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_MUTED);
    doc.text(pdfSafe(heat.hint), margin, y);
    y += 4;
    const labelW = 32;
    const cellW = Math.min(
      16,
      (contentW - labelW) / Math.max(heat.months.length, 1),
    );
    const cellH = 7;
    y = pageBreak(doc, y, cellH * (heat.matrix.length + 1) + 2);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(...PDF_MUTED);
    doc.text("Depto", margin, y + 4);
    heat.months.forEach((m, i) => {
      doc.text(m.slice(2), margin + labelW + i * cellW + 1, y + 4);
    });
    y += cellH;
    for (const row of heat.matrix) {
      y = pageBreak(doc, y, cellH + 1);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(...PDF_TEXT);
      doc.text(pdfSafe(row.dept).slice(0, 16), margin, y + 4.5);
      row.cells.forEach((cell, i) => {
        const x = margin + labelW + i * cellW;
        const intensity = cell.value / heat.max;
        doc.setFillColor(...heatRgb(intensity));
        doc.roundedRect(x, y, cellW - 0.8, cellH - 0.8, 0.6, 0.6, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5);
        doc.setTextColor(...(intensity > 0.55 ? PDF_NAVY_DEEP : PDF_MUTED));
        const label = heat.metric === "valor" ? shortMoney(cell.value) : cell.value ? formatNumber(cell.value) : "—";
        doc.text(label, x + 0.8, y + 4.2);
      });
      y += cellH;
    }
    y += 3;
  }

  return y;
}

function buildHeatmap(records: RecordRow[]): {
  months: string[];
  matrix: { dept: string; cells: { value: number }[] }[];
  max: number;
  metric: "valor" | "count";
  title: string;
  hint: string;
} {
  let months = Array.from(
    new Set(
      records
        .map((r) => resolveEventDate(r, "fic").slice(0, 7))
        .filter((m) => /^\d{4}-\d{2}/.test(m)),
    ),
  ).sort();
  if (months.length > 24) months = months.slice(-24);
  const depts = Array.from(
    new Set(
      records
        .map((r) => resolveDepartment(String(r.departamento || ""))?.name)
        .filter((d): d is string => Boolean(d)),
    ),
  ).slice(0, 10);
  const anyValor = records.some(
    (r) =>
      Number(r.valor || 0) > 0 &&
      !/^sin departamento$/i.test(String(r.departamento || "")),
  );
  const metric = resolveAutoMapMetric(FIC_THEME, anyValor);
  const sem = getThemeMapSemantics(FIC_THEME);
  const matrix = depts.map((dept) => ({
    dept,
    cells: months.map((m) => {
      const rows = records.filter(
        (r) =>
          resolveDepartment(String(r.departamento || ""))?.name === dept &&
          resolveEventDate(r, "fic").startsWith(m),
      );
      const value =
        metric === "valor"
          ? rows.reduce((s, r) => s + Number(r.valor || 0), 0)
          : rows.length;
      return { value };
    }),
  }));
  const max = Math.max(...matrix.flatMap((row) => row.cells.map((c) => c.value)), 1);
  return {
    months,
    matrix,
    max,
    metric,
    title: sem.heatmapTitle(metric),
    hint: "Color = Valor FIC (COP). Misma ventana que el panel (hasta 24 meses).",
  };
}

function drawOperativeTable(
  doc: jsPDF,
  rows: FicOperativeRow[],
  y: number,
  margin: number,
  columns: Col[],
  title: string,
  font: number,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const tableW = pageW - margin * 2;
  const weightSum = columns.reduce((a, c) => a + c.weight, 0);
  const widths = columns.map((c) => (c.weight / weightSum) * tableW);

  const paintHeader = (): number => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(font - 1);
    const headerLines = columns.map((c, i) => wrap(doc, c.title, widths[i]!));
    const headerH =
      Math.max(...headerLines.map((l) => l.length)) * (font * 0.45) + 2.4;
    if (y + headerH > contentBottom(doc)) {
      doc.addPage("a3", "landscape");
      y = PDF_MARGIN;
    }
    let x = margin;
    doc.setFillColor(...PDF_NAVY_DEEP);
    doc.rect(margin, y, tableW, headerH, "F");
    doc.setTextColor(...PDF_YELLOW);
    headerLines.forEach((lines, i) => {
      const align = columns[i]?.align;
      const tx = align === "right" ? x + widths[i]! - 1.2 : x + 1;
      doc.text(lines, tx, y + 3.2, {
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
  doc.text(pdfSafe(title), margin, y);
  y += 4;

  if (rows.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_MUTED);
    doc.text("No hay FIC en este filtro.", margin, y + 4);
    return y + 8;
  }

  y = paintHeader();

  rows.forEach((row, index) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(font);
    const cellLines = columns.map((c, i) =>
      wrap(doc, c.value(row, index), widths[i]!),
    );
    const rowH = Math.max(...cellLines.map((l) => l.length)) * (font * 0.42) + 2.2;
    if (y + rowH > contentBottom(doc)) {
      doc.addPage("a3", "landscape");
      y = PDF_MARGIN;
      y = paintHeader();
      doc.setFontSize(font);
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
      const col = columns[i]!;
      const danger = Boolean(col.danger && row.critico);
      doc.setTextColor(...(danger ? [198, 40, 40] : PDF_TEXT));
      doc.setFont("helvetica", danger || col.title === "Nº FIC" ? "bold" : "normal");
      doc.setFontSize(font);
      const tx = col.align === "right" ? x + widths[i]! - 1.2 : x + 1;
      doc.text(lines, tx, y + font * 0.45, {
        align: col.align === "right" ? "right" : "left",
      });
      x += widths[i]!;
    });
    y += rowH;
  });
  return y + 4;
}
