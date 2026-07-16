import { jsPDF } from "jspdf";
import type { ThemeConfig } from "@/lib/themes";
import { formatCop, type RecordRow } from "@/lib/data";
import { resolveLocation } from "@/lib/geo";

const NAVY: [number, number, number] = [0, 45, 90];
const NAVY_DEEP: [number, number, number] = [0, 26, 54];
const YELLOW: [number, number, number] = [255, 209, 0];
const MUTED: [number, number, number] = [100, 116, 139];
const TEXT: [number, number, number] = [15, 23, 42];
const LINE: [number, number, number] = [226, 232, 240];

function formatValue(name: string, value: string | number): string {
  if (name === "valor" || (typeof value === "number" && name.includes("valor"))) {
    return formatCop(Number(value));
  }
  return String(value);
}

export function downloadRecordPdf(theme: ThemeConfig, record: RecordRow) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  const contentW = pageW - margin * 2;
  let y = 0;

  // Header band
  doc.setFillColor(...NAVY_DEEP);
  doc.rect(0, 0, pageW, 42, "F");
  doc.setFillColor(...YELLOW);
  doc.rect(0, 42, pageW, 2.2, "F");

  doc.setTextColor(...YELLOW);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("UNGRD · SNGRD", margin, 12);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.text("Detalle del registro", margin, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(200, 220, 240);
  const themeLine = doc.splitTextToSize(theme.name, contentW - 40);
  doc.text(themeLine, margin, 29);

  doc.setFont("courier", "normal");
  doc.setFontSize(9);
  doc.setTextColor(255, 209, 0);
  doc.text(String(record.id), pageW - margin, 22, { align: "right" });

  y = 52;

  // Summary chips
  const chips = [
    `Estado: ${record.estado}`,
    `Fecha: ${record.fecha}`,
    `Valor: ${formatCop(Number(record.valor || 0))}`,
  ];
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  let chipX = margin;
  for (const chip of chips) {
    const tw = doc.getTextWidth(chip) + 8;
    if (chipX + tw > pageW - margin) {
      chipX = margin;
      y += 9;
    }
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(chipX, y - 4.5, tw, 7.5, 1.5, 1.5, "F");
    doc.setTextColor(...NAVY);
    doc.text(chip, chipX + 4, y);
    chipX += tw + 3;
  }
  y += 12;

  // Attributes
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("Atributos del registro", margin, y);
  y += 3;
  doc.setDrawColor(...YELLOW);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin + 28, y);
  y += 8;

  const entries = theme.fields
    .map((f) => ({
      label: f.label,
      name: f.name,
      value: record[f.name],
    }))
    .filter((e) => e.value !== undefined && e.value !== "");

  const ensureSpace = (need: number) => {
    if (y + need > pageH - 22) {
      doc.addPage();
      y = margin;
    }
  };

  for (const e of entries) {
    const valueText = formatValue(e.name, e.value as string | number);
    const valueLines = doc.splitTextToSize(valueText, contentW - 4);
    const blockH = 6 + valueLines.length * 4.2 + 3;
    ensureSpace(blockH);

    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.roundedRect(margin, y - 3, contentW, blockH, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(e.label.toUpperCase(), margin + 2.5, y + 1);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT);
    doc.text(valueLines, margin + 2.5, y + 6);

    y += blockH + 2.5;
  }

  // Location
  y += 4;
  ensureSpace(36);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...NAVY);
  doc.text("Ubicación geográfica", margin, y);
  y += 3;
  doc.setDrawColor(...YELLOW);
  doc.setLineWidth(0.8);
  doc.line(margin, y, margin + 28, y);
  y += 8;

  const location = resolveLocation(
    String(record.departamento),
    String(record.municipio),
  );

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...LINE);
  doc.roundedRect(margin, y - 3, contentW, location ? 22 : 14, 1.5, 1.5, "FD");

  if (location) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...TEXT);
    doc.text(location.label, margin + 2.5, y + 3);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(
      `Coordenadas: ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}`,
      margin + 2.5,
      y + 9,
    );
    doc.text(
      `Nivel de resolución: ${location.level}`,
      margin + 2.5,
      y + 14.5,
    );
    y += 26;
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(
      "Sin coordenadas asociadas en el catálogo geográfico.",
      margin + 2.5,
      y + 4,
    );
    y += 16;
  }

  // Footer on all pages
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFillColor(...NAVY);
    doc.rect(0, pageH - 12, pageW, 12, "F");
    doc.setFillColor(...YELLOW);
    doc.rect(0, pageH - 12, pageW, 1.2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(
      "Unidad Nacional para la Gestión del Riesgo de Desastres · Uso institucional",
      margin,
      pageH - 5,
    );
    doc.text(`Pág. ${i}/${total}`, pageW - margin, pageH - 5, {
      align: "right",
    });
  }

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`${theme.id}_${record.id}_${stamp}.pdf`);
}
