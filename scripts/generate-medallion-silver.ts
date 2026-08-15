/**
 * Genera DDL Silver (tablas físicas + PK/FK/índices) para Agua y Puentes.
 *
 * Fuente de columnas: vistas Bronze tipadas (`agua.*` / `puentes.*`) vía
 * MEDALLION_DATABASE_URL (introspección). Si no hay DB, parsea 003.
 *
 *   npx tsx scripts/generate-medallion-silver.ts
 *   → sql/medallion/010_silver_tables.sql
 *   → sql/medallion/011_silver_grants.sql
 *   → scripts/generated/silver-sync-manifest.json
 */
import fs from "fs";
import path from "path";
import postgres from "postgres";
import {
  loadMedallionEnv,
  maskDbUrl,
} from "./lib/medallion-db-url";

const OUT_DDL = path.join(process.cwd(), "sql/medallion/010_silver_tables.sql");
const OUT_GRANTS = path.join(process.cwd(), "sql/medallion/011_silver_grants.sql");
const OUT_MANIFEST = path.join(
  process.cwd(),
  "scripts/generated/silver-sync-manifest.json",
);

type Col = { name: string; dataType: string; udtName: string };

type SheetDef = {
  bronzeSchema: string;
  bronzeTable: string;
  silverSchema: string;
  silverTable: string;
  excelSheet: string;
  role: "hub" | "satellite" | "dim";
};

const AGUA_SHEETS: SheetDef[] = [
  {
    bronzeSchema: "agua",
    bronzeTable: "general",
    silverSchema: "silver_agua",
    silverTable: "general",
    excelSheet: "General",
    role: "hub",
  },
  {
    bronzeSchema: "agua",
    bronzeTable: "bitacora",
    silverSchema: "silver_agua",
    silverTable: "bitacora",
    excelSheet: "bitacora",
    role: "satellite",
  },
  {
    bronzeSchema: "agua",
    bronzeTable: "pagos",
    silverSchema: "silver_agua",
    silverTable: "pagos",
    excelSheet: "PAGOS",
    role: "satellite",
  },
  {
    bronzeSchema: "agua",
    bronzeTable: "modificaciones",
    silverSchema: "silver_agua",
    silverTable: "modificaciones",
    excelSheet: "modificaciones",
    role: "satellite",
  },
  {
    bronzeSchema: "agua",
    bronzeTable: "cdps_y_rc",
    silverSchema: "silver_agua",
    silverTable: "cdps_y_rc",
    excelSheet: "CDPS Y RC",
    role: "satellite",
  },
  {
    bronzeSchema: "agua",
    bronzeTable: "bitacora_estructuracion",
    silverSchema: "silver_agua",
    silverTable: "bitacora_estructuracion",
    excelSheet: "bitacora estructuracion",
    role: "satellite",
  },
  {
    bronzeSchema: "agua",
    bronzeTable: "control_y_seguimiento_detalle_m",
    silverSchema: "silver_agua",
    silverTable: "control_y_seguimiento_detalle_m",
    excelSheet: "control y seguimiento-detalle m",
    role: "satellite",
  },
  {
    bronzeSchema: "agua",
    bronzeTable: "variables_lider",
    silverSchema: "silver_agua",
    silverTable: "variables_lider",
    excelSheet: "Variables líder",
    role: "satellite",
  },
];

const PUENTES_SHEETS: SheetDef[] = [
  {
    bronzeSchema: "puentes",
    bronzeTable: "contratos_estructuracion",
    silverSchema: "silver_puentes",
    silverTable: "contratos_estructuracion",
    excelSheet: "Contratos Estructuracion",
    role: "hub",
  },
  {
    bronzeSchema: "puentes",
    bronzeTable: "base_general_puentes",
    silverSchema: "silver_puentes",
    silverTable: "base_general_puentes",
    excelSheet: "Base General Puentes",
    role: "hub",
  },
  {
    bronzeSchema: "puentes",
    bronzeTable: "bitacora",
    silverSchema: "silver_puentes",
    silverTable: "bitacora",
    excelSheet: "bitacora",
    role: "satellite",
  },
];

function sqlStr(s: string): string {
  return `'${String(s).replace(/'/g, "''")}'`;
}

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    return `"${name.replace(/"/g, '""')}"`;
  }
  return name;
}

function pgType(col: Col): string {
  const n = col.name;
  if (n === "record_id") return "uuid";
  if (n === "created_at" || n === "updated_at" || n === "synced_at") {
    return "timestamptz";
  }
  if (n === "valor" || col.dataType === "numeric") return "numeric";
  if (col.dataType === "uuid") return "uuid";
  if (col.dataType === "timestamp with time zone") return "timestamptz";
  if (col.dataType === "timestamp without time zone") return "timestamp";
  if (col.dataType === "integer") return "integer";
  if (col.dataType === "bigint") return "bigint";
  if (col.dataType === "boolean") return "boolean";
  if (col.dataType === "jsonb") return "jsonb";
  return "text";
}

async function loadColsFromDb(
  sql: ReturnType<typeof postgres>,
  schema: string,
  table: string,
): Promise<Col[]> {
  const rows = await sql`
    SELECT column_name AS name, data_type AS "dataType", udt_name AS "udtName"
    FROM information_schema.columns
    WHERE table_schema = ${schema} AND table_name = ${table}
    ORDER BY ordinal_position
  `;
  return rows.map((r) => ({
    name: String(r.name),
    dataType: String(r.dataType),
    udtName: String(r.udtName),
  }));
}

/** Fallback: parse CREATE VIEW … AS SELECT cols from 003. */
function loadColsFromSqlFile(schema: string, table: string): Col[] {
  const sqlPath = path.join(process.cwd(), "sql/medallion/003_theme_capa_views.sql");
  const text = fs.readFileSync(sqlPath, "utf8");
  const re = new RegExp(
    `CREATE VIEW ${schema}\\.${table} AS\\nSELECT\\n([\\s\\S]*?)\\nFROM public\\.records`,
    "i",
  );
  const m = text.match(re);
  if (!m) throw new Error(`No pude parsear columnas de ${schema}.${table} en 003`);
  const cols: Col[] = [];
  for (const line of m[1].split("\n")) {
    const s = line.trim().replace(/,$/, "");
    if (!s) continue;
    let name: string | null = null;
    const asM = s.match(/\bAS\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*$/i);
    if (asM) name = asM[1];
    else {
      const bare = s.match(/^r\.(theme_id|source|created_at|updated_at)$/i);
      if (bare) name = bare[1];
    }
    if (!name) continue;
    let dataType = "text";
    if (name === "record_id") dataType = "uuid";
    else if (name === "created_at" || name === "updated_at") dataType = "timestamp with time zone";
    else if (name === "valor") dataType = "numeric";
    cols.push({ name, dataType, udtName: dataType });
  }
  return cols;
}

function emitTableSql(
  sheet: SheetDef,
  cols: Col[],
  extras: { unique?: string[]; indexes?: string[]; fks?: string[]; comments?: string[] },
): string {
  const fq = `${sheet.silverSchema}.${sheet.silverTable}`;
  const colLines = cols.map((c) => {
    const t = pgType(c);
    const notNull =
      c.name === "record_id" ||
      c.name === "theme_id" ||
      c.name === "created_at" ||
      c.name === "updated_at"
        ? " NOT NULL"
        : "";
    return `  ${quoteIdent(c.name)} ${t}${notNull}`;
  });
  colLines.push("  synced_at timestamptz NOT NULL DEFAULT now()");

  const parts: string[] = [];
  parts.push(`DROP TABLE IF EXISTS ${fq} CASCADE;`);
  parts.push(`CREATE TABLE ${fq} (`);
  parts.push(colLines.join(",\n") + ",");
  parts.push(`  CONSTRAINT ${sheet.silverTable}_pkey PRIMARY KEY (record_id)`);
  for (const u of extras.unique || []) {
    parts[parts.length - 1] += ",";
    parts.push(`  ${u}`);
  }
  for (const fk of extras.fks || []) {
    parts[parts.length - 1] += ",";
    parts.push(`  ${fk}`);
  }
  parts.push(");");
  parts.push("");
  parts.push(
    `COMMENT ON TABLE ${fq} IS ${sqlStr(
      `Silver — ${sheet.bronzeSchema} hoja Excel «${sheet.excelSheet}» (desde ${sheet.bronzeSchema}.${sheet.bronzeTable})`,
    )};`,
  );
  parts.push(
    `COMMENT ON COLUMN ${fq}.record_id IS 'PK linaje → public.records.id';`,
  );
  parts.push(
    `COMMENT ON COLUMN ${fq}.synced_at IS 'Timestamp del último sync Bronze→Silver';`,
  );
  for (const c of extras.comments || []) parts.push(c);
  for (const idx of extras.indexes || []) parts.push(idx);
  parts.push("");
  return parts.join("\n");
}

function buildAguaSql(colsByTable: Map<string, Col[]>): string {
  const parts: string[] = [];
  parts.push("-- === silver_agua ===");
  parts.push("CREATE SCHEMA IF NOT EXISTS silver_agua;");
  parts.push("");
  parts.push(`COMMENT ON SCHEMA silver_agua IS ${sqlStr(
    "Silver relacional Agua: dim orden + tablas por hoja Excel (PK record_id, FK OP)",
  )};`);
  parts.push("");

  // Dim hub — absorbs orphan OPs from satellites
  parts.push(`DROP TABLE IF EXISTS silver_agua.orden CASCADE;
CREATE TABLE silver_agua.orden (
  orden_de_proveeduria text NOT NULL,
  first_seen_at timestamptz,
  last_seen_at timestamptz,
  source_tables text[] NOT NULL DEFAULT '{}',
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orden_pkey PRIMARY KEY (orden_de_proveeduria)
);
COMMENT ON TABLE silver_agua.orden IS 'Dim OP: unión de todas las OPs presentes en hojas Agua (incluye huérfanas sin fila en general)';
COMMENT ON COLUMN silver_agua.orden.orden_de_proveeduria IS 'Llave de negocio hub Agua (Orden de Proveeduría)';
`);

  for (const sheet of AGUA_SHEETS) {
    const cols = colsByTable.get(`${sheet.bronzeSchema}.${sheet.bronzeTable}`);
    if (!cols?.length) throw new Error(`Sin columnas para ${sheet.bronzeTable}`);
    const fks = [
      `CONSTRAINT ${sheet.silverTable}_op_fk FOREIGN KEY (orden_de_proveeduria)
    REFERENCES silver_agua.orden (orden_de_proveeduria)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED`,
    ];
    const unique =
      sheet.silverTable === "general"
        ? [
            `CONSTRAINT general_orden_uq UNIQUE (orden_de_proveeduria)`,
          ]
        : [];
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_${sheet.silverTable}_op ON silver_agua.${sheet.silverTable} (orden_de_proveeduria);`,
      `CREATE INDEX IF NOT EXISTS idx_${sheet.silverTable}_synced ON silver_agua.${sheet.silverTable} (synced_at);`,
    ];
    if (cols.some((c) => c.name === "departamento")) {
      indexes.push(
        `CREATE INDEX IF NOT EXISTS idx_${sheet.silverTable}_depto ON silver_agua.${sheet.silverTable} (departamento);`,
      );
    }
    if (cols.some((c) => c.name === "municipio")) {
      indexes.push(
        `CREATE INDEX IF NOT EXISTS idx_${sheet.silverTable}_muni ON silver_agua.${sheet.silverTable} (municipio);`,
      );
    }
    const comments = [
      `COMMENT ON COLUMN silver_agua.${sheet.silverTable}.orden_de_proveeduria IS 'FK → silver_agua.orden (hub OP)';`,
    ];
    parts.push(
      emitTableSql(sheet, cols, { unique, fks, indexes, comments }),
    );
  }
  return parts.join("\n");
}

function buildPuentesSql(colsByTable: Map<string, Col[]>): string {
  const parts: string[] = [];
  parts.push("-- === silver_puentes ===");
  parts.push("CREATE SCHEMA IF NOT EXISTS silver_puentes;");
  parts.push("");
  parts.push(`COMMENT ON SCHEMA silver_puentes IS ${sqlStr(
    "Silver relacional Puentes: inventario + contratos + bitácora (FKs id_puente / clave_proceso)",
  )};`);
  parts.push("");

  // Load order: contratos → inventario → bitacora
  const contratos = PUENTES_SHEETS.find((s) => s.silverTable === "contratos_estructuracion")!;
  const inventario = PUENTES_SHEETS.find((s) => s.silverTable === "base_general_puentes")!;
  const bitacora = PUENTES_SHEETS.find((s) => s.silverTable === "bitacora")!;

  const cCols = colsByTable.get("puentes.contratos_estructuracion")!;
  parts.push(
    emitTableSql(contratos, cCols, {
      unique: [
        "CONSTRAINT contratos_clave_proceso_uq UNIQUE (clave_proceso)",
        "CONSTRAINT contratos_convenio_uq UNIQUE (convenio_o_cto)",
      ],
      indexes: [
        "CREATE INDEX IF NOT EXISTS idx_contratos_clave ON silver_puentes.contratos_estructuracion (clave_proceso);",
        "CREATE INDEX IF NOT EXISTS idx_contratos_convenio ON silver_puentes.contratos_estructuracion (convenio_o_cto);",
        "CREATE INDEX IF NOT EXISTS idx_contratos_synced ON silver_puentes.contratos_estructuracion (synced_at);",
      ],
      comments: [
        "COMMENT ON COLUMN silver_puentes.contratos_estructuracion.clave_proceso IS 'Llave de proceso (hub contratos); UNIQUE';",
        "COMMENT ON COLUMN silver_puentes.contratos_estructuracion.convenio_o_cto IS 'Texto Excel convenio/cto; UNIQUE en datos actuales';",
      ],
    }),
  );

  const iCols = colsByTable.get("puentes.base_general_puentes")!;
  parts.push(
    emitTableSql(inventario, iCols, {
      unique: ["CONSTRAINT base_general_id_puente_uq UNIQUE (id_puente)"],
      fks: [
        `CONSTRAINT base_general_clave_fk FOREIGN KEY (clave_proceso)
    REFERENCES silver_puentes.contratos_estructuracion (clave_proceso)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED`,
      ],
      indexes: [
        "CREATE INDEX IF NOT EXISTS idx_bgp_id_puente ON silver_puentes.base_general_puentes (id_puente);",
        "CREATE INDEX IF NOT EXISTS idx_bgp_clave ON silver_puentes.base_general_puentes (clave_proceso);",
        "CREATE INDEX IF NOT EXISTS idx_bgp_convenio ON silver_puentes.base_general_puentes (convenio_o_cto);",
        "CREATE INDEX IF NOT EXISTS idx_bgp_depto ON silver_puentes.base_general_puentes (departamento);",
        "CREATE INDEX IF NOT EXISTS idx_bgp_muni ON silver_puentes.base_general_puentes (municipio);",
        "CREATE INDEX IF NOT EXISTS idx_bgp_synced ON silver_puentes.base_general_puentes (synced_at);",
      ],
      comments: [
        "COMMENT ON COLUMN silver_puentes.base_general_puentes.id_puente IS 'Activo; UNIQUE; hub inventario';",
        "COMMENT ON COLUMN silver_puentes.base_general_puentes.clave_proceso IS 'FK nullable → contratos_estructuracion.clave_proceso';",
      ],
    }),
  );

  const bCols = colsByTable.get("puentes.bitacora")!;
  parts.push(
    emitTableSql(bitacora, bCols, {
      fks: [
        `CONSTRAINT bitacora_id_puente_fk FOREIGN KEY (id_puente)
    REFERENCES silver_puentes.base_general_puentes (id_puente)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED`,
        `CONSTRAINT bitacora_clave_fk FOREIGN KEY (clave_proceso)
    REFERENCES silver_puentes.contratos_estructuracion (clave_proceso)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED`,
      ],
      indexes: [
        "CREATE INDEX IF NOT EXISTS idx_pbit_id_puente ON silver_puentes.bitacora (id_puente);",
        "CREATE INDEX IF NOT EXISTS idx_pbit_clave ON silver_puentes.bitacora (clave_proceso);",
        "CREATE INDEX IF NOT EXISTS idx_pbit_convenio ON silver_puentes.bitacora (convenio_o_cto);",
        "CREATE INDEX IF NOT EXISTS idx_pbit_depto ON silver_puentes.bitacora (departamento);",
        "CREATE INDEX IF NOT EXISTS idx_pbit_muni ON silver_puentes.bitacora (municipio);",
        "CREATE INDEX IF NOT EXISTS idx_pbit_synced ON silver_puentes.bitacora (synced_at);",
      ],
      comments: [
        "COMMENT ON COLUMN silver_puentes.bitacora.id_puente IS 'FK → base_general_puentes.id_puente';",
        "COMMENT ON COLUMN silver_puentes.bitacora.clave_proceso IS 'FK nullable → contratos_estructuracion.clave_proceso';",
      ],
    }),
  );

  return parts.join("\n");
}

function buildCatalogSql(): string {
  return `
-- === Catálogo Silver en medallion ===
CREATE SCHEMA IF NOT EXISTS medallion;

DROP VIEW IF EXISTS medallion.v_silver_catalog CASCADE;
CREATE VIEW medallion.v_silver_catalog AS
SELECT * FROM (VALUES
  ('silver_agua.orden', 'silver_agua', 'orden', 'agua-y-saneamiento', 'dim', 'Dim OP (unión de llaves)', 'SELECT * FROM silver_agua.orden'),
  ('silver_agua.general', 'silver_agua', 'general', 'agua-y-saneamiento', 'General', 'Hub General 1:1 OP', 'SELECT * FROM silver_agua.general'),
  ('silver_agua.bitacora', 'silver_agua', 'bitacora', 'agua-y-saneamiento', 'bitacora', 'Eventos estado', 'SELECT * FROM silver_agua.bitacora'),
  ('silver_agua.pagos', 'silver_agua', 'pagos', 'agua-y-saneamiento', 'PAGOS', 'Desembolsos', 'SELECT * FROM silver_agua.pagos'),
  ('silver_agua.modificaciones', 'silver_agua', 'modificaciones', 'agua-y-saneamiento', 'modificaciones', 'Modificaciones contractuales', 'SELECT * FROM silver_agua.modificaciones'),
  ('silver_agua.cdps_y_rc', 'silver_agua', 'cdps_y_rc', 'agua-y-saneamiento', 'CDPS Y RC', 'CDP / RC', 'SELECT * FROM silver_agua.cdps_y_rc'),
  ('silver_agua.bitacora_estructuracion', 'silver_agua', 'bitacora_estructuracion', 'agua-y-saneamiento', 'bitacora estructuracion', 'Seguimiento operativo', 'SELECT * FROM silver_agua.bitacora_estructuracion'),
  ('silver_agua.control_y_seguimiento_detalle_m', 'silver_agua', 'control_y_seguimiento_detalle_m', 'agua-y-saneamiento', 'control y seguimiento-detalle m', 'Control físico', 'SELECT * FROM silver_agua.control_y_seguimiento_detalle_m'),
  ('silver_agua.variables_lider', 'silver_agua', 'variables_lider', 'agua-y-saneamiento', 'Variables líder', 'Facetas líder', 'SELECT * FROM silver_agua.variables_lider'),
  ('silver_puentes.contratos_estructuracion', 'silver_puentes', 'contratos_estructuracion', 'puentes', 'Contratos Estructuracion', 'Hub proceso', 'SELECT * FROM silver_puentes.contratos_estructuracion'),
  ('silver_puentes.base_general_puentes', 'silver_puentes', 'base_general_puentes', 'puentes', 'Base General Puentes', 'Inventario / activo', 'SELECT * FROM silver_puentes.base_general_puentes'),
  ('silver_puentes.bitacora', 'silver_puentes', 'bitacora', 'puentes', 'bitacora', 'Eventos de estado', 'SELECT * FROM silver_puentes.bitacora')
) AS t(source_id, schema_name, table_name, theme_id, sheet, description, sample_sql);

DROP VIEW IF EXISTS medallion.v_silver_join_map CASCADE;
CREATE VIEW medallion.v_silver_join_map AS
SELECT * FROM (VALUES
  ('silver_agua', 'silver_agua.bitacora', 'silver_agua.orden', 'orden_de_proveeduria', 'primaria', 'Satélite → dim OP', 'SELECT b.*, o.* FROM silver_agua.bitacora b JOIN silver_agua.orden o ON o.orden_de_proveeduria = b.orden_de_proveeduria'),
  ('silver_agua', 'silver_agua.bitacora', 'silver_agua.general', 'orden_de_proveeduria', 'primaria', 'Bitácora → General (vía OP; LEFT si huérfana)', 'SELECT b.*, g.proveedor FROM silver_agua.bitacora b LEFT JOIN silver_agua.general g ON g.orden_de_proveeduria = b.orden_de_proveeduria'),
  ('silver_agua', 'silver_agua.pagos', 'silver_agua.general', 'orden_de_proveeduria', 'primaria', 'Pagos → General', 'SELECT p.*, g.proveedor FROM silver_agua.pagos p LEFT JOIN silver_agua.general g ON g.orden_de_proveeduria = p.orden_de_proveeduria'),
  ('silver_agua', 'silver_agua.modificaciones', 'silver_agua.general', 'orden_de_proveeduria', 'primaria', 'Modificaciones → General', 'SELECT m.*, g.proveedor FROM silver_agua.modificaciones m LEFT JOIN silver_agua.general g ON g.orden_de_proveeduria = m.orden_de_proveeduria'),
  ('silver_agua', 'silver_agua.cdps_y_rc', 'silver_agua.general', 'orden_de_proveeduria', 'primaria', 'CDPS/RC → General', 'SELECT c.*, g.objeto FROM silver_agua.cdps_y_rc c LEFT JOIN silver_agua.general g ON g.orden_de_proveeduria = c.orden_de_proveeduria'),
  ('silver_agua', 'silver_agua.control_y_seguimiento_detalle_m', 'silver_agua.general', 'orden_de_proveeduria', 'primaria', 'Control → General', 'SELECT ct.*, g.tipo_de_orden FROM silver_agua.control_y_seguimiento_detalle_m ct LEFT JOIN silver_agua.general g ON g.orden_de_proveeduria = ct.orden_de_proveeduria'),
  ('silver_agua', 'silver_agua.general', 'silver_agua.orden', 'orden_de_proveeduria', 'primaria', 'General 1:1 dim OP', 'SELECT g.* FROM silver_agua.general g JOIN silver_agua.orden o ON o.orden_de_proveeduria = g.orden_de_proveeduria'),
  ('silver_puentes', 'silver_puentes.bitacora', 'silver_puentes.base_general_puentes', 'id_puente', 'primaria', 'Bitácora → inventario (FK)', 'SELECT b.*, i.clase FROM silver_puentes.bitacora b JOIN silver_puentes.base_general_puentes i ON i.id_puente = b.id_puente'),
  ('silver_puentes', 'silver_puentes.bitacora', 'silver_puentes.contratos_estructuracion', 'clave_proceso', 'primaria', 'Bitácora → contratos (FK nullable)', 'SELECT b.*, e.etapa FROM silver_puentes.bitacora b LEFT JOIN silver_puentes.contratos_estructuracion e ON e.clave_proceso = b.clave_proceso'),
  ('silver_puentes', 'silver_puentes.base_general_puentes', 'silver_puentes.contratos_estructuracion', 'clave_proceso', 'primaria', 'Inventario → contratos (FK nullable)', 'SELECT i.*, e.etapa FROM silver_puentes.base_general_puentes i LEFT JOIN silver_puentes.contratos_estructuracion e ON e.clave_proceso = i.clave_proceso')
) AS t(schema_name, left_table, right_table, join_key, priority, description, sample_sql);
`;
}

function buildGrantsSql(): string {
  return `-- AUTO-GENERADO: npx tsx scripts/generate-medallion-silver.ts
-- Grants SELECT Silver → medallion_reader (+ default privileges)

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'medallion_reader') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA silver_agua TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA silver_agua TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA silver_agua GRANT SELECT ON TABLES TO medallion_reader';

    EXECUTE 'GRANT USAGE ON SCHEMA silver_puentes TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA silver_puentes TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA silver_puentes GRANT SELECT ON TABLES TO medallion_reader';

    EXECUTE 'GRANT USAGE ON SCHEMA medallion TO medallion_reader';
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA medallion TO medallion_reader';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA medallion GRANT SELECT ON TABLES TO medallion_reader';
  END IF;
END $$;
`;
}

async function main() {
  loadMedallionEnv();
  const url = process.env.MEDALLION_DATABASE_URL || "";
  const colsByTable = new Map<string, Col[]>();
  let source: "db" | "sql-file" = "sql-file";

  if (url) {
    console.log("Introspecting Bronze views:", maskDbUrl(url));
    const sql = postgres(url, {
      max: 1,
      ssl: "require",
      connect_timeout: 25,
      idle_timeout: 5,
    });
    try {
      for (const sheet of [...AGUA_SHEETS, ...PUENTES_SHEETS]) {
        const key = `${sheet.bronzeSchema}.${sheet.bronzeTable}`;
        const cols = await loadColsFromDb(sql, sheet.bronzeSchema, sheet.bronzeTable);
        if (!cols.length) throw new Error(`Vista vacía / inexistente: ${key}`);
        colsByTable.set(key, cols);
        console.log(`  ${key}: ${cols.length} cols`);
      }
      source = "db";
    } finally {
      await sql.end({ timeout: 2 });
    }
  } else {
    console.log("Sin MEDALLION_DATABASE_URL — parseando 003…");
    for (const sheet of [...AGUA_SHEETS, ...PUENTES_SHEETS]) {
      const key = `${sheet.bronzeSchema}.${sheet.bronzeTable}`;
      colsByTable.set(key, loadColsFromSqlFile(sheet.bronzeSchema, sheet.bronzeTable));
      console.log(`  ${key}: ${colsByTable.get(key)!.length} cols (file)`);
    }
  }

  const header = `-- AUTO-GENERADO: npx tsx scripts/generate-medallion-silver.ts
-- Silver físico (Agua + Puentes). Fuente columnas: ${source}.
-- NO modifica public.records ni vistas Bronze agua.*/puentes.*.
-- Aplicar con rol postgres (Session pooler :5432).
-- Sync: npm run medallion:sync-silver

`;

  const ddl =
    header +
    buildAguaSql(colsByTable) +
    "\n" +
    buildPuentesSql(colsByTable) +
    "\n" +
    buildCatalogSql() +
    "\n";

  fs.mkdirSync(path.dirname(OUT_DDL), { recursive: true });
  fs.writeFileSync(OUT_DDL, ddl);
  fs.writeFileSync(OUT_GRANTS, buildGrantsSql());

  const manifest = {
    generatedAt: new Date().toISOString(),
    columnSource: source,
    agua: AGUA_SHEETS.map((s) => ({
      ...s,
      columns: (colsByTable.get(`${s.bronzeSchema}.${s.bronzeTable}`) || []).map(
        (c) => c.name,
      ),
    })),
    puentes: PUENTES_SHEETS.map((s) => ({
      ...s,
      columns: (colsByTable.get(`${s.bronzeSchema}.${s.bronzeTable}`) || []).map(
        (c) => c.name,
      ),
    })),
    dimAgua: "silver_agua.orden",
  };
  fs.mkdirSync(path.dirname(OUT_MANIFEST), { recursive: true });
  fs.writeFileSync(OUT_MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

  console.log("Wrote", OUT_DDL);
  console.log("Wrote", OUT_GRANTS);
  console.log("Wrote", OUT_MANIFEST);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
