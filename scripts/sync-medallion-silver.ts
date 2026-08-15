/**
 * Sync Bronze views → Silver physical tables (truncate + reload, transactional).
 *
 *   npx tsx scripts/sync-medallion-silver.ts
 *   npx tsx scripts/sync-medallion-silver.ts --apply-ddl   # 010 + 011 + sync
 *   npx tsx scripts/sync-medallion-silver.ts --ddl-only    # solo 010 + 011
 *   npx tsx scripts/sync-medallion-silver.ts --agua-only
 *   npx tsx scripts/sync-medallion-silver.ts --puentes-only
 *
 * Escritura: DATABASE_URL prod o admin derivado de MEDALLION_DATABASE_URL.
 * Verificación lectura: MEDALLION_DATABASE_URL (opcional al final).
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import postgres from "postgres";
import {
  loadMedallionEnv,
  maskDbUrl,
  resolveAdminDatabaseUrl,
} from "./lib/medallion-db-url";

type ManifestSheet = {
  bronzeSchema: string;
  bronzeTable: string;
  silverSchema: string;
  silverTable: string;
  columns: string[];
};

type Manifest = {
  agua: ManifestSheet[];
  puentes: ManifestSheet[];
};

function hasFlag(f: string): boolean {
  return process.argv.includes(f);
}

function scrub(s: string): string {
  return (s || "").replace(/postgresql:\/\/[^@\s]+@/gi, "postgresql://***@");
}

function applySqlFile(adminUrl: string, file: string): void {
  console.log(`Applying ${file} …`);
  const r = spawnSync("psql", [adminUrl, "-v", "ON_ERROR_STOP=1", "-f", file], {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  if (r.stdout) process.stdout.write(scrub(r.stdout).slice(-3000));
  if (r.stderr) process.stderr.write(scrub(r.stderr).slice(-4000));
  if (r.status !== 0) {
    throw new Error(`psql falló en ${file} (exit ${r.status})`);
  }
  console.log(`OK ${file}`);
}

function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    return `"${name.replace(/"/g, '""')}"`;
  }
  return name;
}

function colList(cols: string[]): string {
  return cols.map(quoteIdent).join(", ");
}

async function syncAgua(sql: ReturnType<typeof postgres>, sheets: ManifestSheet[]) {
  console.log("\n── Sync silver_agua ──");
  await sql.begin(async (tx) => {
    await tx`SET CONSTRAINTS ALL DEFERRED`;

    // Truncate dim CASCADE clears all silver_agua fact tables that FK to orden
    await tx`TRUNCATE TABLE silver_agua.orden CASCADE`;

    // Dim OP = unión de todas las hojas (incluye huérfanas)
    const unionParts = sheets
      .map(
        (s) =>
          `SELECT DISTINCT orden_de_proveeduria, '${s.bronzeTable}' AS src
           FROM ${s.bronzeSchema}.${s.bronzeTable}
           WHERE orden_de_proveeduria IS NOT NULL`,
      )
      .join("\nUNION ALL\n");

    await tx.unsafe(`
      INSERT INTO silver_agua.orden (orden_de_proveeduria, first_seen_at, last_seen_at, source_tables, synced_at)
      SELECT
        orden_de_proveeduria,
        now(),
        now(),
        array_agg(DISTINCT src ORDER BY src),
        now()
      FROM (
        ${unionParts}
      ) u
      GROUP BY orden_de_proveeduria
    `);
    const dimN = await tx`SELECT count(*)::int AS n FROM silver_agua.orden`;
    console.log(`  orden (dim): ${dimN[0].n}`);

    // Hub general primero, luego satélites
    const ordered = [
      ...sheets.filter((s) => s.silverTable === "general"),
      ...sheets.filter((s) => s.silverTable !== "general"),
    ];

    for (const s of ordered) {
      const cols = s.columns;
      const insertCols = [...cols, "synced_at"];
      const selectCols = [...cols.map(quoteIdent), "now()"];
      const fromSql =
        s.silverTable === "general"
          ? `FROM (
               SELECT DISTINCT ON (orden_de_proveeduria) *
               FROM ${s.bronzeSchema}.${s.bronzeTable}
               WHERE orden_de_proveeduria IS NOT NULL
               ORDER BY orden_de_proveeduria, updated_at DESC NULLS LAST, record_id DESC
             ) src`
          : `FROM ${s.bronzeSchema}.${s.bronzeTable}`;
      await tx.unsafe(`
        INSERT INTO ${s.silverSchema}.${s.silverTable} (${colList(insertCols)})
        SELECT ${selectCols.join(", ")}
        ${fromSql}
      `);
      const n = await tx.unsafe(
        `SELECT count(*)::int AS n FROM ${s.silverSchema}.${s.silverTable}`,
      );
      console.log(`  ${s.silverSchema}.${s.silverTable}: ${n[0].n}`);
    }
  });
}

async function syncPuentes(
  sql: ReturnType<typeof postgres>,
  sheets: ManifestSheet[],
) {
  console.log("\n── Sync silver_puentes ──");
  const by = Object.fromEntries(sheets.map((s) => [s.silverTable, s]));
  const contratos = by.contratos_estructuracion;
  const inventario = by.base_general_puentes;
  const bitacora = by.bitacora;
  if (!contratos || !inventario || !bitacora) {
    throw new Error("Manifest puentes incompleto");
  }

  await sql.begin(async (tx) => {
    await tx`SET CONSTRAINTS ALL DEFERRED`;
    await tx`TRUNCATE TABLE
      silver_puentes.bitacora,
      silver_puentes.base_general_puentes,
      silver_puentes.contratos_estructuracion`;

    for (const s of [contratos, inventario, bitacora]) {
      const cols = s.columns;
      const insertCols = [...cols, "synced_at"];
      const selectCols = [...cols.map(quoteIdent), "now()"];
      await tx.unsafe(`
        INSERT INTO ${s.silverSchema}.${s.silverTable} (${colList(insertCols)})
        SELECT ${selectCols.join(", ")}
        FROM ${s.bronzeSchema}.${s.bronzeTable}
      `);
      const n = await tx.unsafe(
        `SELECT count(*)::int AS n FROM ${s.silverSchema}.${s.silverTable}`,
      );
      console.log(`  ${s.silverSchema}.${s.silverTable}: ${n[0].n}`);
    }
  });
}

async function compareCounts(
  sql: ReturnType<typeof postgres>,
  opts: { agua: boolean; puentes: boolean },
) {
  console.log("\n── Conteos Bronze vs Silver ──");
  const pairs: [string, string, string][] = [];
  if (opts.agua) {
    pairs.push(
      ["agua.general", "agua.general", "silver_agua.general"],
      ["agua.bitacora", "agua.bitacora", "silver_agua.bitacora"],
      ["agua.pagos", "agua.pagos", "silver_agua.pagos"],
      ["agua.modificaciones", "agua.modificaciones", "silver_agua.modificaciones"],
      [
        "agua.control_y_seguimiento_detalle_m",
        "agua.control_y_seguimiento_detalle_m",
        "silver_agua.control_y_seguimiento_detalle_m",
      ],
      ["agua.cdps_y_rc", "agua.cdps_y_rc", "silver_agua.cdps_y_rc"],
      [
        "agua.variables_lider",
        "agua.variables_lider",
        "silver_agua.variables_lider",
      ],
      [
        "agua.bitacora_estructuracion",
        "agua.bitacora_estructuracion",
        "silver_agua.bitacora_estructuracion",
      ],
    );
  }
  if (opts.puentes) {
    pairs.push(
      [
        "puentes.base_general_puentes",
        "puentes.base_general_puentes",
        "silver_puentes.base_general_puentes",
      ],
      ["puentes.bitacora", "puentes.bitacora", "silver_puentes.bitacora"],
      [
        "puentes.contratos_estructuracion",
        "puentes.contratos_estructuracion",
        "silver_puentes.contratos_estructuracion",
      ],
    );
  }
  let ok = true;
  for (const [label, bronze, silver] of pairs) {
    const [row] = await sql.unsafe(
      bronze === "agua.general"
        ? `SELECT (SELECT count(DISTINCT orden_de_proveeduria)::int FROM ${bronze} WHERE orden_de_proveeduria IS NOT NULL) AS bronze_n,
                  (SELECT count(*)::int FROM ${silver}) AS silver_n`
        : `SELECT (SELECT count(*)::int FROM ${bronze}) AS bronze_n,
                  (SELECT count(*)::int FROM ${silver}) AS silver_n`,
    );
    const match = Number(row.bronze_n) === Number(row.silver_n);
    if (!match) ok = false;
    const note =
      bronze === "agua.general"
        ? " (hub 1 OP; tablero puede tener 2 altas por orden)"
        : "";
    console.log(
      `  ${label}: bronze=${row.bronze_n} silver=${row.silver_n} ${match ? "✓" : "✗"}${note}`,
    );
  }
  if (opts.agua) {
    const dim = await sql`
      SELECT
        (SELECT count(*)::int FROM silver_agua.orden) AS orden_n,
        (SELECT count(*)::int FROM silver_agua.general) AS general_n
    `;
    console.log(
      `  silver_agua.orden (dim): ${dim[0].orden_n} (general=${dim[0].general_n}; dim ≥ general por OPs huérfanas)`,
    );
  }
  return ok;
}

async function main() {
  loadMedallionEnv();
  const { adminUrl, source } = resolveAdminDatabaseUrl();
  console.log("Admin DB:", maskDbUrl(adminUrl), `(via ${source})`);

  const manifestPath = path.join(
    process.cwd(),
    "scripts/generated/silver-sync-manifest.json",
  );
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      "Falta scripts/generated/silver-sync-manifest.json — corre npm run medallion:generate-silver",
    );
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Manifest;

  const ddlOnly = hasFlag("--ddl-only");
  const applyDdl = ddlOnly || hasFlag("--apply-ddl");
  if (applyDdl) {
    applySqlFile(adminUrl, "sql/medallion/010_silver_tables.sql");
    applySqlFile(adminUrl, "sql/medallion/011_silver_grants.sql");
  }
  if (ddlOnly) {
    console.log("✓ DDL Silver aplicado (--ddl-only)");
    return;
  }

  const sql = postgres(adminUrl, {
    max: 1,
    ssl: "require",
    connect_timeout: 25,
    idle_timeout: 5,
  });

  try {
    const who = await sql`SELECT current_user AS user, current_database() AS db`;
    console.log("Sesión admin:", who[0]);

    const doAgua = !hasFlag("--puentes-only");
    const doPuentes = !hasFlag("--agua-only");

    if (applyDdl && !(doAgua && doPuentes)) {
      console.warn(
        "⚠ --apply-ddl recrea 010 completo (agua+puentes). Tras sync parcial, corre el otro tema o sync completo.",
      );
    }

    if (doAgua) await syncAgua(sql, manifest.agua);
    if (doPuentes) await syncPuentes(sql, manifest.puentes);

    const countsOk = await compareCounts(sql, {
      agua: doAgua,
      puentes: doPuentes,
    });
    if (!countsOk) {
      throw new Error("Conteos Bronze ≠ Silver");
    }
    console.log("\n✓ Sync Silver OK");
  } finally {
    await sql.end({ timeout: 2 });
  }
}

main().catch((e) => {
  console.error(scrub(String(e instanceof Error ? e.stack || e.message : e)));
  process.exit(1);
});
