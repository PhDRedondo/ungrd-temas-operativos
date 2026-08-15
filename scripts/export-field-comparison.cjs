/**
 * Exporta Excel: campos de cada base compartida vs campos del formulario.
 * Uso: node scripts/export-field-comparison.cjs
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(
  process.env.HOME,
  "Desktop",
  "Johan",
  "Comparacion_Bases_vs_Formularios_UNGRD.xlsx",
);

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
    "estado_en_terminos_de_legalizacion_ungrd",
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
    "fecha_de_desembolso",
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
    "valor_desemboloso",
    "valor_desembolso",
  ],
  departamento: ["departamento"],
  municipio: ["municipio"],
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
  no_cdp: ["no_cdp", "n_cdp", "cdp"],
  no_rc: ["no_rc", "n_rc", "rc"],
  divipola: ["divipola"],
};

function slugify(h) {
  return (
    String(h || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 64) || "campo"
  );
}

function canonicalize(name) {
  for (const [canon, aliases] of Object.entries(ALIASES)) {
    if (aliases.includes(name)) return canon;
  }
  return name;
}

function parseFormFields(themeId) {
  const file = path.join(ROOT, "src/themes", themeId, "fields-from-source.ts");
  if (!fs.existsSync(file)) return [];
  const src = fs.readFileSync(file, "utf8");
  const fields = [];
  const re =
    /\{\s*name:\s*"([^"]+)"\s*,\s*label:\s*"((?:\\.|[^"\\])*)"\s*,\s*type:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(src))) {
    fields.push({
      name: m[1],
      label: m[2].replace(/\\n/g, " ").replace(/\r/g, " ").trim(),
      type: m[3],
    });
  }
  return fields;
}

/** Capas operativas usadas en formularios (no catálogos auxiliares). */
const THEME_SOURCES = [
  {
    tema: "Puentes",
    themeId: "puentes",
    archivo: "2025-08-19 CONSOLIDADO DE PUENTES SMD  ARCGIS DRIVE.xlsx",
    hojas: ["PUENTES"],
  },
  {
    tema: "Obras de Emergencia",
    themeId: "obras-de-emergencia",
    archivo: "2025-08-21 OBRAS DE EMERGENCIAS ARCGIS DRIVE.xlsx",
    hojas: ["OBRAS DE EMERGENCIA"],
  },
  {
    tema: "Obras de Emergencia (O.P.)",
    themeId: "obras-de-emergencia",
    archivo: "2025-08-25 O.P. OBRAS DE EMERGENCIAS ARCGIS DRIVE.xlsx",
    hojas: ["O.P. OBRAS DE EMERGENCIA"],
  },
  {
    tema: "Obras por Impuestos",
    themeId: "obras-por-impuestos",
    archivo: "2025-09-15 OBRAS POR IMPUESTO ARCGIS DRIVE.xlsx",
    hojas: ["OBRAS POR IMPUESTO"],
  },
  {
    tema: "Declaratoria de Emergencia",
    themeId: "declaratoria-de-emergencia",
    archivo: "2025-08-14 DECLATARORIAS DE CALAMIDAD ARCGIS.xlsx",
    hojas: ["DECRETOS DE CALAMIDAD"],
  },
  {
    tema: "Banco de Maquinaria",
    themeId: "banco-de-maquinaria",
    archivo: "Banco de Maquinaria.xlsx",
    hojas: [
      "DETALLE MAQUINARIA",
      "CONVENIOS O PROCESOS",
      "BITACORA CONVENIOS",
      "BASE ENTREGA BOMBEROS",
    ],
  },
  {
    tema: "Carrotanques — Bitácora",
    themeId: "carrotanques",
    archivo: "Bitacora Carrotanques.xlsx",
    hojas: ["Bitacora", "SUMINISTRO DEF"],
  },
  {
    tema: "Carrotanques — Maqueta",
    themeId: "carrotanques",
    archivo: "maqueta carrotanques (2).xlsx",
    hojas: ["MAQUETA"],
  },
  {
    tema: "Agua y Saneamiento — Maqueta",
    themeId: "agua-y-saneamiento",
    archivo: "Maqueta Agua y Saneamiento.xlsx",
    hojas: ["General", "control y seguimiento-detalle m", "modificaciones"],
  },
  {
    tema: "Agua y Saneamiento — Bitácora",
    themeId: "agua-y-saneamiento",
    archivo: "Bitacora Agua y Saneamiento def.xlsx",
    hojas: ["bitacora", "PAGOS"],
  },
  {
    tema: "FIC",
    themeId: "fic",
    archivo: "Seguimiento_FIC_2026.xlsx",
    hojas: ["(vigencias 2014–2026)"],
    fromFormOnly: true,
  },
];

const map = JSON.parse(
  fs.readFileSync(path.join(__dirname, "source-field-map.json"), "utf8"),
);

function findSheet(archivo, hoja) {
  const entry = map[archivo];
  if (!entry) return null;
  return entry.sheets.find((s) => s.sheet === hoja) || null;
}

function statusForSourceField(sourceName, formNames, formCanon) {
  const canon = canonicalize(sourceName);
  if (formNames.has(sourceName) || formNames.has(canon)) {
    return { ok: "OK", nombreForm: formNames.has(sourceName) ? sourceName : canon };
  }
  // alias inverso: el formulario tiene el canónico
  if (formCanon.has(canon)) {
    return { ok: "OK (alias)", nombreForm: canon };
  }
  return { ok: "NO", nombreForm: "" };
}

const wb = XLSX.utils.book_new();

// ── Resumen ──────────────────────────────────────────────────
const resumen = [
  [
    "Tema / Formulario",
    "Archivo base",
    "Hoja",
    "Campos en base",
    "Campos en formulario",
    "OK en formulario",
    "NO en formulario",
    "% cobertura",
  ],
];

const comparacion = [
  [
    "Tema",
    "Archivo base",
    "Hoja",
    "Campo (nombre en base)",
    "Nombre técnico (slug)",
    "Nombre en formulario",
    "¿OK en formulario?",
    "Tipo en formulario",
  ],
];

const formCache = {};
function getForm(themeId) {
  if (!formCache[themeId]) {
    const fields = parseFormFields(themeId);
    const names = new Set(fields.map((f) => f.name));
    const byName = Object.fromEntries(fields.map((f) => [f.name, f]));
    const canon = new Set([...names].map(canonicalize));
    formCache[themeId] = { fields, names, byName, canon };
  }
  return formCache[themeId];
}

for (const src of THEME_SOURCES) {
  const form = getForm(src.themeId);
  const sheetRows = [
    [
      "Campo (nombre en base)",
      "Nombre técnico",
      "¿OK en formulario?",
      "Nombre en formulario",
      "Tipo formulario",
      "Hoja origen",
    ],
  ];

  let okCount = 0;
  let noCount = 0;
  let fieldCount = 0;

  if (src.fromFormOnly) {
    // FIC: comparar formulario consigo mismo (base regenerada desde Excel)
    for (const f of form.fields) {
      if (["tipo_registro", "capa", "clave_seguimiento"].includes(f.name)) continue;
      fieldCount++;
      okCount++;
      sheetRows.push([
        f.label,
        f.name,
        "OK",
        f.name,
        f.type,
        "Seguimiento_FIC (vigencias)",
      ]);
      comparacion.push([
        src.tema,
        src.archivo,
        "vigencias",
        f.label,
        f.name,
        f.name,
        "OK",
        f.type,
      ]);
    }
    resumen.push([
      src.tema,
      src.archivo,
      "vigencias 2014–2026",
      fieldCount,
      form.fields.length,
      okCount,
      noCount,
      "100%",
    ]);
  } else {
    for (const hoja of src.hojas) {
      const sheet = findSheet(src.archivo, hoja);
      if (!sheet) {
        sheetRows.push([`(hoja no encontrada: ${hoja})`, "", "—", "", "", hoja]);
        continue;
      }
      const fields = sheet.fields || sheet.headers.map((h) => ({ label: h, name: slugify(h) }));
      for (const f of fields) {
        fieldCount++;
        const st = statusForSourceField(f.name, form.names, form.canon);
        if (st.ok.startsWith("OK")) okCount++;
        else noCount++;
        const formField = form.byName[st.nombreForm] || form.byName[canonicalize(f.name)];
        sheetRows.push([
          f.label,
          f.name,
          st.ok,
          st.nombreForm || "",
          formField ? formField.type : "",
          hoja,
        ]);
        comparacion.push([
          src.tema,
          src.archivo,
          hoja,
          f.label,
          f.name,
          st.nombreForm || "",
          st.ok,
          formField ? formField.type : "",
        ]);
      }
    }
    const pct = fieldCount ? Math.round((okCount / fieldCount) * 100) : 0;
    resumen.push([
      src.tema,
      src.archivo,
      src.hojas.join(" + "),
      fieldCount,
      form.fields.length,
      okCount,
      noCount,
      `${pct}%`,
    ]);
  }

  // Campos solo en formulario (seguimiento / fijos) — hoja aparte en comparación
  const sourceNames = new Set(
    sheetRows.slice(1).map((r) => r[1]).filter(Boolean),
  );
  for (const f of form.fields) {
    const matched =
      sourceNames.has(f.name) ||
      [...sourceNames].some((n) => canonicalize(n) === f.name);
    if (!matched) {
      comparacion.push([
        src.tema,
        src.archivo,
        "(solo formulario)",
        f.label,
        f.name,
        f.name,
        "Solo en formulario",
        f.type,
      ]);
    }
  }

  const safeName = src.tema
    .replace(/[\\/?*\[\]]/g, "")
    .slice(0, 28);
  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  ws["!cols"] = [
    { wch: 45 },
    { wch: 32 },
    { wch: 16 },
    { wch: 28 },
    { wch: 12 },
    { wch: 28 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, safeName);
}

const themeNames = wb.SheetNames.slice();
const themeSheets = { ...wb.Sheets };
wb.SheetNames = [];
wb.Sheets = {};

const wsResumen = XLSX.utils.aoa_to_sheet(resumen);
wsResumen["!cols"] = [
  { wch: 32 },
  { wch: 50 },
  { wch: 40 },
  { wch: 14 },
  { wch: 18 },
  { wch: 16 },
  { wch: 16 },
  { wch: 12 },
];
XLSX.utils.book_append_sheet(wb, wsResumen, "00_Resumen");

const wsComp = XLSX.utils.aoa_to_sheet(comparacion);
wsComp["!cols"] = [
  { wch: 28 },
  { wch: 48 },
  { wch: 28 },
  { wch: 45 },
  { wch: 32 },
  { wch: 28 },
  { wch: 18 },
  { wch: 12 },
];
XLSX.utils.book_append_sheet(wb, wsComp, "01_Comparacion_completa");

for (const name of themeNames) {
  XLSX.utils.book_append_sheet(wb, themeSheets[name], name);
}

XLSX.writeFile(wb, OUT);
console.log("Excel generado:", OUT);
console.log("Hojas:", wb.SheetNames.join(" | "));
console.log("Filas comparación:", comparacion.length - 1);
