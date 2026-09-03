/**
 * Genera vistas medallón: 1 schema por tema + 1 tabla por hoja Excel (mismo nombre).
 *
 *   agua.general, agua.bitacora, agua.pagos, …
 *   puentes.base_general_puentes, puentes.bitacora, puentes.contratos_estructuracion
 *
 * Cada vista incluye TODAS las columnas del formulario + extras Excel de la hoja
 * (nada inventado; nada omitido de la fuente).
 *
 *   npx tsx scripts/generate-medallion-theme-views.ts
 *   → sql/medallion/003_theme_capa_views.sql
 */
import fs from "fs";
import path from "path";
import { THEMES } from "../src/themes";
import type { FormField } from "../src/themes/shared/types";

const OUT = path.join(
  process.cwd(),
  "sql/medallion/003_theme_capa_views.sql",
);

/** Schema corto y estable para el lake/BI. */
const SCHEMA_ALIAS: Record<string, string> = {
  "agua-y-saneamiento": "agua",
  puentes: "puentes",
  carrotanques: "carrotanques",
  "obras-de-emergencia": "obras_emergencia",
  "banco-de-maquinaria": "banco_maquinaria",
  "obras-por-impuestos": "obras_impuestos",
  "declaratoria-de-emergencia": "declaratoria",
  "asistencia-humanitaria": "asistencia_humanitaria",
  "gestion-de-servicios": "gestion_servicios",
  "subsidios-de-arriendos": "subsidios_arriendos",
  "alertas-tempranas": "alertas_tempranas",
  "asistencia-tecnica": "asistencia_tecnica",
  "equipo-de-respuesta": "equipo_respuesta",
  "compra-de-materiales": "compra_materiales",
  fic: "fic",
  convenios: "convenios",
  presupuesto: "presupuesto",
  "ejecucion-financiera": "ejecucion_financiera",
  materiales: "materiales",
};

/** Nombre de tabla = hoja Excel (snake_case seguro para Postgres/BI). */
const SHEET_ALIAS: Record<string, string> = {
  // Agua — Maqueta Agua y Saneamiento.xlsx / Bitacora …xlsx
  alta: "general",
  "variables-lider": "variables_lider",
  modificaciones: "modificaciones",
  bitacora: "bitacora",
  pagos: "pagos",
  "cdps-rc": "cdps_y_rc",
  "bitacora-estructuracion": "bitacora_estructuracion",
  control: "control_y_seguimiento_detalle_m",
  // Puentes (puentes 2.xlsx)
  estructuracion: "contratos_estructuracion",
  inventario: "base_general_puentes",
  consolidado: "consolidado",
  // FIC — formularios AppSheet CONTROL FIC
  transferencia: "transferencia",
  legalizacion: "legalizacion",
  modificacion: "modificacion",
};

/** Nombre legible de la hoja (como en Excel). */
const SHEET_LABEL: Record<string, string> = {
  general: "General",
  variables_lider: "Variables líder",
  modificaciones: "modificaciones",
  bitacora: "bitacora",
  pagos: "PAGOS",
  cdps_y_rc: "CDPS Y RC",
  bitacora_estructuracion: "bitacora estructuracion",
  control_y_seguimiento_detalle_m: "control y seguimiento-detalle m",
  base_general_puentes: "Base General Puentes",
  contratos_estructuracion: "Contratos Estructuracion",
  consolidado: "consolidado",
  transferencia: "Transferencia FIC",
  legalizacion: "Legalización",
  modificacion: "Modificación / prórroga",
};

/**
 * Llaves de JOIN intra-schema (schema.table → field → SQL expr sin AS).
 * Semántica Puentes (no mezclar slug con texto Excel):
 *  - id_puente / codigo_operativo → activo
 *  - clave_proceso → slug estable (DON:… / CTO-…)
 *  - convenio_o_cto / contrato_convenio → texto Excel del convenio/cto
 */
const JOIN_KEY_EXPR: Record<string, Record<string, string>> = {
  "agua.modificaciones": {
    observaciones: payloadCoalesce(
      "observaciones",
      "obs",
      "Observaciones",
      "comentarios",
      "comentario",
    ),
    modificacion: payloadCoalesce(
      "modificacion",
      "tipo_de_modificacion",
      "Modificación",
    ),
  },
  "agua.cdps_y_rc": {
    observaciones: payloadCoalesce("observaciones", "obs", "Observaciones"),
  },
  "agua.pagos": {
    // '' en saldo_por_liberar bloqueaba el fallback a saldo_a_liberar
    saldo_por_liberar: payloadCoalesce("saldo_por_liberar", "saldo_a_liberar"),
    orden_de_proveeduria_x_pago: payloadCoalesce(
      "orden_de_proveeduria_x_pago",
      "orden_de_proveeduria",
      "clave_seguimiento",
    ),
  },
  "agua.bitacora_estructuracion": {
    estado_de_ejecucion: payloadCoalesce(
      "estado_de_ejecucion",
      "estado_de_ejecucion_orden",
      "estado",
    ),
    fecha_inicio_orden: payloadCoalesce("fecha_inicio_orden", "fecha_inicio"),
    fecha_fin_orden: payloadCoalesce("fecha_fin_orden", "fecha_fin"),
  },
  "puentes.bitacora": {
    id_puente: payloadCoalesce("id_puente", "id", "clave_seguimiento"),
    codigo_operativo: payloadCoalesce("codigo_operativo", "id_unico"),
    // Solo slug; si falta, el JOIN de proceso va por convenio_o_cto
    clave_proceso: payloadCoalesce("clave_proceso"),
    convenio_o_cto: payloadCoalesce(
      "convenio_o_cto",
      "contrato_convenio",
      "contrato",
    ),
    contrato_convenio: payloadCoalesce(
      "contrato_convenio",
      "convenio_o_cto",
      "contrato",
    ),
    // Import legacy: labels duplicados metieron fechas en *_proceso
    fecha_inicio: payloadCoalesce("fecha_inicio", "fecha_inicio_proceso"),
    fecha_fin: payloadCoalesce("fecha_fin", "fecha_fin_proceso"),
    observaciones: payloadCoalesce(
      "observaciones",
      "fundamento",
      "comentarios",
    ),
  },
  "puentes.base_general_puentes": {
    id_puente: payloadCoalesce("id_puente", "id", "clave_seguimiento"),
    codigo_operativo: payloadCoalesce("codigo_operativo", "id_unico"),
    clave_proceso: payloadCoalesce("clave_proceso"),
    convenio_o_cto: payloadCoalesce(
      "convenio_o_cto",
      "contrato_convenio",
      "contrato",
    ),
    contrato_convenio: payloadCoalesce(
      "contrato_convenio",
      "convenio_o_cto",
      "contrato",
    ),
    estado: payloadCoalesce("estado", "Estado"),
  },
  "puentes.contratos_estructuracion": {
    clave_proceso: payloadCoalesce("clave_proceso", "clave_seguimiento"),
    convenio_o_cto: payloadCoalesce("convenio_o_cto", "contrato_convenio"),
    contrato_convenio: payloadCoalesce("contrato_convenio", "convenio_o_cto"),
  },
  "subsidios_arriendos.consolidado": {
    uuid: payloadCoalesce("uuid", "clave_seguimiento"),
    clave_seguimiento: payloadCoalesce("clave_seguimiento", "uuid"),
  },
  // Formulario usa nombres canónicos; Excel legacy trae typo / alias.
  "banco_maquinaria.alta_convenio": {
    cantidad_maquinaria_expectativa: payloadCoalesce(
      "cantidad_maquinaria_expectativa",
      "cantidad_maquinaria_espectativa",
    ),
    valor_total: payloadCoalesce("valor_total", "valor_sin_iva"),
    valor_aporte_gobernacion: payloadCoalesce("valor_aporte_gobernacion"),
  },
  "banco_maquinaria.alta_detalle": {
    estado_maquina: payloadCoalesce("estado_maquina", "estado"),
  },
  "banco_maquinaria.bitacora_convenio": {
    fecha_de_estado: payloadCoalesce("fecha_de_estado", "fecha"),
  },
};

/** Agua: OP une todas las hojas del mismo workbook. */
const AGUA_JOIN_OP =
  "nullif(trim(coalesce(r.payload->>'orden_de_proveeduria', r.payload->>'clave_seguimiento', r.payload->>'op', '')), '')";

const SHEET_EXTRA_FIELDS: Record<string, Record<string, string[]>> = {
  puentes: {
    // Base General: Contrato / comentarios / ID alias (no se digitan en alta)
    inventario: [
      "contrato_convenio",
      "contrato",
      "clave_proceso",
      "tipo_vinculo",
      "descripcion_proceso",
      "convenio_o_cto",
      "id_unico",
      "id",
      "origen_adquisicion",
      "proceso_sigla",
      "numero_unidad",
      "estado",
    ],
    // Llaves de proceso heredadas del puente (proceso-chain.ts)
    bitacora: [
      "convenio_o_cto",
      "contrato_convenio",
      "clave_proceso",
      "tipo_vinculo",
      "id_unico",
      "id",
    ],
    // Alias convenio_o_cto = contrato para JOIN con bitácora
    estructuracion: ["clave_proceso", "convenio_o_cto"],
  },
  "agua-y-saneamiento": {
    // Alta = hoja General: columnas que alimentan la maqueta vía sync
    alta: [
      "coordenadas",
      "plazo_de_ejecucion_dias",
      "forma_de_pago",
      "no_cdp",
      "n_cdp",
      "fecha_cdp",
      "valor_cdp",
      "no_rc",
      "n_rc",
      "fecha_rc",
      "valor_rc",
      "expediente",
      "responsable_apoyo_a_la_supervision",
      "fecha_de_asignacion",
      "estado",
      "estado_de_ejecucion",
      "fecha_inicio_orden",
      "fecha_fin_orden",
      "ejecucion",
      "fecha_radicacion_expediente",
      "tecnico_asignado",
      "abogado_asignado_r_tecnica",
      "financiero_asignado",
      "fecha_de_aval",
      "cantidad_reiteraciones",
      "cantidad_observaciones",
      "dias_en_tecnico",
      "dias_en_proveedor",
      "dias_contractual",
      "dias_financiera",
      "dias_subdirector",
      "dias_subdireccion_general",
      "dias_gafc",
      "dias_fiduprevisora",
      "dias_totales_en_la_linea",
      "dias_en_gestion_de_pagos",
      "n_ratificacion",
      "sd",
      "valor_pagado",
      "comprobante_de_egreso",
      "voucher",
      "fecha_de_pago",
      "op_paga",
      "etapa",
      "estado_actual",
      "proceso_actual",
      "dependencia",
      "dias_desde_ult_gestion",
      "fecha_ultimo_seguimiento",
      "comentario_ult_seguimiento_a_supervision",
      "novedades",
      "validaciom",
      "administracion",
      "procesos_juridicos",
      "nombre_orden",
      "categorizacion",
    ],
  },
};

/** Vistas viejas a eliminar (nombres inventados / legacy). */
const DROP_LEGACY_VIEWS = [
  "puentes.general",
  "puentes.inventario",
  "puentes.estructuracion",
  "puentes.all",
  // Agua: maqueta/control inventados → hojas Excel reales
  "agua.maqueta",
  "agua.control",
  "agua.cdps_rc",
  "carrotanques.general",
  "obras_emergencia.general",
  "banco_maquinaria.general",
  "obras_impuestos.general",
  "declaratoria.general",
  "medallion.v_puentes_all",
  "medallion.v_puentes_inventario",
  "medallion.v_agua_all",
  "medallion.v_agua_y_saneamiento_all",
];

const CAPA_VARIANTS: Record<string, string[]> = {
  "Alta / orden": ["Alta / orden", "Maqueta / orden"],
  "Variables líder": [
    "Variables líder",
    "Variables lider",
    "variables lider",
  ],
  "Modificación contractual": [
    "Modificación contractual",
    "Modificacion contractual",
    "modificaciones",
    "Modificaciones",
  ],
  "Bitácora estado": ["Bitácora estado", "Bitacora estado", "Bitácora", "Bitacora"],
  "Pago / desembolso": ["Pago / desembolso", "Pagos", "PAGOS"],
  "CDPS y RC": [
    "CDPS y RC",
    "CDPS Y RC",
    "cdps y rc",
    "CDPS",
    "CDP Y RC",
  ],
  "Bitácora estructuración": [
    "Bitácora estructuración",
    "Bitacora estructuracion",
    "bitacora estructuracion",
    "Seguimiento operativo",
  ],
  "Control ejecución física": [
    "Control ejecución física",
    "Control ejecucion fisica",
    "control y seguimiento-detalle m",
    "control y seguimiento detalle m",
  ],
  "Inventario puente": ["Inventario puente", "Base General Puentes"],
  "Contrato estructuración": [
    "Contrato estructuración",
    "Contrato estructuracion",
    "Contratos Estructuracion",
  ],
  // FIC: capa canónica del form = 2026; la vista debe ver todas las vigencias.
  "Transferencia FIC 2026": [
    "Transferencia FIC 2014",
    "Transferencia FIC 2015",
    "Transferencia FIC 2016",
    "Transferencia FIC 2017",
    "Transferencia FIC 2018",
    "Transferencia FIC 2019",
    "Transferencia FIC 2020",
    "Transferencia FIC 2021",
    "Transferencia FIC 2022",
    "Transferencia FIC 2023",
    "Transferencia FIC 2024",
    "Transferencia FIC 2025",
    "Transferencia FIC 2026",
  ],
};

const SKIP_THEMES = new Set(["plantilla"]);

function sqlStr(s: string): string {
  return `'${String(s).replace(/'/g, "''")}'`;
}

/**
 * COALESCE que ignora '' (JSON a menudo trae la clave vacía y bloquea el fallback).
 * Uso: payloadCoalesce("a", "b") → coalesce(nullif(trim(a),''), nullif(trim(b),''))
 */
function payloadCoalesce(...keys: string[]): string {
  const parts = keys.map(
    (k) => `nullif(trim(r.payload->>${sqlStr(k)}), '')`,
  );
  return `coalesce(${parts.join(", ")})`;
}

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    return `"${name.replace(/"/g, '""')}"`;
  }
  return name;
}

function schemaFor(themeId: string): string {
  return SCHEMA_ALIAS[themeId] || themeId.replace(/-/g, "_");
}

function sheetFor(formId: string): string {
  return SHEET_ALIAS[formId] || formId.replace(/-/g, "_");
}

function fieldExpr(name: string, viewFq?: string, themeId?: string): string {
  const q = quoteIdent(name);
  if (viewFq && JOIN_KEY_EXPR[viewFq]?.[name]) {
    return `${JOIN_KEY_EXPR[viewFq][name]} AS ${q}`;
  }
  // Agua: misma OP en todas las tablas del schema
  if (
    themeId === "agua-y-saneamiento" &&
    name === "orden_de_proveeduria"
  ) {
    return `${AGUA_JOIN_OP} AS ${q}`;
  }
  if (name === "departamento") {
    return `nullif(trim(coalesce(r.payload->>'departamento', r.departamento, '')), '') AS ${q}`;
  }
  if (name === "municipio") {
    return `nullif(trim(coalesce(r.payload->>'municipio', r.municipio, '')), '') AS ${q}`;
  }
  if (name === "fecha") {
    return `coalesce(nullif(trim(r.payload->>'fecha'), ''), r.fecha::text) AS ${q}`;
  }
  if (name === "estado") {
    return `nullif(trim(coalesce(r.payload->>'estado', r.estado, '')), '') AS ${q}`;
  }
  if (name === "valor") {
    return `COALESCE(
    CASE
      WHEN nullif(trim(r.payload->>'valor'), '') ~ '^-?[0-9]+(\\.[0-9]+)?$'
      THEN nullif(trim(r.payload->>'valor'), '')::numeric
      ELSE NULL
    END,
    r.valor
  ) AS ${q}`;
  }
  return `r.payload->>${sqlStr(name)} AS ${q}`;
}

function exclusiveFieldsOfOthers(themeId: string): Set<string> {
  const mine = new Set(
    (THEMES.find((t) => t.id === themeId)?.fields || []).map((f) => f.name),
  );
  const foreign = new Set<string>();
  for (const t of THEMES) {
    if (t.id === themeId || SKIP_THEMES.has(t.id)) continue;
    for (const f of t.fields) {
      if (!mine.has(f.name)) foreign.add(f.name);
    }
  }
  return foreign;
}

const VIEW_META_FIELDS = new Set(["capa", "tipo_registro", "clave_seguimiento"]);

function uniqueFields(
  themeId: string,
  names: string[],
  fields: FormField[],
): string[] {
  const known = new Set(fields.map((f) => f.name));
  const foreign = exclusiveFieldsOfOthers(themeId);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const n of names) {
    if (!n || seen.has(n)) continue;
    if (VIEW_META_FIELDS.has(n)) {
      seen.add(n);
      out.push(n);
      continue;
    }
    if (foreign.has(n)) {
      throw new Error(
        `[medallion] CRUCE DE TEMAS: "${themeId}" no puede incluir campo ajeno "${n}"`,
      );
    }
    if (known.size && !known.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

function capaPredicate(capa: string): string {
  const variants = CAPA_VARIANTS[capa] || [capa];
  const lowers = [...new Set(variants.map((v) => v.toLowerCase()))];
  return `(lower(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', ''))) IN (${lowers.map(sqlStr).join(", ")}))`;
}

/**
 * Hojas Agua que en el Excel importado quedaron mezcladas en «Alta / orden»
 * (maqueta ancha). La vista satélite incluye Alta si hay marcador de negocio.
 * Clave: schema.table → campos payload que indican «esta fila aporta a la hoja».
 */
const AGUA_ALTA_FALLBACK_MARKERS: Record<string, string[]> = {
  "agua.cdps_y_rc": ["n_cdp", "fecha_cdp", "no_cdp", "n_rc", "fecha_rc", "no_rc"],
  "agua.variables_lider": [
    "administracion",
    "procesos_juridicos",
    "categorizacion",
    "tecnico_asignado",
    "fecha_de_aval",
  ],
  "agua.bitacora_estructuracion": [
    "semana_seguimiento",
    "comentario_semanal",
    "estado_de_ejecucion",
    "fecha_inicio_orden",
    "fecha_fin_orden",
    "fecha_radicacion_expediente",
    "expediente",
  ],
};

function sheetRowPredicate(capa: string, viewFq: string): string {
  const base = capaPredicate(capa);
  const markers = AGUA_ALTA_FALLBACK_MARKERS[viewFq];
  if (!markers?.length) return base;
  const alta = capaPredicate("Alta / orden");
  const hasMarker = markers
    .map(
      (m) =>
        `nullif(trim(coalesce(r.payload->>${sqlStr(m)}, '')), '') IS NOT NULL`,
    )
    .join(" OR ");
  return `(${base} OR (${alta} AND (${hasMarker})))`;
}

/**
 * Solo datos operativos reales para lake/reader.
 * Excluye seed demo (`src/db/seed.ts`) y fuentes de prueba conocidas.
 * Captura legítima usa `form` / `excel`.
 */
function operationalSourcePredicate(): string {
  return `lower(trim(coalesce(r.source, ''))) NOT IN ('seed', 'demo', 'harness', 'smoke', 'test')`;
}

type ConnRow = {
  connectionId: string;
  schemaName: string;
  tableName: string;
  themeId: string;
  sheet: string;
  description: string;
};

function fq(schema: string, table: string): string {
  return `${schema}.${table}`;
}

function buildSheetView(opts: {
  schema: string;
  table: string;
  themeId: string;
  description: string;
  fieldNames: string[];
  fields: FormField[];
  capa: string;
}): { sql: string; conn: ConnRow } {
  const name = fq(opts.schema, opts.table);
  const cols = [
    "r.id AS record_id",
    "r.theme_id",
    "r.source",
    "r.created_at",
    "r.updated_at",
    ...uniqueFields(opts.themeId, opts.fieldNames, opts.fields).map((n) =>
      fieldExpr(n, name, opts.themeId),
    ),
  ];
  const sql = `
DROP VIEW IF EXISTS ${name} CASCADE;
CREATE VIEW ${name} AS
SELECT
  ${cols.join(",\n  ")}
FROM public.records r
WHERE r.theme_id = ${sqlStr(opts.themeId)}
  AND r.deleted_at IS NULL
  AND ${operationalSourcePredicate()}
  AND ${sheetRowPredicate(opts.capa, name)};

COMMENT ON VIEW ${name} IS ${sqlStr(opts.description)};
`;
  return {
    sql,
    conn: {
      connectionId: `${opts.schema}.${opts.table}`,
      schemaName: opts.schema,
      tableName: opts.table,
      themeId: opts.themeId,
      sheet: opts.table,
      description: opts.description,
    },
  };
}

function buildGeneralView(opts: {
  schema: string;
  themeId: string;
  themeName: string;
  /** Si true, aplana todos los fields (tema de una sola base). */
  typedFields?: FormField[];
}): { sql: string; conn: ConnRow } {
  const name = fq(opts.schema, "general");
  let sql: string;
  if (opts.typedFields && opts.typedFields.length) {
    const cols = [
      "r.id AS record_id",
      "r.theme_id",
      "r.source",
      "r.created_at",
      "r.updated_at",
      ...uniqueFields(
        opts.themeId,
        opts.typedFields.map((f) => f.name),
        opts.typedFields,
      ).map(fieldExpr),
    ];
    sql = `
DROP VIEW IF EXISTS ${name} CASCADE;
CREATE VIEW ${name} AS
SELECT
  ${cols.join(",\n  ")}
FROM public.records r
WHERE r.theme_id = ${sqlStr(opts.themeId)}
  AND r.deleted_at IS NULL
  AND ${operationalSourcePredicate()};

COMMENT ON VIEW ${name} IS ${sqlStr(`${opts.themeName} — base general (campos del schema)`)};
`;
  } else {
    sql = `
DROP VIEW IF EXISTS ${name} CASCADE;
CREATE VIEW ${name} AS
SELECT
  r.id AS record_id,
  r.theme_id,
  r.source,
  r.created_at,
  r.updated_at,
  nullif(trim(coalesce(r.payload->>'capa', r.payload->>'tipo_registro', '')), '') AS capa,
  nullif(trim(coalesce(r.payload->>'tipo_registro', '')), '') AS tipo_registro,
  nullif(trim(coalesce(r.payload->>'clave_seguimiento', '')), '') AS clave_seguimiento,
  r.payload
FROM public.records r
WHERE r.theme_id = ${sqlStr(opts.themeId)}
  AND r.deleted_at IS NULL
  AND ${operationalSourcePredicate()};

COMMENT ON VIEW ${name} IS ${sqlStr(`${opts.themeName} — general (todas las hojas: meta + payload). Preferir tablas por hoja para columnas tipadas.`)};
`;
  }
  return {
    sql,
    conn: {
      connectionId: `${opts.schema}.general`,
      schemaName: opts.schema,
      tableName: "general",
      themeId: opts.themeId,
      sheet: "general",
      description: `${opts.themeName} — general`,
    },
  };
}

function main() {
  const parts: string[] = [];
  const conns: ConnRow[] = [];
  const schemas = new Set<string>();

  parts.push(`-- AUTO-GENERADO: npx tsx scripts/generate-medallion-theme-views.ts
-- Tablas = hojas Excel (mismos nombres). Ej.:
--   SELECT * FROM puentes.base_general_puentes;
--   SELECT * FROM puentes.bitacora;  -- incluye convenio_o_cto
--   SELECT * FROM agua.general;

CREATE SCHEMA IF NOT EXISTS medallion;
`);

  parts.push("\n-- Quitar nombres legacy (all / general / inventario inventados)");
  for (const v of DROP_LEGACY_VIEWS) {
    parts.push(`DROP VIEW IF EXISTS ${v} CASCADE;`);
  }

  for (const theme of THEMES) {
    if (SKIP_THEMES.has(theme.id)) continue;
    const schema = schemaFor(theme.id);
    schemas.add(schema);
    parts.push(`\n-- === ${theme.name} → schema ${schema} ===`);
    parts.push(`CREATE SCHEMA IF NOT EXISTS ${schema};`);

    const forms = theme.captureForms || [];
    if (forms.length > 0) {
      for (const form of forms) {
        if (!form.capa) {
          throw new Error(`[medallion] ${theme.id}/${form.id} sin capa`);
        }
        const table = sheetFor(form.id);
        const sheetLabel = SHEET_LABEL[table] || table;
        const extras = SHEET_EXTRA_FIELDS[theme.id]?.[form.id] || [];
        const built = buildSheetView({
          schema,
          table,
          themeId: theme.id,
          description: `${theme.name} — hoja Excel «${sheetLabel}»`,
          fieldNames: [
            "capa",
            "tipo_registro",
            "clave_seguimiento",
            ...(form.fieldNames || []),
            ...extras,
          ],
          fields: theme.fields,
          capa: form.capa,
        });
        // connection catalog uses Excel sheet name
        built.conn.sheet = sheetLabel;
        built.conn.description = `${theme.name} — ${sheetLabel}`;
        parts.push(built.sql);
        conns.push(built.conn);
      }
      // No crear *.general / *.all: solo las hojas reales del Excel.
    } else {
      const gen = buildGeneralView({
        schema,
        themeId: theme.id,
        themeName: theme.name,
        typedFields: theme.fields,
      });
      // Temas de una sola base: nombre «base» (no «general/all»)
      const typedSql = gen.sql
        .replaceAll(`${schema}.general`, `${schema}.base`)
        .replace(
          `${theme.name} — base general (campos del schema)`,
          `${theme.name} — base`,
        );
      parts.push(typedSql);
      conns.push({
        connectionId: `${schema}.base`,
        schemaName: schema,
        tableName: "base",
        themeId: theme.id,
        sheet: "base",
        description: `${theme.name} — base`,
      });
    }
  }

  // Alias cortos / legacy → hojas Excel reales (sin all/inventario inventados)
  const legacy: [string, string, string][] = [
    ["medallion.v_agua_general", "agua", "general"],
    ["medallion.v_agua_maqueta", "agua", "general"],
    ["medallion.v_agua_bitacora", "agua", "bitacora"],
    ["medallion.v_agua_modificaciones", "agua", "modificaciones"],
    ["medallion.v_agua_pagos", "agua", "pagos"],
    ["medallion.v_agua_control", "agua", "control_y_seguimiento_detalle_m"],
    ["medallion.v_agua_cdps_rc", "agua", "cdps_y_rc"],
    ["medallion.v_agua_variables_lider", "agua", "variables_lider"],
    ["medallion.v_agua_bitacora_estructuracion", "agua", "bitacora_estructuracion"],
    ["medallion.v_agua_y_saneamiento_alta", "agua", "general"],
    ["medallion.v_agua_y_saneamiento_bitacora", "agua", "bitacora"],
    // Puentes: nombres = hojas Excel
    ["medallion.v_puentes_base_general", "puentes", "base_general_puentes"],
    ["medallion.v_puentes_inventario", "puentes", "base_general_puentes"],
    ["medallion.v_puentes_bitacora", "puentes", "bitacora"],
    ["medallion.v_puentes_estructuracion", "puentes", "contratos_estructuracion"],
    ["medallion.v_puentes_contratos_estructuracion", "puentes", "contratos_estructuracion"],
    // Temas de una sola base
    ["medallion.v_carrotanques_all", "carrotanques", "base"],
    ["medallion.v_obras_emergencia_all", "obras_emergencia", "base"],
    ["medallion.v_banco_maquinaria_all", "banco_maquinaria", "base"],
    ["medallion.v_obras_impuestos_all", "obras_impuestos", "base"],
    ["medallion.v_declaratoria_all", "declaratoria", "base"],
    ["medallion.v_subsidios_arriendos_all", "subsidios_arriendos", "consolidado"],
    ["medallion.v_subsidios_arriendos_consolidado", "subsidios_arriendos", "consolidado"],
  ];

  parts.push("\n-- Alias legacy medallion.v_* → hojas reales");
  for (const [alias, sch, tbl] of legacy) {
    parts.push(`
DROP VIEW IF EXISTS ${alias} CASCADE;
CREATE VIEW ${alias} AS SELECT * FROM ${sch}.${tbl};
`);
  }

  // Drop explícito de nombres inventados (NO tocar agua.general = hoja Excel real)
  parts.push(`
DROP VIEW IF EXISTS medallion.v_puentes_all CASCADE;
DROP VIEW IF EXISTS medallion.v_agua_all CASCADE;
DROP VIEW IF EXISTS medallion.v_agua_y_saneamiento_all CASCADE;
DROP VIEW IF EXISTS puentes.general CASCADE;
DROP VIEW IF EXISTS puentes.inventario CASCADE;
DROP VIEW IF EXISTS puentes.estructuracion CASCADE;
DROP VIEW IF EXISTS agua.maqueta CASCADE;
DROP VIEW IF EXISTS agua.control CASCADE;
DROP VIEW IF EXISTS agua.cdps_rc CASCADE;
`);

  // Catálogo de conexiones (cada tabla = una fuente jalable)
  const connValues = conns.map(
    (c) =>
      `  (${sqlStr(c.connectionId)}, ${sqlStr(c.schemaName)}, ${sqlStr(c.tableName)}, ${sqlStr(c.themeId)}, ${sqlStr(c.sheet)}, ${sqlStr(c.description)}, ${sqlStr(`SELECT * FROM ${c.schemaName}.${c.tableName}`)})`,
  );

  parts.push(`
DROP VIEW IF EXISTS medallion.v_connections CASCADE;
CREATE VIEW medallion.v_connections AS
SELECT * FROM (VALUES
${connValues.join(",\n")}
) AS t(connection_id, schema_name, table_name, theme_id, sheet, description, sample_sql);

DROP VIEW IF EXISTS medallion.v_source_catalog CASCADE;
CREATE VIEW medallion.v_source_catalog AS
SELECT
  connection_id AS source_id,
  (schema_name || '.' || table_name) AS view_name,
  theme_id,
  sheet AS capa,
  description
FROM medallion.v_connections;

-- Mapa de JOIN intra-schema (solo dentro del mismo tema; no cruzar schemas)
DROP VIEW IF EXISTS medallion.v_join_map CASCADE;
CREATE VIEW medallion.v_join_map AS
SELECT * FROM (VALUES
  ('puentes', 'puentes.bitacora', 'puentes.base_general_puentes', 'id_puente', 'primaria', 'Activo: evento bitácora → puente inventario', 'SELECT b.*, i.clase, i.estado_puente FROM puentes.bitacora b JOIN puentes.base_general_puentes i ON i.id_puente = b.id_puente'),
  ('puentes', 'puentes.bitacora', 'puentes.base_general_puentes', 'codigo_operativo', 'secundaria', 'ID UNICO (alias legible del activo)', 'SELECT b.*, i.* FROM puentes.bitacora b JOIN puentes.base_general_puentes i ON i.codigo_operativo = b.codigo_operativo'),
  ('puentes', 'puentes.bitacora', 'puentes.contratos_estructuracion', 'clave_proceso', 'primaria', 'Proceso: bitácora → contrato (también convenio_o_cto / contrato_convenio)', 'SELECT b.*, e.etapa, e.estado FROM puentes.bitacora b JOIN puentes.contratos_estructuracion e ON e.clave_proceso = b.clave_proceso'),
  ('puentes', 'puentes.bitacora', 'puentes.contratos_estructuracion', 'convenio_o_cto', 'alternativa', 'Columna Excel bitácora «convenio o cto» = contrato', 'SELECT b.*, e.* FROM puentes.bitacora b JOIN puentes.contratos_estructuracion e ON e.convenio_o_cto = b.convenio_o_cto'),
  ('puentes', 'puentes.base_general_puentes', 'puentes.contratos_estructuracion', 'clave_proceso', 'primaria', 'Inventario → proceso de estructuración', 'SELECT i.*, e.etapa FROM puentes.base_general_puentes i JOIN puentes.contratos_estructuracion e ON e.clave_proceso = i.clave_proceso'),
  ('agua', 'agua.bitacora', 'agua.general', 'orden_de_proveeduria', 'primaria', 'OP une bitácora con maqueta/General', 'SELECT b.*, g.proveedor, g.estado_actual FROM agua.bitacora b JOIN agua.general g ON g.orden_de_proveeduria = b.orden_de_proveeduria'),
  ('agua', 'agua.pagos', 'agua.general', 'orden_de_proveeduria', 'primaria', 'OP une pagos con General', 'SELECT p.*, g.proveedor FROM agua.pagos p JOIN agua.general g ON g.orden_de_proveeduria = p.orden_de_proveeduria'),
  ('agua', 'agua.cdps_y_rc', 'agua.general', 'orden_de_proveeduria', 'primaria', 'OP une CDPS/RC con General', 'SELECT c.*, g.objeto FROM agua.cdps_y_rc c JOIN agua.general g ON g.orden_de_proveeduria = c.orden_de_proveeduria'),
  ('agua', 'agua.modificaciones', 'agua.general', 'orden_de_proveeduria', 'primaria', 'OP une modificaciones con General', 'SELECT m.*, g.proveedor FROM agua.modificaciones m JOIN agua.general g ON g.orden_de_proveeduria = m.orden_de_proveeduria'),
  ('agua', 'agua.bitacora_estructuracion', 'agua.general', 'orden_de_proveeduria', 'primaria', 'OP une bitácora estructuración con General', 'SELECT be.*, g.municipio FROM agua.bitacora_estructuracion be JOIN agua.general g ON g.orden_de_proveeduria = be.orden_de_proveeduria'),
  ('agua', 'agua.control_y_seguimiento_detalle_m', 'agua.general', 'orden_de_proveeduria', 'primaria', 'OP une control físico con General', 'SELECT ct.*, g.tipo_de_orden FROM agua.control_y_seguimiento_detalle_m ct JOIN agua.general g ON g.orden_de_proveeduria = ct.orden_de_proveeduria'),
  ('agua', 'agua.variables_lider', 'agua.general', 'orden_de_proveeduria', 'primaria', 'OP une variables líder con General', 'SELECT v.*, g.objeto FROM agua.variables_lider v JOIN agua.general g ON g.orden_de_proveeduria = v.orden_de_proveeduria'),
  ('agua', 'agua.pagos', 'agua.bitacora', 'orden_de_proveeduria', 'secundaria', 'Misma OP entre satélites (historial distinto)', 'SELECT p.orden_de_proveeduria, count(DISTINCT b.record_id) AS eventos FROM agua.pagos p LEFT JOIN agua.bitacora b ON b.orden_de_proveeduria = p.orden_de_proveeduria GROUP BY 1'),
  ('subsidios_arriendos', 'subsidios_arriendos.consolidado', 'subsidios_arriendos.consolidado', 'uuid', 'primaria', 'Identidad del registro (UUID). Capas futuras de seguimiento se unen por uuid', 'SELECT c.uuid, c.numero_envio, c.n_orden, c.municipio FROM subsidios_arriendos.consolidado c')
) AS t(schema_name, left_table, right_table, join_key, priority, description, sample_sql);
`);

  // Grants
  const grantSchemas = ["medallion", ...schemas];
  parts.push(`
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'medallion_reader') THEN
    ${grantSchemas
      .map(
        (s) => `EXECUTE 'GRANT USAGE ON SCHEMA ${s} TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA ${s} TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA ${s} GRANT SELECT ON TABLES TO medallion_reader';`,
      )
      .join("\n    ")}
  END IF;
END $$;
`);

  fs.writeFileSync(OUT, parts.join("\n"), "utf8");
  console.log("Wrote", OUT);
  console.log("Schemas:", [...schemas].sort().join(", "));
  console.log("Connections:", conns.length);
  for (const c of conns) {
    console.log(`  ${c.schemaName}.${c.tableName}  (${c.themeId})`);
  }
}

main();
