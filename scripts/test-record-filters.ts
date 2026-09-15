/**
 * Smoke tests — filtros URL / match de clave (sin BD).
 */
import assert from "node:assert/strict";
import {
  applyRecordFilters,
  buildThemeHref,
  EMPTY_RECORD_FILTERS,
  matchRecordQuery,
  municipalityOptionsForFilter,
  parseFiltersFromParams,
  writeFiltersToParams,
  type RecordFilterState,
} from "../src/lib/analytics/recordFilters";
import { canonicalizeDepartment, normalizeRecordGeo } from "../src/lib/geo";
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

assert.equal(canonicalizeDepartment("CORDOBA"), "Córdoba");
assert.equal(canonicalizeDepartment("LA GUAJIRA"), "La Guajira");
assert.equal(
  canonicalizeDepartment(
    "ARCHIPIELAGO DE SAN ANDRÉS, PROVIDENCIA Y SANTA CATALINA",
  ),
  "San Andrés y Providencia",
);
assert.equal(canonicalizeDepartment("SAN ANDRES Y PROVIDENCIA ISLAS"), "San Andrés y Providencia");

const geoCordoba = normalizeRecordGeo("CORDOBA", "MONTERIA");
assert.equal(geoCordoba.departamento, "Córdoba");
assert.equal(geoCordoba.municipio, "Montería");
const geoEntidad = normalizeRecordGeo("CRUZ ROJA COLOMBIANA", "SIN MUNICIPIO");
assert.equal(geoEntidad.departamento, "CRUZ ROJA COLOMBIANA");
const geoDash = normalizeRecordGeo("TOLIMA - HONDA", "SIN MUNICIPIO");
assert.equal(geoDash.departamento, "Tolima");
assert.equal(geoDash.municipio, "Honda");

const cordobaRow = row({
  departamento: "CORDOBA",
  municipio: "MONTERIA",
  clave_seguimiento: "25-0516",
});
const cordobaFilter: RecordFilterState = {
  ...EMPTY_RECORD_FILTERS,
  departamento: "Córdoba",
};
const cordobaHits = applyRecordFilters([cordobaRow, base], cordobaFilter, {
  themeId: "fic",
});
assert.equal(cordobaHits.length, 1);
assert.equal(cordobaHits[0]!.clave_seguimiento, "25-0516");

const muniHits = applyRecordFilters(
  [cordobaRow],
  { ...EMPTY_RECORD_FILTERS, departamento: "Córdoba", municipio: "Montería" },
  { themeId: "fic" },
);
assert.equal(muniHits.length, 1);

const munOpts = municipalityOptionsForFilter([cordobaRow], "Córdoba");
assert.ok(munOpts.includes("Montería"));

const fromUrl = parseFiltersFromParams(
  new URLSearchParams("departamento=CORDOBA&municipio=MONTERIA"),
);
assert.equal(fromUrl.departamento, "Córdoba");
assert.equal(fromUrl.municipio, "Montería");

const ficRow = row({
  no_cdp: "25-0516",
  municipio: "Montería",
  acto_administrativo_otorgamiento_del_recurso: "Resolución 0453 de 2025",
});
assert.equal(matchRecordQuery(ficRow, "0453", "fic"), true);
assert.equal(matchRecordQuery(ficRow, "Montería", "fic"), false);
assert.equal(matchRecordQuery(ficRow, "25-0516", "fic"), false);
const ficHits = applyRecordFilters(
  [ficRow, row({ no_cdp: "25-0999", acto_administrativo_otorgamiento_del_recurso: "Otra" })],
  { ...EMPTY_RECORD_FILTERS, q: "0453" },
  { themeId: "fic" },
);
assert.equal(ficHits.length, 1);
assert.equal(ficHits[0]!.no_cdp, "25-0516");

console.log("test-record-filters: OK");
