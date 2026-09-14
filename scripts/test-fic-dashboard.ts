/**
 * FIC: KPI Vencidos = columna estado, no fecha de plazo.
 */
import assert from "node:assert/strict";
import { buildDecisionBrief } from "../src/lib/analytics/decision";
import { isFicEstadoVencido } from "../src/themes/fic/dashboard";
import type { RecordRow } from "../src/lib/records/types";

function row(partial: Partial<RecordRow>): RecordRow {
  return {
    id: "1",
    departamento: "Córdoba",
    municipio: "Montería",
    estado: "LEGALIZADO",
    valor: 1_000_000,
    valor_por_legalizar: 0,
    fecha: "2025-01-15",
    no_cdp: "25-0001",
    ...partial,
  } as RecordRow;
}

assert.equal(isFicEstadoVencido("VENCIDO"), true);
assert.equal(isFicEstadoVencido("vencido"), true);
assert.equal(isFicEstadoVencido("LEGALIZADO"), false);

const brief = buildDecisionBrief("fic", [
  row({
    id: "v1",
    estado: "VENCIDO",
    valor_por_legalizar: 50,
    fecha_final_para_legalizacion: "2020-01-01",
  }),
  row({
    id: "v2",
    estado: "VENCIDO",
    no_cdp: "25-0002",
    valor_por_legalizar: 10,
    fecha_final_para_legalizacion: "2020-01-01",
  }),
  row({
    id: "legal-plazo-pasado",
    estado: "LEGALIZADO",
    no_cdp: "25-0003",
    valor_por_legalizar: 80,
    fecha_final_para_legalizacion: "2020-01-01",
  }),
]);

const kpi = brief.kpis.find((k) => k.id === "riesgo");
assert.equal(kpi?.value, "2");
assert.equal(brief.alerts.some((a) => a.id === "fic-vencidos" && a.count === 2), true);

console.log("test-fic-dashboard: OK");
