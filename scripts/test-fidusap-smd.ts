/**
 * Recorte Fidusap → SMD (pestaña SMD, o CDP extendido filtrado).
 * Uso: npx tsx scripts/test-fidusap-smd.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { getTheme } from "../src/themes";
import { buildDecisionBrief } from "../src/lib/analytics/decision";
import {
  describeFidusapRecorte,
  inferGrupo,
  isResolucionSdgTablero,
  isSmdAreaSolicitante,
  isSmdCdpRow,
  isTableroEjecucionRow,
  mapFidusapHeader,
  parseFidusapCdpExtendido,
  parseFidusapDate,
  parseFidusapMoney,
  toSmdRecord,
} from "../src/themes/ejecucion-financiera/fidusap";
import {
  aggregateSmdDashboard,
  aggregateSmdControlBoard,
  corteLabelFromFileName,
  parseSmdSubcuenta,
  stampFidusapCorte,
} from "../src/themes/ejecucion-financiera/dashboard";
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
assert.equal(isResolucionSdgTablero("09002025"), true);
assert.equal(isResolucionSdgTablero("03842026"), true);
assert.equal(isResolucionSdgTablero("40262025"), true);
assert.equal(isResolucionSdgTablero("16212024"), false);
assert.equal(isTableroEjecucionRow({ area_ejecutora: "SMD", resolucion: "16212024" }), true);
assert.equal(isTableroEjecucionRow({ area_ejecutora: "SDG", resolucion: "09002025" }), true);
assert.equal(isTableroEjecucionRow({ area_ejecutora: "SDG", resolucion: "03842026" }), true);
assert.equal(isTableroEjecucionRow({ area_ejecutora: "SDG", resolucion: "16212024" }), false);
assert.equal(isTableroEjecucionRow({ area_ejecutora: "SRR", resolucion: "09002025" }), false);

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
assert.deepEqual(theme.workspaceTabs, [
  "cargas",
  "seguimiento",
  "analitica",
  "quickbi",
]);
assert.ok(theme.fields.some((f) => f.name === "grupo"));
assert.ok(theme.fields.some((f) => f.name === "area_solicitante"));
assert.ok(theme.fields.some((f) => f.name === "corte"));

assert.equal(mapFidusapHeader("Area Ejecuto"), "area_ejecutora");
assert.equal(mapFidusapHeader("Radicado C"), "radicado_cdp");
assert.equal(mapFidusapHeader("Nacional/Re"), "nacional_regional");
assert.equal(parseSmdSubcuenta("6A-PRINCIPAL 9677001").label, "PRINCIPAL (9677001)");
assert.equal(parseSmdSubcuenta("6P-Desastre Archipielago 9677019").code, "9677019");
assert.match(corteLabelFromFileName("34.REPORTE AGOSTO 31 DE 2026.xlsx"), /Agosto 31 De 2026/i);

const stamped = stampFidusapCorte([{ no_cdp: "1" }], "34.REPORTE AGOSTO 31 DE 2026.xlsx");
assert.match(String(stamped[0]?.corte), /Corte/i);

const control = aggregateSmdControlBoard([
  {
    id: "1",
    themeId: "ejecucion-financiera",
    departamento: "Nacional",
    municipio: "SIN MUNICIPIO",
    fecha: "2025-01-24",
    estado: "Asignado",
    valor: 1000,
    no_cdp: "25-1",
    linea: "6A-PRINCIPAL 9677001",
    fuente: "PRESUPUESTO NACIONAL FUNCIONAMIENTO",
    resolucion: "16212024",
    valor_cdp: 1000,
    valor_rc: 400,
    valor_pagado: 100,
    valor_por_pagar: 300,
    area_ejecutora: "SMD",
    corte: "Corte Agosto 31 De 2026",
  } as RecordRow,
]);
assert.equal(control.cdpUnicos, 1);
assert.equal(control.cdp, 1000);
assert.equal(control.compromiso, 400);
assert.equal(control.bySubcuenta[0]?.key, "9677001");
assert.equal(control.hasApropiacion, false);
assert.equal(control.bySubcuenta[0]?.apropiacion, 0);
assert.equal(control.saldoPorComprometer, 600);
assert.equal(control.corte, "Corte Agosto 31 De 2026");

const xlsx =
  process.env.FIDUSAP_XLSX ||
  "/Users/jackstive26/Downloads/34.REPORTE AGOSTO 31 DE 2026.xlsx";

async function parseCdextendidoTitleBlock() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("cdextendido");
  ws.addRow(["FIDUPREVISORA S.A."]);
  ws.addRow(["INFORME DE CDP"]);
  ws.addRow(["Fecha: 17/09/2026"]);
  ws.addRow(["Hora: 08:07:14"]);
  ws.addRow([]);
  ws.addRow([
    "No CDP",
    "Valor CDP",
    "Radicado C",
    "Solicitante",
    "Area Ejecuto",
    "Descripcion",
    "Fecha CDP",
    "Resolucion",
    "Alias",
    "Fuente",
    "Linea",
    "Nota",
    "Rubro",
    "Nacional/Re",
    "Identificacio",
    "Nombre",
    "No RC",
    "Fecha RC",
    "Estado",
    "Tipo",
    "Valor RC",
    "Contrato",
    "Area Solicitante",
    "Radicado RC",
    "Fecha inicial",
    "Fecha final",
    "Valor pagado",
    "Valor por pagar",
    "Nombre firma",
    "Cargo firma",
    "Usuario",
  ]);
  ws.addRow([
    "25-0001",
    1000,
    "1",
    "Persona",
    "GAA",
    "otro",
    "01-01-2025",
    "1",
    "",
    "PRESUPUESTO",
    "6A-PRINCIPAL 9677001",
    "",
    "Prestacion de Servicios",
    "Nacional",
    "1",
    "N",
    "",
    "",
    "",
    "",
    0,
    "",
    "SUBDIRECCION DE REDUCCION",
    "",
    "",
    "",
    0,
    0,
    "",
    "",
    "",
  ]);
  ws.addRow([
    "25-0002",
    2000,
    "2",
    "Persona",
    "SMD",
    "honorarios",
    "24-01-2025",
    "16212024",
    "DECRETO",
    "PRESUPUESTO NACIONAL FUNCIONAMIENTO",
    "6A-PRINCIPAL 9677001",
    "",
    "Prestacion de Servicios Profesionales",
    "Nacional",
    "2",
    "N",
    "10",
    "24-01-2025",
    "Asignado",
    "PRESTACION DE SERVICIOS",
    2000,
    "",
    "SUBDIRECCION MANEJO DE DESASTRES",
    "",
    "01-01-2025",
    "31-12-2025",
    500,
    1500,
    "",
    "",
    "user",
  ]);
  const buf = await wb.xlsx.writeBuffer();
  const parsed = await parseFidusapCdpExtendido(Buffer.from(buf));
  assert.ok(parsed.meta.headerRow >= 5);
  assert.equal(parsed.meta.fromSmdTab, false);
  assert.equal(parsed.meta.keptRows, 1);
  assert.equal(parsed.rows[0]?.no_cdp, "25-0002");
  assert.equal(parsed.rows[0]?.area_ejecutora, "SMD");
  assert.equal(parsed.rows[0]?.radicado_cdp, "2");
  assert.equal(parsed.rows[0]?.grupo, "HONORARIOS");
}

async function maybeParseXlsx() {
  await parseCdextendidoTitleBlock();
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
  assert.match(tip, /área ejecutora SMD/i);
  assert.match(tip, /0900 de 2025/i);
  assert.match(tip, /0384 de 2026/i);
  const first = parsed.rows[0];
  assert.ok(first);
  assert.ok(String(first.grupo || "").length > 0);
  assert.ok(String(first.no_cdp || "").length > 0);
  const realBoard = aggregateSmdControlBoard(parsed.rows as RecordRow[]);
  assert.equal(realBoard.cdpUnicos, parsed.rows.length);
  assert.ok(
    realBoard.bySubcuenta.length >= 5,
    `lineas=${realBoard.bySubcuenta.length}`,
  );
  assert.ok(
    realBoard.bySubcuenta.some((r) => /frente\s*frio/i.test(`${r.label} ${r.linea}`)),
    "falta Frente frío 9677022",
  );
  assert.ok(
    realBoard.bySubcuenta.some((r) => /archipielago/i.test(`${r.label} ${r.linea}`)),
    "falta Archipiélago 9677019",
  );
  assert.ok(realBoard.byGrupo.length >= 15, `grupos=${realBoard.byGrupo.length}`);
  console.log(
    `fidusap xlsx: ${parsed.meta.keptRows} SMD / ${parsed.meta.rawRows} filas (hoja ${parsed.meta.sheetName}; ${JSON.stringify(parsed.meta.byEjecutora)})`,
  );
}

void maybeParseXlsx().then(() => {
  console.log("test-fidusap-smd: OK");
});
