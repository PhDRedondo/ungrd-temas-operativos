/**
 * Pruebas unitarias del Centro de Mando Nacional (cruces + presión territorial).
 * Uso: npm run test:unit (incluye este archivo vía scripts/test-upload-pipeline o directo)
 */
import assert from "node:assert/strict";
import { buildNationalBrief } from "../src/lib/analytics/national";
import { buildCrosswalk } from "../src/lib/analytics/crosswalk";
import {
  getThemeMapSemantics,
  resolveAutoMapMetric,
} from "../src/lib/geo/themeMapSemantics";
import {
  buildThemeTimeSeries,
  fillMonthGaps,
  resolveEventDate,
} from "../src/lib/analytics/timeSeries";
import type { RecordRow } from "../src/lib/records/types";

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

function row(
  partial: Partial<RecordRow> & { id: string },
): RecordRow {
  return {
    departamento: "",
    municipio: "",
    fecha: "2026-01-15",
    estado: "En ejecución",
    valor: 0,
    ...partial,
  } as RecordRow;
}

test("buildNationalBrief marca brecha declaratoria sin intervención", () => {
  const brief = buildNationalBrief({
    "declaratoria-de-emergencia": [
      row({
        id: "d1",
        departamento: "La Guajira",
        municipio: "Riohacha",
        no_declaratoria: "DEC-1",
        clave_seguimiento: "DEC-1",
        estado: "Vigente",
      }),
    ],
    "agua-y-saneamiento": [],
    "obras-de-emergencia": [],
    carrotanques: [],
    "banco-de-maquinaria": [],
    fic: [],
    puentes: [],
    "obras-por-impuestos": [],
  });
  assert.ok(brief.territories.length >= 1);
  const guajira = brief.territories.find((t) => t.departamento === "La Guajira");
  assert.ok(guajira);
  assert.equal(guajira!.gapRespuesta, true);
  assert.ok(guajira!.pressure >= 50);
  assert.ok(
    brief.alerts.some((a) => a.id === "nat-gap-declaratoria"),
    "debe emitir alerta de brecha nacional",
  );
  assert.ok(brief.briefing.gapMunicipios >= 1);
  assert.ok(brief.mapAreas.some((a) => a.name === "La Guajira" && a.valor > 0));
  assert.ok(
    (brief.municipalities || []).some(
      (m) => m.departamento === "La Guajira" && m.gapRespuesta,
    ),
    "debe indexar municipio con brecha",
  );
  assert.equal(brief.themeBriefs.length, 8);
  assert.ok(brief.alertsAll.length >= brief.alerts.length);
});

test("buildNationalBrief baja presión si hay intervenciones", () => {
  const withGap = buildNationalBrief({
    "declaratoria-de-emergencia": [
      row({
        id: "d1",
        departamento: "Bolívar",
        no_declaratoria: "DEC-B",
        clave_seguimiento: "DEC-B",
      }),
    ],
    "agua-y-saneamiento": [],
    "obras-de-emergencia": [],
    carrotanques: [],
    "banco-de-maquinaria": [],
    fic: [],
    puentes: [],
    "obras-por-impuestos": [],
  });
  const withResp = buildNationalBrief({
    "declaratoria-de-emergencia": [
      row({
        id: "d1",
        departamento: "Bolívar",
        no_declaratoria: "DEC-B",
        clave_seguimiento: "DEC-B",
      }),
    ],
    "agua-y-saneamiento": [
      row({
        id: "a1",
        departamento: "Bolívar",
        municipio: "Cartagena",
        clave_seguimiento: "OP-99",
        orden_de_proveeduria: "OP-99",
        valor: 1_000_000,
      }),
      row({
        id: "a2",
        departamento: "Bolívar",
        clave_seguimiento: "OP-100",
        valor: 500_000,
      }),
      row({
        id: "a3",
        departamento: "Bolívar",
        clave_seguimiento: "OP-101",
        valor: 200_000,
      }),
    ],
    "obras-de-emergencia": [],
    carrotanques: [],
    "banco-de-maquinaria": [],
    fic: [],
    puentes: [],
    "obras-por-impuestos": [],
  });
  const pGap = withGap.territories.find((t) => t.departamento === "Bolívar")!
    .pressure;
  const pResp = withResp.territories.find((t) => t.departamento === "Bolívar")!
    .pressure;
  assert.ok(pResp < pGap, `presión con respuesta (${pResp}) < sin (${pGap})`);
  assert.equal(
    withResp.territories.find((t) => t.departamento === "Bolívar")!.gapRespuesta,
    false,
  );
});

test("buildCrosswalk OP une Agua y Obras", () => {
  const result = buildCrosswalk(
    {
      "agua-y-saneamiento": [
        row({
          id: "a1",
          departamento: "Antioquia",
          clave_seguimiento: "SMD-GS-MQ-151-2023",
          orden_de_proveeduria: "SMD-GS-MQ-151-2023",
          tipo_registro: "Maqueta",
          valor: 10,
        }),
      ],
      "obras-de-emergencia": [
        row({
          id: "o1",
          departamento: "Antioquia",
          clave_seguimiento: "SMD-GS-MQ-151-2023 / avance",
          orden_de_proveeduria: "SMD-GS-MQ-151-2023",
          tipo_registro: "Bitácora estado",
          valor: 5,
        }),
      ],
      fic: [],
      carrotanques: [],
      "banco-de-maquinaria": [],
      puentes: [],
      "obras-por-impuestos": [],
      "declaratoria-de-emergencia": [],
    },
    "op",
    "SMD-GS-MQ-151-2023",
  );
  assert.equal(result.events.length, 2);
  assert.ok(result.relatedThemes.includes("agua-y-saneamiento"));
  assert.ok(result.relatedThemes.includes("obras-de-emergencia"));
});

test("buildCrosswalk placa filtra carrotanques", () => {
  const result = buildCrosswalk(
    {
      carrotanques: [
        row({
          id: "c1",
          placa: "OCJ581",
          clave_seguimiento: "OCJ581",
          departamento: "Cesar",
        }),
      ],
      "banco-de-maquinaria": [
        row({
          id: "b1",
          placa: "OTRA",
          clave_seguimiento: "OTRA",
          departamento: "Cesar",
        }),
      ],
      fic: [],
      "agua-y-saneamiento": [],
      "obras-de-emergencia": [],
      puentes: [],
      "obras-por-impuestos": [],
      "declaratoria-de-emergencia": [],
    },
    "placa",
    "OCJ581",
  );
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0]!.clave.toUpperCase().includes("OCJ581"), true);
});

test("buildCrosswalk declaratoria incluye intervenciones del depto", () => {
  const result = buildCrosswalk(
    {
      "declaratoria-de-emergencia": [
        row({
          id: "d1",
          departamento: "Chocó",
          no_declaratoria: "DEC-CHOCO-1",
          clave_seguimiento: "DEC-CHOCO-1",
        }),
      ],
      "agua-y-saneamiento": [
        row({
          id: "a1",
          departamento: "Chocó",
          municipio: "Quibdó",
          clave_seguimiento: "OP-CHOCO",
          valor: 100,
        }),
      ],
      "obras-de-emergencia": [],
      carrotanques: [],
      "banco-de-maquinaria": [],
      fic: [],
      puentes: [],
      "obras-por-impuestos": [],
    },
    "declaratoria",
    "DEC-CHOCO-1",
  );
  assert.ok(result.events.some((e) => e.themeId === "declaratoria-de-emergencia"));
  assert.ok(result.events.some((e) => e.themeId === "agua-y-saneamiento"));
  assert.ok(result.territorial.some((t) => t.departamento === "Chocó"));
});

test("serie temporal Puentes usa conteo y fechas de instalación", () => {
  const theme = {
    id: "puentes",
    name: "Puentes",
    unit: "puentes",
    valueLabel: "Puentes",
  };
  const rows = [
    row({
      id: "1",
      departamento: "Cundinamarca",
      fecha: "",
      fecha_de_instalacion: "2024-03-15",
      valor: 500_000_000,
    }),
    row({
      id: "2",
      departamento: "Cundinamarca",
      fecha: "",
      fecha_de_instalacion: "2024-03-20",
      valor: 100_000_000,
    }),
    row({
      id: "3",
      departamento: "Boyacá",
      fecha: "2024-05-01",
      valor: 0,
    }),
  ] as RecordRow[];
  assert.equal(resolveEventDate(rows[0]!, "puentes"), "2024-03-15");
  const series = buildThemeTimeSeries(rows, theme, "auto", { fillGaps: true });
  assert.equal(series.metric, "count");
  assert.match(series.title, /puentes/i);
  assert.doesNotMatch(series.title, /intensidad/i);
  const mar = series.points.find((p) => p.period === "2024-03");
  assert.ok(mar);
  assert.equal(mar!.value, 2);
  assert.ok(series.points.some((p) => p.period === "2024-04" && p.value === 0));
});

test("fillMonthGaps completa huecos", () => {
  const filled = fillMonthGaps([
    { period: "2024-01", value: 1, count: 1, valor: 0 },
    { period: "2024-03", value: 2, count: 2, valor: 0 },
  ]);
  assert.equal(filled.length, 3);
  assert.equal(filled[1]!.period, "2024-02");
  assert.equal(filled[1]!.value, 0);
});

test("mapa Puentes prioriza conteo, no $ genérico", () => {
  const puentesTheme = {
    id: "puentes",
    name: "Puentes",
    unit: "puentes",
    valueLabel: "Puentes",
  };
  const puentes = getThemeMapSemantics(puentesTheme);
  assert.equal(resolveAutoMapMetric(puentesTheme, true), "count");
  assert.match(puentes.legendTitle("count"), /puentes/i);
  assert.doesNotMatch(puentes.legendTitle("count"), /intensidad/i);

  const ficTheme = {
    id: "fic",
    name: "FIC",
    unit: "transferencias",
    valueLabel: "Transferencias FIC",
  };
  const fic = getThemeMapSemantics(ficTheme);
  assert.equal(resolveAutoMapMetric(ficTheme, true), "valor");
  assert.match(fic.legendTitle("valor"), /COP|transferenc/i);
});

console.log(`\n${passed} pruebas nacionales OK`);
