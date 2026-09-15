/**
 * FIC: KPI Vencidos = fecha inicial + plazo ejecución + prórroga, no solo estado.
 */
import assert from "node:assert/strict";
import { buildDecisionBrief } from "../src/lib/analytics/decision";
import {
  buildFicOperativeRows,
  isFicEstadoVencido,
  isFicVencido,
  resolveFicFechaVencimiento,
  resolveFicPlazoDias,
} from "../src/themes/fic/dashboard";
import type { RecordRow } from "../src/lib/records/types";

const HOY = new Date("2026-09-15T12:00:00");

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

const abierto = row({
  id: "en-ejecucion-prorroga",
  estado: "EN EJECUCIÓN",
  no_cdp: "25-1446",
  fecha_inicial_para_legalizacion: "2025-12-12",
  plazo_ejecucion_dias: 180,
  plazo_adicion_dias: 60,
  plazo_final_dias: 240,
  fecha_acto_administrativo_modificacion: "2026-06-10",
  valor_por_legalizar: 1_000_000,
});
assert.equal(resolveFicPlazoDias(abierto), 240);
assert.equal(resolveFicFechaVencimiento(abierto), "2026-08-09");
assert.equal(isFicVencido(abierto, HOY), true);

const vigenteConProrroga = row({
  id: "en-contratacion",
  estado: "EN CONTRATACIÓN",
  no_cdp: "25-1191",
  fecha_inicial_para_legalizacion: "2025-12-02",
  plazo_ejecucion_dias: 180,
  plazo_adicion_dias: 180,
  plazo_final_dias: 360,
  fecha_acto_administrativo_modificacion: "2026-05-29",
  fecha_de_legalizacion_por_prorroga: "2026-12-02",
  valor_por_legalizar: 2_100_000_000,
});
assert.equal(resolveFicPlazoDias(vigenteConProrroga), 360);
assert.equal(isFicVencido(vigenteConProrroga, HOY), false);

const legalizadoViejo = row({
  id: "legal-plazo-pasado",
  estado: "LEGALIZADO",
  no_cdp: "25-0003",
  fecha_inicial_para_legalizacion: "2020-01-01",
  plazo_ejecucion_dias: 180,
  valor_por_legalizar: 80,
  fecha_final_para_legalizacion: "2020-01-01",
});
assert.equal(isFicVencido(legalizadoViejo, HOY), false);

const soloEstado = row({
  id: "v1",
  estado: "VENCIDO",
  valor_por_legalizar: 50,
  plazo_ejecucion_dias: 0,
  fecha_inicial_para_legalizacion: "2021-10-27",
});
assert.equal(isFicVencido(soloEstado, HOY), true);

const anulado = row({
  id: "anulado",
  estado: "ANULADO",
  fecha_inicial_para_legalizacion: "2024-01-01",
  plazo_ejecucion_dias: 180,
});
assert.equal(isFicVencido(anulado, HOY), false);

const adicionDiez = row({
  id: "adicion-10",
  estado: "EN EJECUCIÓN",
  fecha_inicial_para_legalizacion: "2026-03-01",
  plazo_ejecucion_dias: 180,
  plazo_adicion_dias: 10,
  fecha_acto_administrativo_modificacion: "2026-08-01",
});
assert.equal(resolveFicPlazoDias(adicionDiez), 190);
assert.equal(resolveFicFechaVencimiento(adicionDiez), "2026-09-07");
assert.equal(isFicVencido(adicionDiez, HOY), true);

const brief = buildDecisionBrief("fic", [
  soloEstado,
  row({
    id: "v2",
    estado: "VENCIDO",
    no_cdp: "25-0002",
    valor_por_legalizar: 10,
  }),
  legalizadoViejo,
  abierto,
]);

const kpi = brief.kpis.find((k) => k.id === "riesgo");
assert.equal(kpi?.value, "3");
assert.equal(
  brief.alerts.some((a) => a.id === "fic-vencidos" && a.count === 3),
  true,
);

const ops = buildFicOperativeRows([
  row({
    estado: "EN EJECUCIÓN",
    plazo_ejecucion_dias: 180,
    plazo_adicion_dias: 30,
    plazo_final_dias: 210,
    fecha_inicial_para_legalizacion: "2026-01-01",
    acto_administrativo_otorgamiento_del_recurso: "RESOLUCIÓN N° 0453 DE 2025",
  }),
]);
assert.equal(ops[0]!.departamento, "Córdoba");
assert.equal(ops[0]!.municipio, "Montería");
assert.equal(ops[0]!.plazoEjecucion, "180 días");
assert.equal(ops[0]!.plazoAdicion, "30 días");
assert.equal(ops[0]!.plazoFinal, "210 días");
assert.equal(ops[0]!.fechaVencimiento, "2026-07-30");
assert.match(ops[0]!.acto, /0453/);

console.log("test-fic-dashboard: OK");
