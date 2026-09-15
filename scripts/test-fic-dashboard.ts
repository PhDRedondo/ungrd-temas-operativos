/**
 * FIC: KPI Vencidos = columna estado, no fecha de plazo.
 */
import assert from "node:assert/strict";
import { buildDecisionBrief } from "../src/lib/analytics/decision";
import { buildFicOperativeRows, isFicEstadoVencido } from "../src/themes/fic/dashboard";
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

const ops = buildFicOperativeRows([
  row({
    plazo_ejecucion_dias: 180,
    plazo_final_dias: 210,
    acto_administrativo_otorgamiento_del_recurso: "RESOLUCIÓN N° 0453 DE 2025",
  }),
]);
assert.equal(ops[0]!.departamento, "Córdoba");
assert.equal(ops[0]!.municipio, "Montería");
assert.equal(ops[0]!.plazoEjecucion, "180 días");
assert.equal(ops[0]!.plazoFinal, "210 días");
assert.match(ops[0]!.acto, /0453/);

console.log("test-fic-dashboard: OK");
