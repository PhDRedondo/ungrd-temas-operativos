/**
 * Smoke tests — filtros URL / match de clave (sin BD).
 */
import assert from "node:assert/strict";
import {
  applyRecordFilters,
  buildThemeHref,
  EMPTY_RECORD_FILTERS,
  matchRecordQuery,
  parseFiltersFromParams,
  writeFiltersToParams,
  type RecordFilterState,
} from "../src/lib/analytics/recordFilters";
import type { RecordRow } from "../src/lib/records/types";

function row(partial: Partial<RecordRow>): RecordRow {
  return {
    id: "1",
    departamento: "La Guajira",
    municipio: "Riohacha",
    estado: "En ejecución",
    valor: 100,
    fecha: "2025-01-15",
    clave_seguimiento: "SMD-12",
    tipo_registro: "Bitácora",
    ...partial,
  } as RecordRow;
}

const base = row({});
assert.equal(matchRecordQuery(base, "smd-12"), true);
assert.equal(matchRecordQuery(base, "SMD-12 / pago"), true);
assert.equal(matchRecordQuery(base, "xyz-no"), false);

const filters: RecordFilterState = {
  ...EMPTY_RECORD_FILTERS,
  q: "SMD",
  departamento: "La Guajira",
  capa: "Bitácora",
};
const filtered = applyRecordFilters([base, row({ clave_seguimiento: "OTRA" })], filters, {
  themeId: "agua-y-saneamiento",
  thirdKey: "tipo_registro",
});
assert.equal(filtered.length, 1);
assert.equal(filtered[0]!.clave_seguimiento, "SMD-12");

const href = buildThemeHref("fic", {
  tab: "analitica",
  departamento: "Meta",
  q: "OP-1",
});
assert.match(href, /tab=analitica/);
assert.match(href, /departamento=Meta/);
assert.match(href, /q=OP-1/);

const parsed = parseFiltersFromParams(new URLSearchParams("q=a&departamento=Meta&capa=Maqueta"));
assert.equal(parsed.q, "a");
assert.equal(parsed.departamento, "Meta");
assert.equal(parsed.capa, "Maqueta");

const round = writeFiltersToParams(parsed, "avanzado");
assert.equal(round.get("tab"), "avanzado");
assert.equal(round.get("departamento"), "Meta");
assert.equal(round.get("municipio"), null);

console.log("test-record-filters: OK");
