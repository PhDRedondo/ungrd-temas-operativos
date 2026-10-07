/**
 * Smoke: briefing PDF por tema y nacional (sin BD).
 */
import assert from "node:assert/strict";
import { buildDecisionBrief } from "../src/lib/analytics/decision";
import { buildNationalBrief } from "../src/lib/analytics/national";
import { buildThemeBriefingPdf } from "../src/lib/analytics/themeBriefingPdf";
import { buildFicOperativeRows } from "../src/themes/fic/dashboard";
import { buildNationalBriefingPdf } from "../src/lib/analytics/nationalBriefingPdf";
import { loadUngrdLogoDataUrl } from "../src/lib/pdf/brand";
import {
  summarizeFilters,
  EMPTY_RECORD_FILTERS,
} from "../src/lib/analytics/recordFilters";
import type { RecordRow } from "../src/lib/records/types";

async function main() {
  const row: RecordRow = {
    id: "t1",
    departamento: "La Guajira",
    municipio: "Riohacha",
    estado: "En ejecución",
    valor: 1_000_000,
    fecha: "2025-06-01",
    clave_seguimiento: "SMD-1",
    tipo_registro: "Bitácora",
    capa: "Bitácora",
  } as RecordRow;

  const brief = buildDecisionBrief("agua-y-saneamiento", [row]);
  assert.ok(brief.kpis.length >= 0);

  const logo = await loadUngrdLogoDataUrl();
  assert.ok(logo === null || logo.startsWith("data:image/"));

  const themeDoc = await buildThemeBriefingPdf({
    themeId: "agua-y-saneamiento",
    themeName: "Agua y saneamiento",
    brief,
    filterSummary: summarizeFilters({
      ...EMPTY_RECORD_FILTERS,
      departamento: "La Guajira",
    }),
    recordCount: 1,
  });
  assert.equal(themeDoc.getNumberOfPages() >= 1, true);
  const themeBuf = themeDoc.output("arraybuffer");
  assert.ok((themeBuf as ArrayBuffer).byteLength > 500);

  const national = buildNationalBrief({
    "agua-y-saneamiento": [row],
    fic: [],
    carrotanques: [],
    "banco-de-maquinaria": [],
    "obras-de-emergencia": [],
    "obras-por-impuestos": [],
    puentes: [],
    "declaratoria-de-emergencia": [],
  });
  const natDoc = await buildNationalBriefingPdf(national);
  assert.equal(natDoc.getNumberOfPages() >= 1, true);

  const ficRowsRaw: RecordRow[] = [
    {
      id: "a",
      no_cdp: "25-1446",
      departamento: "Chocó",
      municipio: "Istmina",
      vigencia: "2025",
      estado: "EN EJECUCIÓN",
      valor: 1_000_000_000,
      valor_por_legalizar: 1_000_000_000,
      plazo_ejecucion_dias: 180,
      plazo_adicion_dias: 60,
      fecha_inicial_para_legalizacion: "2025-12-12",
      fecha: "2025-12-12",
    } as RecordRow,
    {
      id: "b",
      no_cdp: "240161",
      departamento: "Chocó",
      municipio: "Quibdó",
      vigencia: "2024",
      estado: "ANULADO",
      valor: 0,
      valor_por_legalizar: 0,
      fecha: "2026-09-13",
    } as RecordRow,
  ];
  const ficBrief = buildDecisionBrief("fic", ficRowsRaw);
  const ficDoc = await buildThemeBriefingPdf({
    themeId: "fic",
    themeName: "FIC",
    brief: ficBrief,
    filterSummary: summarizeFilters({
      ...EMPTY_RECORD_FILTERS,
      departamento: "Chocó",
      from: "2022-01-01",
      to: "2026-10-06",
    }),
    recordCount: ficRowsRaw.length,
    ficRows: buildFicOperativeRows(ficRowsRaw),
    records: ficRowsRaw,
  });
  const ficText = Buffer.from(ficDoc.output("arraybuffer")).toString("latin1");
  assert.ok(ficText.includes("25-1446"), "incluye el FIC en ejecución");
  assert.ok(ficText.includes("240161"), "incluye el FIC anulado del filtro");
  assert.ok(ficText.includes("Tabla operativa"));
  assert.ok(ficText.includes("Calor"), "incluye el mapa de calor del panel");
  assert.ok(ficText.includes("2022-01-01 a 2026-10-06"), "la flecha del filtro se lee en el PDF");
  assert.equal(ficDoc.internal.pageSize.getWidth() > ficDoc.internal.pageSize.getHeight(), true);

  console.log("test-theme-briefing-pdf: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
