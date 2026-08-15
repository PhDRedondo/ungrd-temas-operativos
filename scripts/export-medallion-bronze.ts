/**
 * Export bronze para medallón: catálogo + records por tema (JSONL) + columnas DB.
 *
 * Uso:
 *   DATABASE_URL=... npx tsx scripts/export-medallion-bronze.ts
 *   npx tsx scripts/export-medallion-bronze.ts --theme=puentes
 *   npx tsx scripts/export-medallion-bronze.ts --limit=500   # muestra por tema
 *   npx tsx scripts/export-medallion-bronze.ts --include-deleted
 *
 * Salida: exports/medallion/<timestamp>/
 *
 * No imprime secrets. Solo hostname encriptado enmascarado en manifest.
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { THEMES } from "../src/themes";

const OUT_ROOT = path.join(process.cwd(), "exports", "medallion");

function argValue(flag: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function maskDbUrl(raw: string): string {
  try {
    const u = new URL(raw.replace(/^postgresql:/, "http:"));
    return `${u.protocol.replace("http", "postgresql")}//***:***@${u.hostname}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return "(unparseable)";
  }
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function queryRows(query: ReturnType<typeof sql>) {
  const res = await db.execute(query);
  return (Array.isArray(res) ? res : []) as Record<string, unknown>[];
}

async function main() {
  const themeFilter = argValue("--theme");
  const limitRaw = argValue("--limit");
  const limit = limitRaw ? Math.max(1, Number(limitRaw) || 0) : 0;
  const includeDeleted = hasFlag("--include-deleted");

  const outDir = path.join(OUT_ROOT, stamp());
  const recordsDir = path.join(outDir, "records");
  fs.mkdirSync(recordsDir, { recursive: true });

  const dbUrl = process.env.DATABASE_URL || "";
  console.log("DB:", maskDbUrl(dbUrl || "(default local)"));
  console.log("Out:", outDir);

  // ── themes (DB + code fallback) ──
  const themeRows = await queryRows(sql`
    SELECT id, name, short_name, description, unit, value_label,
           schema_version, field_schema, updated_at
    FROM themes
    ORDER BY id
  `);

  const themesPayload = themeRows.length
    ? themeRows
    : THEMES.map((t) => ({
        id: t.id,
        name: t.name,
        short_name: t.shortName,
        description: t.description,
        unit: t.unit,
        value_label: t.valueLabel,
        schema_version: t.schemaVersion ?? 1,
        field_schema: t.fields,
        updated_at: null,
        _source: "code_fallback",
      }));

  fs.writeFileSync(
    path.join(outDir, "themes.json"),
    JSON.stringify(themesPayload, null, 2),
    "utf8",
  );

  // field catalog flattened
  const fieldCatalog: Record<string, unknown>[] = [];
  for (const t of themesPayload) {
    const fields = (t.field_schema as unknown[]) || [];
    fields.forEach((f, i) => {
      const row = f as Record<string, unknown>;
      fieldCatalog.push({
        theme_id: t.id,
        schema_version: t.schema_version,
        ord: i,
        name: row.name,
        label: row.label,
        type: row.type,
        required: Boolean(row.required),
      });
    });
  }
  fs.writeFileSync(
    path.join(outDir, "theme_fields.json"),
    JSON.stringify(fieldCatalog, null, 2),
    "utf8",
  );

  // ── information_schema columns ──
  const columns = await queryRows(sql`
    SELECT table_schema, table_name, column_name, data_type, is_nullable, ordinal_position
    FROM information_schema.columns
    WHERE table_schema IN ('public', 'medallion', 'core', 'workflow', 'iam', 'config', 'staging', 'audit', 'analytics')
    ORDER BY table_schema, table_name, ordinal_position
  `);
  fs.writeFileSync(
    path.join(outDir, "schema_columns.json"),
    JSON.stringify(columns, null, 2),
    "utf8",
  );

  // ── counts + records export ──
  const themeIds = [
    ...new Set(
      [
        ...themesPayload.map((t) => String(t.id)),
        ...THEMES.map((t) => t.id),
      ].filter((id) => (themeFilter ? id === themeFilter : true)),
    ),
  ].sort();

  const counts: Record<string, { active: number; deleted: number; exported: number }> =
    {};

  for (const themeId of themeIds) {
    const activeRows = await queryRows(sql`
      SELECT count(*)::int AS n FROM records
      WHERE theme_id = ${themeId} AND deleted_at IS NULL
    `);
    const deletedRows = await queryRows(sql`
      SELECT count(*)::int AS n FROM records
      WHERE theme_id = ${themeId} AND deleted_at IS NOT NULL
    `);
    const active = Number(activeRows[0]?.n || 0);
    const deleted = Number(deletedRows[0]?.n || 0);

    const limSql = limit > 0 ? sql`LIMIT ${limit}` : sql``;
    const deletedFilter = includeDeleted
      ? sql`TRUE`
      : sql`deleted_at IS NULL`;

    const rows = await queryRows(sql`
      SELECT
        id, theme_id, departamento, municipio, fecha, estado, valor,
        source, content_hash, upload_id, created_by, created_at, updated_at, deleted_at,
        payload
      FROM records
      WHERE theme_id = ${themeId} AND ${deletedFilter}
      ORDER BY updated_at DESC
      ${limSql}
    `);

    const outFile = path.join(recordsDir, `${themeId}.jsonl`);
    const stream = fs.createWriteStream(outFile, { encoding: "utf8" });
    for (const row of rows) {
      const payload = (row.payload || {}) as Record<string, unknown>;
      const flat = {
        ...row,
        capa: payload.capa ?? payload.tipo_registro ?? null,
        clave_seguimiento: payload.clave_seguimiento ?? null,
        id_puente: payload.id_puente ?? null,
        codigo_operativo: payload.codigo_operativo ?? null,
        clave_proceso: payload.clave_proceso ?? null,
        contrato_convenio:
          payload.contrato_convenio ?? payload.contrato ?? null,
        convenio_o_cto: payload.convenio_o_cto ?? null,
        orden_de_proveeduria: payload.orden_de_proveeduria ?? null,
      };
      stream.write(`${JSON.stringify(flat)}\n`);
    }
    stream.end();

    counts[themeId] = { active, deleted, exported: rows.length };
    console.log(
      `  ${themeId}: active=${active} deleted=${deleted} exported=${rows.length}`,
    );
  }

  // capa breakdown (active)
  const capaCounts = await queryRows(sql`
    SELECT
      theme_id,
      nullif(trim(coalesce(payload->>'capa', payload->>'tipo_registro', '')), '') AS capa,
      count(*)::int AS n
    FROM records
    WHERE deleted_at IS NULL
    GROUP BY 1, 2
    ORDER BY 1, 3 DESC
  `);
  fs.writeFileSync(
    path.join(outDir, "counts_by_theme_capa.json"),
    JSON.stringify(capaCounts, null, 2),
    "utf8",
  );

  const manifest = {
    generated_at: new Date().toISOString(),
    database: maskDbUrl(dbUrl || "(default)"),
    options: {
      theme: themeFilter || null,
      limit: limit || null,
      includeDeleted,
    },
    contract: "docs/platform/MEDALLION-DATA-CONTRACT.md",
    views_sql: "sql/medallion/001_bronze_views.sql",
    themes: themeIds.length,
    counts,
    capa_counts: capaCounts,
    files: [
      "manifest.json",
      "themes.json",
      "theme_fields.json",
      "schema_columns.json",
      "counts_by_theme_capa.json",
      ...themeIds.map((id) => `records/${id}.jsonl`),
    ],
    notes: [
      "Bronze: no transformar payload; silver tipa por theme_id + capa.",
      "Al migrar de Supabase a otro Postgres solo cambia DATABASE_URL.",
      "Aplicar vistas: psql \"$DATABASE_URL\" -f sql/medallion/001_bronze_views.sql",
    ],
  };

  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf8",
  );

  // README corto para el zip/carpeta
  fs.writeFileSync(
    path.join(outDir, "README.md"),
    `# Export bronze UNGRD — ${manifest.generated_at}

Ver contrato: \`docs/platform/MEDALLION-DATA-CONTRACT.md\`

- \`themes.json\` — catálogo + field_schema
- \`theme_fields.json\` — campos aplanados (para tipar silver)
- \`records/<theme>.jsonl\` — una línea JSON por registro (payload completo + llaves frecuentes)
- \`schema_columns.json\` — columnas físicas Postgres
- \`counts_by_theme_capa.json\` — conteos para validar

Portabilidad: misma estructura en cualquier Postgres; solo re-apuntar la conexión.
`,
    "utf8",
  );

  console.log("✓ Export listo:", outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
