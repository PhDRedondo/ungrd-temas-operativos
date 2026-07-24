/**
 * Identidad visual UNGRD para reportes PDF (jsPDF).
 * Colores alineados a globals.css — no inventa datos.
 */
import { jsPDF } from "jspdf";

export const PDF_NAVY: [number, number, number] = [0, 45, 90];
export const PDF_NAVY_DEEP: [number, number, number] = [0, 26, 54];
export const PDF_YELLOW: [number, number, number] = [255, 209, 0];
export const PDF_MUTED: [number, number, number] = [100, 116, 139];
export const PDF_TEXT: [number, number, number] = [30, 41, 59];

export const PDF_MARGIN = 14;
/** Altura del encabezado (mm) incluyendo franja amarilla. */
export const PDF_HEADER_H = 38;

const LOGO_PUBLIC_PATH = "/branding/UNGRD-Vertical.png";

let cachedLogo: string | null | undefined;

/** Carga el logo UNGRD como data URL (cliente o servidor). */
export async function loadUngrdLogoDataUrl(): Promise<string | null> {
  if (cachedLogo !== undefined) return cachedLogo;
  try {
    if (typeof window !== "undefined") {
      const res = await fetch(LOGO_PUBLIC_PATH);
      if (!res.ok) {
        cachedLogo = null;
        return null;
      }
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      cachedLogo = dataUrl || null;
      return cachedLogo;
    }

    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const buf = await readFile(
      join(process.cwd(), "public", "branding", "UNGRD-Vertical.png"),
    );
    cachedLogo = `data:image/png;base64,${buf.toString("base64")}`;
    return cachedLogo;
  } catch {
    cachedLogo = null;
    return null;
  }
}

export type UngrdHeaderOpts = {
  title: string;
  subtitle?: string;
  generatedAt?: string | Date;
  criteriaVersion?: string;
  /** Logo data URL; si se omite se intenta cargar. */
  logoDataUrl?: string | null;
};

/** Dibuja banda navy + franja amarilla + logo + títulos. Devuelve Y de inicio del contenido. */
export async function drawUngrdHeader(
  doc: jsPDF,
  opts: UngrdHeaderOpts,
): Promise<number> {
  const pageW = doc.internal.pageSize.getWidth();
  const margin = PDF_MARGIN;
  const logo =
    opts.logoDataUrl !== undefined
      ? opts.logoDataUrl
      : await loadUngrdLogoDataUrl();

  doc.setFillColor(...PDF_NAVY_DEEP);
  doc.rect(0, 0, pageW, PDF_HEADER_H - 2, "F");
  doc.setFillColor(...PDF_YELLOW);
  doc.rect(0, PDF_HEADER_H - 2, pageW, 2, "F");

  let textLeft = margin;
  if (logo) {
    try {
      // Logo vertical compacto a la derecha del header
      const logoW = 12;
      const logoH = 16;
      doc.addImage(logo, "PNG", pageW - margin - logoW, 8, logoW, logoH);
    } catch {
      /* fallback texto */
    }
  }

  doc.setTextColor(...PDF_YELLOW);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("UNGRD · SNGRD", textLeft, 11);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  const titleLines = doc.splitTextToSize(
    opts.title,
    pageW - margin * 2 - (logo ? 16 : 0),
  );
  doc.text(titleLines, textLeft, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(200, 220, 240);
  const when =
    opts.generatedAt instanceof Date
      ? opts.generatedAt.toLocaleString("es-CO")
      : opts.generatedAt || new Date().toLocaleString("es-CO");
  const meta = [
    `Generado: ${when}`,
    opts.criteriaVersion ? `Criterios ${opts.criteriaVersion}` : "",
    opts.subtitle || "",
  ]
    .filter(Boolean)
    .join(" · ");
  const metaLines = doc.splitTextToSize(meta, pageW - margin * 2 - 16);
  doc.text(metaLines, textLeft, 30);

  return PDF_HEADER_H + 6;
}

export function drawUngrdFooter(
  doc: jsPDF,
  page: number,
  total: number,
  extra?: string,
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = PDF_MARGIN;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_MUTED);
  const left =
    extra ||
    "UNGRD · uso interno · solo datos cargados · no inventa métricas";
  doc.text(left, margin, pageH - 8);
  doc.text(`Pág. ${page}/${total}`, pageW - margin, pageH - 8, {
    align: "right",
  });
}

/** Aplica footer a todas las páginas del documento. */
export function stampFooters(doc: jsPDF, extra?: string) {
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    drawUngrdFooter(doc, i, total, extra);
  }
}

export function savePdf(doc: jsPDF, filename: string) {
  doc.save(filename);
}

export function pdfToArrayBuffer(doc: jsPDF): ArrayBuffer {
  return doc.output("arraybuffer") as ArrayBuffer;
}

export function ensureSpace(
  doc: jsPDF,
  y: number,
  needMm: number,
  bottomLimit = 272,
): number {
  if (y + needMm <= bottomLimit) return y;
  doc.addPage();
  return PDF_HEADER_H + 6;
}
