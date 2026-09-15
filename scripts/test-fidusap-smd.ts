/**
 * Recorte Fidusap → SMD (pestaña SMD, o CDP extendido filtrado).
 * Uso: npx tsx scripts/test-fidusap-smd.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { getTheme } from "../src/themes";
import { buildDecisionBrief } from "../src/lib/analytics/decision";
import {
  describeFidusapRecorte,
  inferGrupo,
  isSmdAreaSolicitante,
  isSmdCdpRow,
  parseFidusapCdpExtendido,
  parseFidusapDate,
  parseFidusapMoney,
  toSmdRecord,
} from "../src/themes/ejecucion-financiera/fidusap";
import { aggregateSmdDashboard } from "../src/themes/ejecucion-financiera/dashboard";
import type { RecordRow } from "../src/lib/records/types";

assert.equal(isSmdAreaSolicitante("SUBDIRECCION MANEJO DE DESASTRES"), true);
assert.equal(isSmdAreaSolicitante("SUBDIRECCION PARA EL MANEJO DE DESASTRES"), true);
assert.equal(isSmdAreaSolicitante("SUBDIRECCION DE MANEJO"), true);
assert.equal(isSmdAreaSolicitante("Manejo Del Riesgo Fngrd"), true);
assert.equal(isSmdAreaSolicitante("SMD"), true);
assert.equal(isSmdAreaSolicitante("SUBDIRECCION DE REDUCCION"), false);
assert.equal(isSmdAreaSolicitante("SUBDIRECCION DE CONOCIMIENTO"), false);
assert.equal(isSmdAreaSolicitante(""), false);
assert.equal(isSmdCdpRow({ area_ejecutora: "SMD" }), true);
assert.equal(
  isSmdCdpRow({
    area_ejecutora: "SDG",
    area_solicitante: "SUBDIRECCION MANEJO DE DESASTRES",
  }),
  true,
);
assert.equal(
  isSmdCdpRow({ area_ejecutora: "SDG", area_solicitante: "" }),
  false,
);

assert.equal(
  inferGrupo({ rubro: "Prestacion de Servicios Profesionales" }),
  "HONORARIOS",
);
assert.equal(inferGrupo({ tipo: "HORAS MAQUINARIA" }), "MAQUINARIA");
assert.equal(inferGrupo({ descripcion: "Ayuda humanitaria de emergencia" }), "AHE");
assert.equal(inferGrupo({ rubro: "Transferencia economica directa" }), "FIC");

assert.equal(parseFidusapMoney("$1.234.567,89"), 1234567.89);
assert.equal(parseFidusapMoney(57000000), 57000000);
assert.equal(parseFidusapDate("24-01-2025"), "2025-01-24");
assert.equal(parseFidusapDate("2025-01-24"), "2025-01-24");

const rec = toSmdRecord({
  no_cdp: "25-0025",
  valor_cdp: 1000,
  area_solicitante: "SUBDIRECCION MANEJO DE DESASTRES",
  rubro: "Prestacion de Servicios Profesionales",
  nacional_regional: "Nacional",
  fecha_cdp: "24-01-2025",
  no_rc: "",
  valor_por_pagar: 1000,
});
assert.equal(rec.grupo, "HONORARIOS");
assert.equal(rec.departamento, "SIN DEPARTAMENTO");
assert.equal(rec.clave_seguimiento, "25-0025");
assert.equal(rec.fecha, "2025-01-24");

const rows: RecordRow[] = [
  {
    id: "1",
    themeId: "ejecucion-financiera",
    departamento: "Córdoba",
    municipio: "SIN MUNICIPIO",
    fecha: "2025-01-24",
    estado: "Asignado",
    valor: 1000,
    no_cdp: "25-1",
    grupo: "HONORARIOS",
    tipo_registro: "HONORARIOS",
    valor_cdp: 1000,
    valor_rc: 1000,
    valor_pagado: 400,
    valor_por_pagar: 600,
    no_rc: "10",
    fecha_final: "2020-01-01",
  } as RecordRow,
  {
    id: "2",
    themeId: "ejecucion-financiera",
    departamento: "SIN DEPARTAMENTO",
    municipio: "SIN MUNICIPIO",
    fecha: "2025-02-01",
    estado: "Sin RC",
    valor: 500,
    no_cdp: "25-2",
    grupo: "FIC",
    tipo_registro: "FIC",
    valor_cdp: 500,
    valor_rc: 0,
    valor_pagado: 0,
    valor_por_pagar: 500,
    no_rc: "",
  } as RecordRow,
];

const agg = aggregateSmdDashboard(rows, new Date(2026, 8, 15));
assert.equal(agg.n, 2);
assert.equal(agg.cdpUnicos, 2);
assert.equal(agg.sinRc, 1);
assert.equal(agg.vencidos, 1);
assert.equal(agg.valorCdp, 1500);
assert.ok(agg.porGrupo.some((g) => g.name === "HONORARIOS"));

const brief = buildDecisionBrief("ejecucion-financiera", rows);
assert.equal(brief.themeId, "ejecucion-financiera");
assert.ok(brief.kpis.some((k) => k.id === "cdp"));
assert.ok(brief.alerts.some((a) => a.id === "smd-sin-rc"));
assert.ok(brief.alerts.some((a) => a.id === "smd-vencidos"));
assert.equal(brief.layerLabel, "Por grupo");

const theme = getTheme("ejecucion-financiera");
assert.ok(theme);
assert.deepEqual(theme.workspaceTabs, ["cargas", "analitica", "quickbi"]);
assert.ok(theme.fields.some((f) => f.name === "grupo"));
assert.ok(theme.fields.some((f) => f.name === "area_solicitante"));

const xlsx =
  process.env.FIDUSAP_XLSX ||
  "/Users/jackstive26/Downloads/34.REPORTE AGOSTO 31 DE 2026.xlsx";

async function maybeParseXlsx() {
  if (!existsSync(xlsx)) {
    console.log("fidusap xlsx ausente: se omitió el parseo del reporte real");
    return;
  }
  const parsed = await parseFidusapCdpExtendido(readFileSync(xlsx));
  assert.match(parsed.meta.sheetName, /^smd$/i);
  assert.equal(parsed.meta.fromSmdTab, true);
  assert.ok(parsed.meta.keptRows >= 800, `kept=${parsed.meta.keptRows}`);
  assert.equal(parsed.meta.droppedNotSmd, 0);
  assert.equal(parsed.meta.keptRows, parsed.rows.length);
  assert.ok((parsed.meta.byEjecutora.SMD || 0) >= 700);
  assert.ok((parsed.meta.byEjecutora.SDG || 0) >= 30);
  const tip = describeFidusapRecorte(parsed.meta);
  assert.match(tip, /pestaña SMD tal cual/i);
  assert.match(tip, /no se vuelve a recortar por columna W/i);
  const first = parsed.rows[0];
  assert.ok(first);
  assert.ok(String(first.grupo || "").length > 0);
  assert.ok(String(first.no_cdp || "").length > 0);
  console.log(
    `fidusap xlsx: ${parsed.meta.keptRows} SMD / ${parsed.meta.rawRows} filas (hoja ${parsed.meta.sheetName}; ${JSON.stringify(parsed.meta.byEjecutora)})`,
  );
}

void maybeParseXlsx().then(() => {
  console.log("test-fidusap-smd: OK");
});
