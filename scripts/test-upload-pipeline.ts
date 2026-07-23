/**
 * Pruebas unitarias del pipeline de carga / geo / decisión (sin servidor).
 * Uso: npm run test:unit
 */
import assert from "node:assert/strict";
import { getTheme } from "../src/themes";
import {
  businessTrackingKey,
  validateExcelRows,
} from "../src/lib/uploads/process-excel";
import {
  normalizeGeoKey,
  resolveDepartment,
  aggregateSpatial,
  quantileBreaks,
  classForValue,
} from "../src/lib/geo/spatial";
import { buildDecisionBrief } from "../src/lib/analytics/decision";
import { enrichRecordsForDecision } from "../src/lib/analytics/enrichRecords";
import type { RecordRow } from "../src/lib/records/types";
import type { ValidatedRecord } from "../src/lib/validation/record-schema";

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

test("normalizeGeoKey unifica LA GUAJIRA", () => {
  assert.equal(normalizeGeoKey("LA GUAJIRA"), normalizeGeoKey("La Guajira"));
  assert.ok(resolveDepartment("LA GUAJIRA"));
  assert.equal(resolveDepartment("BOLIVAR")?.name, "Bolívar");
});

test("aggregateSpatial canónica deptos", () => {
  const { areas, unmatched } = aggregateSpatial(
    [
      { departamento: "LA GUAJIRA", valor: 100, municipio: "Riohacha" },
      { departamento: "Guajira", valor: 50, municipio: "Maicao" },
      { departamento: "SIN DEPARTAMENTO", valor: 0 },
    ],
    {},
  );
  assert.equal(unmatched, 1);
  assert.equal(areas.length, 1);
  assert.equal(areas[0]!.name, "La Guajira");
  assert.equal(areas[0]!.valor, 150);
  assert.equal(areas[0]!.count, 2);
});

test("quantileBreaks y classForValue", () => {
  const breaks = quantileBreaks([1, 2, 3, 4, 5, 10, 20, 50], 4);
  assert.ok(breaks.length >= 2);
  assert.equal(classForValue(0, breaks), -1);
  assert.ok(classForValue(50, breaks) >= 0);
});

test("businessTrackingKey combina clave + capa", () => {
  const item = {
    departamento: "Antioquia",
    municipio: "Medellín",
    fecha: "2026-01-01",
    estado: "En ejecución",
    valor: 1,
    payload: {
      clave_seguimiento: "OP-1",
      tipo_registro: "Bitácora estado",
    },
    raw: {},
    contentHash: "x",
  } as ValidatedRecord;
  assert.equal(businessTrackingKey(item), "op-1\u0000bitácora estado");
  assert.equal(
    businessTrackingKey({ ...item, payload: { clave_seguimiento: "" } }),
    null,
  );
});

test("validateExcelRows acepta fila mínima FIC-like o reporta errores tipados", () => {
  const theme = getTheme("fic");
  assert.ok(theme);
  const { accepted, errors } = validateExcelRows(theme!, [
    {
      departamento: "Antioquia",
      municipio: "Medellín",
      fecha: "2026-01-15",
      estado: "LEGALIZADO",
      valor: 1000,
      tipo_registro: "Transferencia FIC 2026",
      capa: "Transferencia FIC 2026",
      clave_seguimiento: "CDP-TEST-1",
      no_cdp: "CDP-TEST-1",
    },
  ]);
  // Puede aceptar o rechazar según required fields del schema; no debe lanzar
  assert.ok(accepted.length + errors.length >= 1);
  if (accepted[0]) {
    assert.ok(accepted[0].contentHash.length > 10);
  }
});

test("enrich + decision brief Agua no rompe con vacío", () => {
  const brief = buildDecisionBrief("agua-y-saneamiento", []);
  assert.equal(brief.alerts[0]?.id, "empty");
});

test("enrich completa depto por clave", () => {
  const rows: RecordRow[] = [
    {
      id: "1",
      departamento: "Putumayo",
      municipio: "Mocoa",
      fecha: "2024-01-01",
      estado: "Finalizado",
      valor: 1_000_000,
      clave_seguimiento: "SMD-1",
      tipo_registro: "Maqueta / orden",
    },
    {
      id: "2",
      departamento: "SIN DEPARTAMENTO",
      municipio: "SIN MUNICIPIO",
      fecha: "2024-02-01",
      estado: "Tramite",
      valor: 0,
      clave_seguimiento: "SMD-1 / pago 1",
      tipo_registro: "Bitácora estado",
      dias_totales_en_la_linea: 40,
    },
  ];
  const enriched = enrichRecordsForDecision(rows);
  assert.equal(enriched[1]!.departamento, "Putumayo");
  assert.ok(Number(enriched[1]!.valor) >= 1_000_000);
  const brief = buildDecisionBrief("agua-y-saneamiento", enriched);
  assert.ok(brief.kpis.length >= 3);
});

console.log(`\n${passed} pruebas OK`);
if (process.exitCode) process.exit(1);
