/**
 * Smoke: briefing PDF por tema y nacional (sin BD).
 */
import assert from "node:assert/strict";
import { buildDecisionBrief } from "../src/lib/analytics/decision";
import { buildNationalBrief } from "../src/lib/analytics/national";
import { buildThemeBriefingPdf } from "../src/lib/analytics/themeBriefingPdf";
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
  assert.ok(logo === null || logo.startsWith("data:image/png"));

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

  console.log("test-theme-briefing-pdf: OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
