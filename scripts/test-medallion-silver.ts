/**
 * Verifica Silver + FKs + SELECT con medallion_reader.
 *
 *   npx tsx scripts/test-medallion-silver.ts
 */
import postgres from "postgres";
import { loadMedallionEnv, maskDbUrl } from "./lib/medallion-db-url";

async function main() {
  loadMedallionEnv();
  const url = process.env.MEDALLION_DATABASE_URL || "";
  if (!url) {
    console.error("Falta MEDALLION_DATABASE_URL");
    process.exit(1);
  }

  console.log("Conectando reader:", maskDbUrl(url));
  const sql = postgres(url, {
    max: 1,
    ssl: "require",
    connect_timeout: 20,
    idle_timeout: 5,
  });

  let failed = false;
  try {
    const who = await sql`SELECT current_user AS user, current_database() AS db`;
    console.log("OK sesión:", who[0]);

    const expected = [
      "silver_agua.orden",
      "silver_agua.general",
      "silver_agua.bitacora",
      "silver_agua.pagos",
      "silver_agua.modificaciones",
      "silver_agua.cdps_y_rc",
      "silver_agua.bitacora_estructuracion",
      "silver_agua.control_y_seguimiento_detalle_m",
      "silver_agua.variables_lider",
      "silver_puentes.base_general_puentes",
      "silver_puentes.bitacora",
      "silver_puentes.contratos_estructuracion",
    ];

    for (const fq of expected) {
      const [schema, table] = fq.split(".");
      try {
        const n = await sql.unsafe(
          `SELECT count(*)::int AS n FROM ${schema}.${table}`,
        );
        console.log(`  SELECT ${fq}: ${n[0].n}`);
      } catch (e) {
        failed = true;
        console.error(`  FALLO SELECT ${fq}:`, e instanceof Error ? e.message : e);
      }
    }

    // Bronze still works
    const bronze = await sql`
      SELECT count(*)::int AS n FROM agua.general
      UNION ALL SELECT count(*)::int FROM puentes.bitacora
    `;
    console.log("Bronze intacto: agua.general / puentes.bitacora counts OK", bronze.length === 2);

    // FKs via pg_catalog (information_schema oculta FKs a roles no-owner)
    const fks = await sql`
      SELECT
        n.nspname AS table_schema,
        c.relname AS table_name,
        con.conname AS constraint_name,
        pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con
      JOIN pg_class c ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE con.contype = 'f'
        AND n.nspname IN ('silver_agua', 'silver_puentes')
      ORDER BY 1, 2, 3
    `;
    console.log(`OK FKs Silver: ${fks.length}`);
    for (const f of fks) {
      console.log(`  ${f.table_schema}.${f.table_name}: ${f.constraint_name} — ${f.def}`);
    }
    if (fks.length < 8) {
      failed = true;
      console.error("Se esperaban ≥8 FKs Silver");
    }

    // JOINs reales con FK
    const aJoin = await sql`
      SELECT count(*)::int AS n
      FROM silver_agua.bitacora b
      JOIN silver_agua.general g ON g.orden_de_proveeduria = b.orden_de_proveeduria
    `;
    const aOrphan = await sql`
      SELECT count(*)::int AS n
      FROM silver_agua.pagos p
      LEFT JOIN silver_agua.general g ON g.orden_de_proveeduria = p.orden_de_proveeduria
      WHERE g.record_id IS NULL
    `;
    const pJoin = await sql`
      SELECT count(*)::int AS n
      FROM silver_puentes.bitacora b
      JOIN silver_puentes.base_general_puentes i ON i.id_puente = b.id_puente
    `;
    const pJoin2 = await sql`
      SELECT count(*)::int AS n
      FROM silver_puentes.bitacora b
      JOIN silver_puentes.contratos_estructuracion e ON e.clave_proceso = b.clave_proceso
      WHERE b.clave_proceso IS NOT NULL
    `;
    console.log("JOINs Silver:");
    console.log(`  agua bitacora ⋈ general: ${aJoin[0].n}`);
    console.log(`  agua pagos huérfanas (sin general): ${aOrphan[0].n}`);
    console.log(`  puentes bitacora ⋈ inventario: ${pJoin[0].n}`);
    console.log(`  puentes bitacora ⋈ contratos: ${pJoin2[0].n}`);

    const catalog = await sql`SELECT count(*)::int AS n FROM medallion.v_silver_catalog`;
    const jmap = await sql`SELECT count(*)::int AS n FROM medallion.v_silver_join_map`;
    console.log(`v_silver_catalog: ${catalog[0].n}, v_silver_join_map: ${jmap[0].n}`);

    // Reader cannot write
    try {
      await sql`INSERT INTO silver_agua.orden (orden_de_proveeduria) VALUES ('__test_should_fail__')`;
      failed = true;
      console.error("FALLO SEGURIDAD: reader pudo INSERT en silver_agua.orden");
    } catch {
      console.log("OK: INSERT Silver bloqueado para reader");
    }

    if (failed) process.exit(2);
    console.log("✓ Silver + FKs + reader OK");
  } finally {
    await sql.end({ timeout: 2 });
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
