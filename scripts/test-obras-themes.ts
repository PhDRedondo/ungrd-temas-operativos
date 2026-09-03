/**
 * Pruebas: captura + indicadores + decisión — Obras emergencia e impuestos.
 * Uso: npx tsx scripts/test-obras-themes.ts
 */
import assert from "node:assert/strict";
import { buildDecisionBrief } from "../src/lib/analytics/decision";
import { prepareTrackingRow } from "../src/lib/uploads/capa-inference";
import type { RecordRow } from "../src/lib/records/types";
import { getTheme } from "../src/themes";
import {
  calculateObrasIndicadores,
  computeIrp,
  mapIrpToRiesgo,
  toPctValue,
} from "../src/themes/obras-de-emergencia/calculations";
import { aggregateObrasDashboard } from "../src/themes/obras-de-emergencia/dashboard";
import { OBRAS_EMERG_CAPTURE_FORMS } from "../src/themes/obras-de-emergencia/capture-forms";
import { calculateImpuestosIndicadores } from "../src/themes/obras-por-impuestos/calculations";
import { aggregateImpuestosDashboard } from "../src/themes/obras-por-impuestos/dashboard";
import { OBRAS_IMP_CAPTURE_FORMS } from "../src/themes/obras-por-impuestos/capture-forms";
import {
  FIC_CAPTURE_FORMS,
  ficCapaFromVigencia,
  ficCapaLookupVariants,
} from "../src/themes/fic/capture-forms";
import { canonicalEstadoLegalizacion } from "../src/themes/fic/select-options";

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

function row(partial: Partial<RecordRow> & { id: string }): RecordRow {
  return {
    departamento: "Cundinamarca",
    municipio: "Bogotá",
    fecha: "2026-01-01",
    estado: "Ejecución",
    valor: 1_000_000_000,
    ...partial,
  } as RecordRow;
}

test("temas registrados con captureForms", () => {
  const emerg = getTheme("obras-de-emergencia");
  const imp = getTheme("obras-por-impuestos");
  const fic = getTheme("fic");
  assert.ok(emerg);
  assert.ok(imp);
  assert.ok(fic);
  assert.equal(emerg!.captureForms?.length, 3);
  assert.equal(imp!.captureForms?.length, 3);
  assert.equal(fic!.captureForms?.length, 3);
  assert.equal(emerg!.fields.find((f) => f.name === "estado")?.type, "select");
  assert.equal(imp!.fields.find((f) => f.name === "estado")?.type, "select");
  assert.equal(fic!.fields.find((f) => f.name === "estado")?.type, "select");
  assert.equal(fic!.fields.find((f) => f.name === "vigencia")?.type, "select");
});

test("campos de formularios existen en schema Excel (emergencia)", () => {
  const names = new Set(getTheme("obras-de-emergencia")!.fields.map((f) => f.name));
  for (const form of OBRAS_EMERG_CAPTURE_FORMS) {
    for (const n of form.fieldNames) {
      assert.ok(names.has(n), `emergencia form ${form.id}: falta campo ${n}`);
    }
    for (const n of form.requiredNames || []) {
      assert.ok(names.has(n), `emergencia form ${form.id}: required ${n}`);
    }
  }
});

test("campos de formularios existen en schema Excel (impuestos)", () => {
  const names = new Set(getTheme("obras-por-impuestos")!.fields.map((f) => f.name));
  for (const form of OBRAS_IMP_CAPTURE_FORMS) {
    for (const n of form.fieldNames) {
      assert.ok(names.has(n), `impuestos form ${form.id}: falta campo ${n}`);
    }
  }
});

test("campos de formularios existen en schema Excel (fic)", () => {
  const names = new Set(getTheme("fic")!.fields.map((f) => f.name));
  for (const form of FIC_CAPTURE_FORMS) {
    for (const n of form.fieldNames) {
      assert.ok(names.has(n), `fic form ${form.id}: falta campo ${n}`);
    }
    for (const n of form.requiredNames || []) {
      assert.ok(names.has(n), `fic form ${form.id}: required ${n}`);
    }
  }
});

test("prepareTrackingRow fic deriva capa de vigencia y sync CDP", () => {
  const theme = getTheme("fic")!;
  const out = prepareTrackingRow(theme, {
    no_cdp: "CDP-999",
    vigencia: "2024",
    departamento: "Huila",
    municipio: "Neiva",
    valor: 1000,
    estado: "por legalizar",
  });
  assert.equal(out.capa, "Transferencia FIC 2024");
  assert.equal(out.tipo_registro, "Transferencia FIC 2024");
  assert.equal(out.clave_seguimiento, "CDP-999");
  assert.equal(out.estado, "POR LEGALIZAR");
});

test("fic capa lookup incluye todas las vigencias", () => {
  const vars = ficCapaLookupVariants("Transferencia FIC 2026");
  assert.ok(vars.includes("Transferencia FIC 2014"));
  assert.ok(vars.includes("Transferencia FIC 2026"));
  assert.equal(ficCapaFromVigencia("2025"), "Transferencia FIC 2025");
  assert.equal(canonicalEstadoLegalizacion("vencido"), "VENCIDO");
});

test("toPctValue acepta 0.88 y 88%", () => {
  assert.equal(toPctValue(0.88), 88);
  assert.equal(toPctValue("88%"), 88);
  assert.equal(toPctValue(50), 50);
});

test("SPI/CPI/IRP con atraso físico", () => {
  const ref = new Date(2026, 5, 1); // 1 jun 2026
  const ind = calculateObrasIndicadores(
    {
      fecha: "2026-01-01",
      fecha_finalizacion_uno: "2026-12-31",
      avance_fisico_ejecutado: 20,
      avance_financiero_ejecutado: 40,
      estado: "Ejecución",
    },
    ref,
  );
  assert.ok(ind.pct_tiempo_transcurrido != null && ind.pct_tiempo_transcurrido > 30);
  assert.ok(ind.spi != null && ind.spi < 1);
  assert.ok(ind.cpi != null && ind.cpi < 1);
  assert.ok(ind.irp != null && ind.irp > 0);
  assert.ok(["MEDIO", "ALTO", "CRITICO"].includes(ind.riesgo));
});

test("alerta URGENTE con ≤40 días en ejecución", () => {
  const ref = new Date(2026, 7, 1); // 1 ago
  const ind = calculateObrasIndicadores(
    {
      fecha: "2026-01-01",
      fecha_finalizacion_uno: "2026-08-20",
      avance_fisico_ejecutado: 80,
      avance_financiero_ejecutado: 80,
      estado: "Ejecución",
    },
    ref,
  );
  assert.equal(ind.alerta, "URGENTE");
  assert.ok(ind.dias_restantes != null && ind.dias_restantes <= 40);
});

test("mapIrpToRiesgo umbrales", () => {
  assert.equal(mapIrpToRiesgo(10), "BAJO");
  assert.equal(mapIrpToRiesgo(40), "MEDIO");
  assert.equal(mapIrpToRiesgo(60), "ALTO");
  assert.equal(mapIrpToRiesgo(90), "CRITICO");
  assert.ok(computeIrp(0.5, -30, 0.7) > 0);
});

test("aggregateObrasDashboard KPIs", () => {
  const agg = aggregateObrasDashboard([
    row({
      id: "1",
      contrato_de_obra: "C-1",
      clave_seguimiento: "C-1",
      tipo_registro: "Contrato de obra",
      estado: "Ejecución",
      estado_de_pago: "Pendiente",
      avance_fisico_ejecutado: 10,
      avance_financiero_ejecutado: 50,
      fecha: "2025-01-01",
      fecha_finalizacion_uno: "2026-08-30",
      valor: 100,
      valor_anticipo: 10,
    }),
    row({
      id: "2",
      orden_de_proveeduria: "OP-1",
      clave_seguimiento: "OP-1",
      tipo_registro: "Orden de proveeduría",
      estado: "Terminado",
      valor: 50,
    }),
  ]);
  assert.equal(agg.n, 2);
  assert.equal(agg.valorTotal, 150);
  assert.equal(agg.anticipo, 10);
  assert.ok(agg.enEjecucion >= 1);
  assert.ok(agg.pagoRiesgo >= 1);
  assert.ok(agg.porEstado.length >= 1);
});

test("prepareTrackingRow emergencia: clave y avances", () => {
  const theme = getTheme("obras-de-emergencia")!;
  const out = prepareTrackingRow(theme, {
    contrato_de_obra: "CTO-99",
    avance_fisico_ejecutado: 33,
    estado: "ejecucion",
    tipo_registro: "contrato",
  });
  assert.equal(out.clave_seguimiento, "CTO-99");
  assert.equal(out.estado, "Ejecución");
  assert.equal(out.tipo_registro, "Contrato de obra");
  assert.equal(out.porcentaje_avance_fisico_ejecutado, 33);
});

test("impuestos: indicadores por fechas de convenio", () => {
  const ref = new Date(2026, 7, 24);
  const ind = calculateImpuestosIndicadores(
    {
      fecha_de_inicio_del_convenio: "2026-01-01",
      fecha_de_terminacion_del_convenio: "2026-08-10",
      estado: "Ejecución",
    },
    ref,
  );
  assert.ok(ind.dias_restantes != null && ind.dias_restantes < 0);
});

test("aggregateImpuestosDashboard vencidos", () => {
  const agg = aggregateImpuestosDashboard([
    row({
      id: "i1",
      no_convenio: "BPIN-1",
      clave_seguimiento: "BPIN-1",
      estado: "Ejecución",
      fecha_de_inicio_del_convenio: "2025-01-01",
      fecha_de_terminacion_del_convenio: "2026-01-01",
      valor: 200,
      valor_convenio_de_interventoria: 20,
    }),
  ]);
  assert.equal(agg.n, 1);
  assert.equal(agg.valorTotal, 200);
  assert.equal(agg.valorInterventoria, 20);
  assert.ok(agg.vencidos >= 1);
});

test("prepareTrackingRow impuestos: no_convenio ↔ clave", () => {
  const theme = getTheme("obras-por-impuestos")!;
  const out = prepareTrackingRow(theme, {
    no_convenio: "CONV-7",
    estado: "en ejecucion",
  });
  assert.equal(out.clave_seguimiento, "CONV-7");
  assert.equal(out.estado, "En ejecución");
  assert.equal(out.tipo_registro, "Convenio obra por impuesto");
});

test("buildDecisionBrief obras-de-emergencia", () => {
  const brief = buildDecisionBrief("obras-de-emergencia", [
    row({
      id: "e1",
      contrato_de_obra: "C-1",
      clave_seguimiento: "C-1",
      estado: "Ejecución",
      estado_de_pago: "En mora",
      avance_fisico_ejecutado: 15,
      avance_financiero_ejecutado: 60,
      fecha: "2025-06-01",
      fecha_finalizacion_uno: "2026-09-01",
      valor: 500,
    }),
  ]);
  assert.equal(brief.themeId, "obras-de-emergencia");
  assert.ok(brief.kpis.some((k) => k.id === "valor"));
  assert.ok(brief.kpis.some((k) => k.id === "spi"));
  assert.ok(brief.kpis.some((k) => k.id === "irp-elevado"));
  assert.equal(brief.layerLabel, "Obras por estado");
  assert.ok(brief.alerts.length >= 1);
});

test("buildDecisionBrief obras-por-impuestos", () => {
  const brief = buildDecisionBrief("obras-por-impuestos", [
    row({
      id: "p1",
      no_convenio: "N-1",
      clave_seguimiento: "N-1",
      estado: "Ejecución",
      fecha_de_inicio_del_convenio: "2024-01-01",
      fecha_de_terminacion_del_convenio: "2025-01-01",
      valor: 300,
      valor_convenio_de_interventoria: 30,
    }),
  ]);
  assert.equal(brief.themeId, "obras-por-impuestos");
  assert.ok(brief.kpis.some((k) => k.id === "vencidos"));
  assert.ok(brief.kpis.some((k) => k.id === "interventoria"));
  assert.equal(brief.layerLabel, "Convenios por estado");
  assert.ok(brief.alerts.some((a) => a.id === "imp-vencidos"));
});

console.log(`\n${passed} tests OK`);
