/**
 * Regenera fields-from-source.ts desde Excel reales (Downloads).
 * Incluye maqueta + bitácora + hojas satélite y claves de cruce.
 *
 * Uso: node scripts/generate-theme-fields.cjs
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const DOWNLOADS = path.join(process.env.HOME, "Downloads");
const THEMES_DIR = path.join(__dirname, "..", "src", "themes");

function slugify(h) {
  return String(h || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64) || "campo";
}

function readSheetFields(file, sheetHint) {
  const full = path.join(DOWNLOADS, file);
  if (!fs.existsSync(full)) throw new Error(`No existe: ${full}`);
  const wb = XLSX.readFile(full, { cellDates: true, raw: false });
  const sheetName =
    wb.SheetNames.find((n) =>
      n.toLowerCase().includes(String(sheetHint).toLowerCase()),
    ) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  let headerIdx = 0;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const n = rows[i].filter((c) => String(c).trim()).length;
    if (n >= 3) {
      headerIdx = i;
      break;
    }
  }
  const headers = (rows[headerIdx] || [])
    .map((h) => String(h).trim())
    .filter(Boolean);
  const dataCount = Math.max(0, rows.length - headerIdx - 1);
  return {
    file,
    sheet: sheetName,
    rows: dataCount,
    fields: headers.map((label) => ({ label, name: slugify(label) })),
  };
}

const DATE_HINT = /fecha|fech[_ ]/i;
const TEXTAREA_HINT = /observ|objeto|minuta|justific|comentario|novedad/i;
const NUMBER_HINT =
  /^(latitud|longitud|valor|avance|porcentaje|horas|dias|cantidad|capacidad|volumen|litros|lt_|per_benef|com_benef|ano_modelo|ano_compra|%|ejecucion|beneficiar)/i;

const ALIASES = {
  observaciones: ["observaciones", "observacion", "obs", "minuta_y_observaciones"],
  estado: [
    "estado",
    "estado_actual",
    "estado_actual_de_la_obra",
    "estado_carrotanque",
    "estado_del_convenio_obra_por_impuesto",
    "estado_de_ejecucion",
    "estado_macro",
  ],
  fecha: [
    "fecha",
    "fecha_inicio",
    "fecha_de_inicio",
    "fecha_inicio_orden",
    "fecha_de_instalacion",
    "fecha_inicio_del_convenio",
    "fecha_sucripcion",
    "fecha_de_recibo",
    "fecha_estado",
    "fecha_del_estado",
    "fecha_corte_del_reporte",
    "fecha_del_reporte",
    "fecha_de_estado",
  ],
  valor: [
    "valor",
    "valor_contrato",
    "valor_de_la_orden",
    "valor_convenio",
    "valorop",
    "valor_unitario",
    "valor_total",
    "valor_op",
    "valor_pagado",
  ],
  departamento: ["departamento"],
  municipio: ["municipio"],
  // claves de seguimiento / cruce
  orden_de_proveeduria: [
    "orden_de_proveeduria",
    "orden_de_proveeduria_x_pago",
    "op",
    "op2",
    "consecutivo_orden_de_proveeduria",
  ],
  placa: ["placa", "placas", "placa_ungrd"],
  serial: ["serial", "n_motor"],
  no_convenio: [
    "no_convenio",
    "no_convenio_o_proceso",
    "contrato_de_adquisicion_o_convenio",
    "convenio_de_obra_por_impuesto_no",
  ],
  divipola: ["divipola"],
};

function inferType(name, label) {
  // Placa / IDs de negocio siempre texto
  if (
    /^(placa|serial|nit|divipola|orden|op|contrato|cdp|rc|expediente|clave)/i.test(
      name,
    )
  ) {
    return "text";
  }
  if (DATE_HINT.test(name) || DATE_HINT.test(label)) return "date";
  if (NUMBER_HINT.test(name) || /latitud|longitud|m³|cop|%|avance|horas|días|dias|litros/i.test(label))
    return "number";
  if (TEXTAREA_HINT.test(name) || TEXTAREA_HINT.test(label)) return "textarea";
  return "text";
}

function canonicalize(name) {
  for (const [canon, aliases] of Object.entries(ALIASES)) {
    if (aliases.includes(name)) return canon;
  }
  return name;
}

function fieldsFrom(sheetInfo) {
  const seen = new Set();
  const fields = [];
  for (const f of sheetInfo.fields) {
    let name = canonicalize(f.name);
    if (seen.has(name)) {
      name = f.name;
      if (seen.has(name)) continue;
    }
    seen.add(name);
    fields.push({
      name,
      label: f.label,
      type: inferType(name, f.label),
      // Bitácoras pueden no traer geo; el import/normalize rellena default
      required: false,
      excelWidth: f.label.length > 24 ? 28 : 18,
    });
  }
  return { fields, seen };
}

function ensureFixed(fields, seen) {
  const ensure = [
    { name: "departamento", label: "Departamento", type: "text", required: false },
    { name: "municipio", label: "Municipio (DIVIPOLA)", type: "text" },
    { name: "fecha", label: "Fecha", type: "date" },
    { name: "estado", label: "Estado", type: "text" },
    { name: "valor", label: "Valor (COP)", type: "number" },
  ];
  for (const e of ensure) {
    if (!seen.has(e.name)) {
      fields.unshift({ ...e, required: false, excelWidth: 16 });
      seen.add(e.name);
    }
  }
}

function mergeFields(lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const f of list) {
      if (seen.has(f.name)) continue;
      seen.add(f.name);
      out.push(f);
    }
  }
  return out;
}

function trackingFields(options, joinKey, joinLabel) {
  return [
    {
      name: "tipo_registro",
      label: "Tipo de registro",
      type: "select",
      required: true,
      options,
      excelWidth: 24,
    },
    {
      name: "capa",
      label: "Capa (Maqueta / Bitácora / …)",
      type: "select",
      required: true,
      options: options,
      excelWidth: 22,
    },
    {
      name: "clave_seguimiento",
      label: `Clave de seguimiento (${joinLabel})`,
      type: "text",
      required: false,
      excelWidth: 28,
    },
    {
      name: joinKey,
      label: joinLabel,
      type: "text",
      required: false,
      excelWidth: 22,
    },
  ];
}

function emit(themeId, note, fields) {
  const lines = fields.map((f) => {
    const parts = [
      `name: ${JSON.stringify(f.name)}`,
      `label: ${JSON.stringify(f.label)}`,
      `type: ${JSON.stringify(f.type)}`,
    ];
    if (f.required) parts.push("required: true");
    if (f.options) parts.push(`options: ${JSON.stringify(f.options)}`);
    if (f.excelWidth) parts.push(`excelWidth: ${f.excelWidth}`);
    return `  { ${parts.join(", ")} },`;
  });
  return `/**
 * Campos generados desde fuentes reales (maqueta / bitácora / ArcGIS).
 * NO editar a mano — regenerar: node scripts/generate-theme-fields.cjs
 * Fuente: ${note}
 * schemaVersion 3: capas + clave_seguimiento para cruces y seguimiento.
 */
import type { FormField } from "../shared";

export const SOURCE_FIELDS: FormField[] = [
${lines.join("\n")}
];

export const SCHEMA_VERSION = 3;
`;
}

// ── Specs por tema ─────────────────────────────────────────────

const specs = [];

// PUENTES — inventario ArcGIS (una capa)
{
  const s = readSheetFields(
    "2025-08-19 CONSOLIDADO DE PUENTES SMD  ARCGIS DRIVE.xlsx",
    "PUENTES",
  );
  const { fields, seen } = fieldsFrom(s);
  ensureFixed(fields, seen);
  const withTrack = mergeFields([
    trackingFields(
      ["Inventario puente"],
      "id",
      "ID puente / lugar",
    ),
    fields,
  ]);
  specs.push({
    id: "puentes",
    note: `${s.file} · ${s.sheet} (${s.rows} filas)`,
    fields: withTrack,
  });
}

// OBRAS DE EMERGENCIA — contrato + OP
{
  const contrato = readSheetFields(
    "2025-08-21 OBRAS DE EMERGENCIAS ARCGIS DRIVE.xlsx",
    "OBRAS DE EMERGENCIA",
  );
  const op = readSheetFields(
    "2025-08-25 O.P. OBRAS DE EMERGENCIAS ARCGIS DRIVE.xlsx",
    "O.P.",
  );
  const a = fieldsFrom(contrato);
  const b = fieldsFrom(op);
  ensureFixed(a.fields, a.seen);
  const merged = mergeFields([
    trackingFields(
      ["Contrato de obra", "Orden de proveeduría"],
      "orden_de_proveeduria",
      "Orden de proveeduría / Contrato",
    ),
    a.fields,
    b.fields,
  ]);
  specs.push({
    id: "obras-de-emergencia",
    note: `${contrato.sheet}+${op.sheet}`,
    fields: merged,
  });
}

// OBRAS POR IMPUESTOS
{
  const s = readSheetFields(
    "2025-09-15 OBRAS POR IMPUESTO ARCGIS DRIVE.xlsx",
    "OBRAS POR IMPUESTO",
  );
  const { fields, seen } = fieldsFrom(s);
  ensureFixed(fields, seen);
  specs.push({
    id: "obras-por-impuestos",
    note: `${s.file} · ${s.sheet}`,
    fields: mergeFields([
      trackingFields(
        ["Convenio obra por impuesto"],
        "no_convenio",
        "Nº convenio / BPIN",
      ),
      fields,
    ]),
  });
}

// DECLARATORIAS
{
  const s = readSheetFields(
    "2025-08-14 DECLATARORIAS DE CALAMIDAD ARCGIS.xlsx",
    "DECRETOS",
  );
  const { fields, seen } = fieldsFrom(s);
  ensureFixed(fields, seen);
  specs.push({
    id: "declaratoria-de-emergencia",
    note: `${s.file} · ${s.sheet}`,
    fields: mergeFields([
      trackingFields(
        ["Decreto / declaratoria"],
        "no_declaratoria",
        "Nº declaratoria",
      ),
      fields,
    ]),
  });
}

// BANCO DE MAQUINARIA — 4 capas reales
{
  const detalle = readSheetFields("Banco de Maquinaria.xlsx", "DETALLE");
  const convenios = readSheetFields("Banco de Maquinaria.xlsx", "CONVENIOS");
  const bitacora = readSheetFields("Banco de Maquinaria.xlsx", "BITACORA");
  const entrega = readSheetFields("Banco de Maquinaria.xlsx", "ENTREGA");
  const d = fieldsFrom(detalle);
  ensureFixed(d.fields, d.seen);
  specs.push({
    id: "banco-de-maquinaria",
    note: "DETALLE+CONVENIOS+BITACORA+ENTREGA",
    fields: mergeFields([
      trackingFields(
        [
          "Maqueta / inventario",
          "Convenio o proceso",
          "Bitácora convenio",
          "Entrega a beneficiario",
        ],
        "serial",
        "Serial / Nº máquina / Nº convenio",
      ),
      d.fields,
      fieldsFrom(convenios).fields,
      fieldsFrom(bitacora).fields,
      fieldsFrom(entrega).fields,
    ]),
  });
}

// CARROTANQUES — maqueta + bitácora + suministro
{
  const maqueta = readSheetFields("maqueta carrotanques (2).xlsx", "MAQUETA");
  const bitacora = readSheetFields("Bitacora Carrotanques.xlsx", "Bitacora");
  const suministro = readSheetFields(
    "Bitacora Carrotanques.xlsx",
    "SUMINISTRO",
  );
  const m = fieldsFrom(maqueta);
  ensureFixed(m.fields, m.seen);
  specs.push({
    id: "carrotanques",
    note: "MAQUETA+Bitacora+SUMINISTRO DEF",
    fields: mergeFields([
      trackingFields(
        ["Maqueta / inventario", "Bitácora estado", "Suministro / viajes"],
        "placa",
        "Placa",
      ),
      m.fields,
      fieldsFrom(bitacora).fields,
      fieldsFrom(suministro).fields,
    ]),
  });
}

// AGUA Y SANEAMIENTO — maqueta general + control + modificaciones + bitácora + pagos
{
  const general = readSheetFields(
    "Maqueta Agua y Saneamiento.xlsx",
    "General",
  );
  const control = readSheetFields(
    "Maqueta Agua y Saneamiento.xlsx",
    "control",
  );
  const mods = readSheetFields(
    "Maqueta Agua y Saneamiento.xlsx",
    "modificacion",
  );
  const bitacora = readSheetFields(
    "Bitacora Agua y Saneamiento def.xlsx",
    "bitacora",
  );
  const pagos = readSheetFields(
    "Bitacora Agua y Saneamiento def.xlsx",
    "PAGOS",
  );
  const g = fieldsFrom(general);
  ensureFixed(g.fields, g.seen);
  specs.push({
    id: "agua-y-saneamiento",
    note: "General+control+modificaciones+bitacora+PAGOS",
    fields: mergeFields([
      trackingFields(
        [
          "Maqueta / orden",
          "Control ejecución física",
          "Modificación contractual",
          "Bitácora estado",
          "Pago / desembolso",
        ],
        "orden_de_proveeduria",
        "Orden de proveeduría",
      ),
      g.fields,
      fieldsFrom(control).fields,
      fieldsFrom(mods).fields,
      fieldsFrom(bitacora).fields,
      fieldsFrom(pagos).fields,
    ]),
  });
}

const meta = {};
for (const spec of specs) {
  // capa options = same as tipo_registro for simplicity in form
  const outPath = path.join(THEMES_DIR, spec.id, "fields-from-source.ts");
  fs.writeFileSync(outPath, emit(spec.id, spec.note, spec.fields));
  meta[spec.id] = { note: spec.note, fieldCount: spec.fields.length };
  console.log(`✓ ${spec.id}: ${spec.fields.length} campos`);
}

fs.writeFileSync(
  path.join(__dirname, "theme-source-meta.json"),
  JSON.stringify(meta, null, 2),
);
console.log("\nMeta → scripts/theme-source-meta.json");
