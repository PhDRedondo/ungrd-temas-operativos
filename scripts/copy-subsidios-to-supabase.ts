/**
 * Copia Subsidios de Arriendos (theme + records vivos) de local a Supabase.
 * No borra otros temas. Upsert por id; no toca deleted_at ajenos.
 *
 *   npx tsx scripts/copy-subsidios-to-supabase.ts
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });
import fs from "fs";
import path from "path";
import postgres from "postgres";
import {
  loadMedallionEnv,
  maskDbUrl,
  resolveAdminDatabaseUrl,
} from "./lib/medallion-db-url";

loadMedallionEnv();

function sqlStr(s: string): string {
  return `'${String(s).replace(/'/g, "''")}'`;
}

/** Añade subsidios al catálogo sin recrear vistas de otros temas. */
async function mergeCatalog(dest: ReturnType<typeof postgres>) {
  const conns = await dest`
    SELECT connection_id, schema_name, table_name, theme_id, sheet, description, sample_sql
    FROM medallion.v_connections
  `;
  const has = conns.some((c) => c.connection_id === "subsidios_arriendos.consolidado");
  const rows = has
    ? conns
    : [
        ...conns,
        {
          connection_id: "subsidios_arriendos.consolidado",
          schema_name: "subsidios_arriendos",
          table_name: "consolidado",
          theme_id: "subsidios-de-arriendos",
          sheet: "consolidado",
          description: "Subsidios de Arriendos — consolidado",
          sample_sql: "SELECT * FROM subsidios_arriendos.consolidado",
        },
      ];
  const values = rows.map(
    (c) =>
      `  (${sqlStr(c.connection_id)}, ${sqlStr(c.schema_name)}, ${sqlStr(c.table_name)}, ${sqlStr(c.theme_id)}, ${sqlStr(c.sheet)}, ${sqlStr(c.description)}, ${sqlStr(c.sample_sql)})`,
  );
  await dest.unsafe(`
DROP VIEW IF EXISTS medallion.v_connections CASCADE;
CREATE VIEW medallion.v_connections AS
SELECT * FROM (VALUES
${values.join(",\n")}
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
`);
  console.log(
    has
      ? "catálogo: subsidios_arriendos.consolidado ya estaba"
      : "catálogo: añadí subsidios_arriendos.consolidado",
  );

  const joins = await dest`
    SELECT schema_name, left_table, right_table, join_key, priority, description, sample_sql
    FROM medallion.v_join_map
  `;
  const hasJoin = joins.some(
    (j) =>
      j.schema_name === "subsidios_arriendos" &&
      j.join_key === "uuid",
  );
  const joinRows = hasJoin
    ? joins
    : [
        ...joins,
        {
          schema_name: "subsidios_arriendos",
          left_table: "subsidios_arriendos.consolidado",
          right_table: "subsidios_arriendos.consolidado",
          join_key: "uuid",
          priority: "primaria",
          description:
            "Identidad del registro (UUID). Capas futuras de seguimiento se unen por uuid",
          sample_sql:
            "SELECT c.uuid, c.numero_envio, c.n_orden, c.municipio FROM subsidios_arriendos.consolidado c",
        },
      ];
  const joinValues = joinRows.map(
    (j) =>
      `  (${sqlStr(j.schema_name)}, ${sqlStr(j.left_table)}, ${sqlStr(j.right_table)}, ${sqlStr(j.join_key)}, ${sqlStr(j.priority)}, ${sqlStr(j.description)}, ${sqlStr(j.sample_sql)})`,
  );
  await dest.unsafe(`
DROP VIEW IF EXISTS medallion.v_join_map CASCADE;
CREATE VIEW medallion.v_join_map AS
SELECT * FROM (VALUES
${joinValues.join(",\n")}
) AS t(schema_name, left_table, right_table, join_key, priority, description, sample_sql);
`);
  console.log(hasJoin ? "join_map: uuid ya estaba" : "join_map: añadí uuid subsidios");
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function main() {
  const localUrl =
    process.env.DATABASE_URL ||
    "postgresql://ungrd:ungrd@127.0.0.1:5432/ungrd_temas";
  if (!/127\.0\.0\.1|localhost/i.test(localUrl)) {
    throw new Error("DATABASE_URL no apunta a local; aborto");
  }
  const { adminUrl, source } = resolveAdminDatabaseUrl();
  console.log("origen", maskDbUrl(localUrl));
  console.log("destino", maskDbUrl(adminUrl), "via", source);

  const local = postgres(localUrl, { max: 2, ssl: false });
  const dest = postgres(adminUrl, {
    max: 2,
    ssl: "require",
    prepare: false,
    connect_timeout: 30,
  });

  const [theme] = await local`
    SELECT id, name, short_name, description, unit, value_label, schema_version, field_schema, updated_at
    FROM themes WHERE id = 'subsidios-de-arriendos'
  `;
  if (!theme) throw new Error("Falta theme subsidios-de-arriendos en local");
  await dest`
    INSERT INTO themes (id, name, short_name, description, unit, value_label, schema_version, field_schema, updated_at)
    VALUES (
      ${theme.id}, ${theme.name}, ${theme.short_name}, ${theme.description},
      ${theme.unit}, ${theme.value_label}, ${theme.schema_version},
      ${dest.json(theme.field_schema as never)}, ${theme.updated_at}
    )
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      short_name = EXCLUDED.short_name,
      description = EXCLUDED.description,
      unit = EXCLUDED.unit,
      value_label = EXCLUDED.value_label,
      schema_version = EXCLUDED.schema_version,
      field_schema = EXCLUDED.field_schema,
      updated_at = EXCLUDED.updated_at
  `;
  console.log("theme upsert v" + theme.schema_version);

  const rows = await local`
    SELECT id, theme_id, departamento, municipio, fecha::text AS fecha, estado, valor::text AS valor,
           payload, source, content_hash, created_at, updated_at
    FROM records
    WHERE theme_id = 'subsidios-de-arriendos' AND deleted_at IS NULL
      AND source IN ('excel', 'form', 'manual')
  `;
  let inserted = 0;
  for (const part of chunk(rows, 80)) {
    await dest`
      INSERT INTO records (
        id, theme_id, departamento, municipio, fecha, estado, valor,
        payload, source, content_hash, created_at, updated_at
      )
      SELECT * FROM jsonb_to_recordset(${dest.json(
        part.map((r) => ({
          id: r.id,
          theme_id: r.theme_id,
          departamento: r.departamento,
          municipio: r.municipio,
          fecha: r.fecha,
          estado: r.estado,
          valor: r.valor,
          payload: r.payload,
          source: r.source,
          content_hash: r.content_hash,
          created_at: r.created_at,
          updated_at: r.updated_at,
        })) as never,
      )}) AS x(
        id uuid, theme_id text, departamento text, municipio text, fecha date,
        estado text, valor numeric, payload jsonb, source text, content_hash text,
        created_at timestamptz, updated_at timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        departamento = EXCLUDED.departamento,
        municipio = EXCLUDED.municipio,
        fecha = EXCLUDED.fecha,
        estado = EXCLUDED.estado,
        valor = EXCLUDED.valor,
        payload = EXCLUDED.payload,
        content_hash = EXCLUDED.content_hash,
        updated_at = EXCLUDED.updated_at,
        deleted_at = NULL
    `;
    inserted += part.length;
  }
  console.log("records upsert", inserted);

  const sqlPath = path.join(
    process.cwd(),
    "sql/medallion/003_theme_capa_views.sql",
  );
  const full = fs.readFileSync(sqlPath, "utf8");
  const start = full.indexOf("-- === Subsidios de Arriendos");
  const next = full.indexOf("\n-- === ", start + 10);
  if (start < 0) throw new Error("No encontré bloque Subsidios en 003");
  const block = full.slice(start, next > start ? next : full.length);
  await dest.unsafe(block);
  console.log("vista subsidios_arriendos.consolidado aplicada");

  await dest.unsafe(`
DROP VIEW IF EXISTS medallion.v_subsidios_arriendos_all CASCADE;
CREATE VIEW medallion.v_subsidios_arriendos_all AS SELECT * FROM subsidios_arriendos.consolidado;
DROP VIEW IF EXISTS medallion.v_subsidios_arriendos_consolidado CASCADE;
CREATE VIEW medallion.v_subsidios_arriendos_consolidado AS SELECT * FROM subsidios_arriendos.consolidado;
`);

  await dest.unsafe(`
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'medallion_reader') THEN
        EXECUTE 'GRANT USAGE ON SCHEMA subsidios_arriendos TO medallion_reader';
        EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA subsidios_arriendos TO medallion_reader';
        EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA subsidios_arriendos GRANT SELECT ON TABLES TO medallion_reader';
      END IF;
    END $$;
  `);

  await mergeCatalog(dest);

  const n = await dest`SELECT count(*)::int AS n FROM subsidios_arriendos.consolidado`;
  const live = await dest`
    SELECT count(*)::int AS n FROM records
    WHERE theme_id = 'subsidios-de-arriendos' AND deleted_at IS NULL
      AND source IN ('excel', 'form', 'manual')
  `;
  console.log("dest records vivos", live[0].n, "vista consolidado", n[0].n);

  await local.end();
  await dest.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
