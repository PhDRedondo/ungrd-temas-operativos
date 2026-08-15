/**
 * Prueba la URL de solo lectura medallón + JOINs intra-schema.
 * Lee MEDALLION_DATABASE_URL de .env.local (nunca la pegues en el chat).
 *
 *   npx tsx scripts/test-medallion-reader.ts
 *
 * Nota: el host directo db.*.supabase.co a veces es solo IPv6.
 * Si falla ENOTFOUND/EHOSTUNREACH, usa la URI de Pooler (Session) del
 * dashboard de Supabase y deja el user como medallion_reader.<project-ref>
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

function mask(url: string): string {
  try {
    const u = new URL(url.replace(/^postgresql:/, "http:"));
    return `postgresql://${u.username}:***@${u.hostname}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return "(url inválida)";
  }
}

async function main() {
  const url = process.env.MEDALLION_DATABASE_URL || "";
  if (!url) {
    console.error(
      "Falta MEDALLION_DATABASE_URL en .env.local\n" +
        "Agrega la URI de Pooler Session del dashboard, por ejemplo:\n" +
        "MEDALLION_DATABASE_URL=postgresql://medallion_reader.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require",
    );
    process.exit(1);
  }

  console.log("Conectando:", mask(url));
  const sql = postgres(url, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 20,
    ssl: "require",
  });

  try {
    const who = await sql`SELECT current_user AS user, current_database() AS db`;
    console.log("OK sesión:", who[0]);

    const aguaViews = await sql`
      SELECT table_name FROM information_schema.views
      WHERE table_schema = 'agua' ORDER BY table_name
    `;
    const aguaNames = new Set(aguaViews.map((r) => String(r.table_name)));
    const expectedAgua = [
      "general",
      "bitacora",
      "pagos",
      "modificaciones",
      "cdps_y_rc",
      "bitacora_estructuracion",
      "control_y_seguimiento_detalle_m",
      "variables_lider",
    ];
    const legacyAgua = ["maqueta", "control", "cdps_rc"].filter((n) =>
      aguaNames.has(n),
    );
    console.log("agua.* vistas:", [...aguaNames].join(", ") || "(ninguna)");
    if (legacyAgua.length) {
      console.error(
        "LEGACY agua todavía presente (aplicar 003 en prod):",
        legacyAgua.join(", "),
      );
    }
    let aguaOk = true;
    for (const need of expectedAgua) {
      if (!aguaNames.has(need)) {
        console.error(`FALTA tabla agua.${need}`);
        aguaOk = false;
      }
    }
    if (legacyAgua.length) aguaOk = false;

    const counts = await sql`
      SELECT 'puentes.bitacora' AS src, count(*)::int AS n FROM puentes.bitacora
      UNION ALL SELECT 'puentes.base_general_puentes', count(*)::int FROM puentes.base_general_puentes
      UNION ALL SELECT 'puentes.contratos_estructuracion', count(*)::int FROM puentes.contratos_estructuracion
      UNION ALL SELECT 'agua.bitacora', count(*)::int FROM agua.bitacora
      UNION ALL SELECT 'medallion.v_bronze_records', count(*)::int FROM medallion.v_bronze_records
    `;
    console.log("Conteos:");
    for (const r of counts) console.log(`  ${r.src}: ${r.n}`);
    if (aguaNames.has("general")) {
      const g = await sql`SELECT count(*)::int AS n FROM agua.general`;
      console.log(`  agua.general: ${g[0].n}`);
      const cols = await sql`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'agua' AND table_name = 'general'
        ORDER BY ordinal_position LIMIT 12
      `;
      console.log(
        "  agua.general primeras cols:",
        cols.map((c) => c.column_name).join(", "),
      );
    }

    // Columnas críticas bitácora puentes (convenio no puede faltar)
    const cols = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'puentes' AND table_name = 'bitacora'
        AND column_name IN ('convenio_o_cto', 'contrato_convenio', 'clave_proceso', 'id_puente', 'codigo_operativo')
      ORDER BY column_name
    `;
    const colSet = new Set(cols.map((c) => String(c.column_name)));
    for (const need of [
      "convenio_o_cto",
      "contrato_convenio",
      "clave_proceso",
      "id_puente",
    ]) {
      if (!colSet.has(need)) {
        console.error(`FALTA columna puentes.bitacora.${need}`);
        process.exit(3);
      }
    }
    console.log("OK columnas join en puentes.bitacora:", [...colSet].join(", "));

    // JOIN map
    const hasJoinMap = await sql`SELECT to_regclass('medallion.v_join_map') AS r`;
    if (!hasJoinMap[0]?.r) {
      console.error("FALTA medallion.v_join_map (aplicar 003 en prod)");
      aguaOk = false;
    } else {
      const joins = await sql`
        SELECT schema_name, left_table, right_table, join_key, priority
        FROM medallion.v_join_map
        ORDER BY schema_name, left_table, priority
      `;
      console.log(`OK v_join_map: ${joins.length} filas`);
      for (const j of joins) {
        console.log(
          `  ${j.schema_name}: ${j.left_table} ↔ ${j.right_table} ON ${j.join_key} (${j.priority})`,
        );
      }
    }

    // JOINs reales Puentes
    const p1 = await sql`
      SELECT count(*)::int AS n
      FROM puentes.bitacora b
      JOIN puentes.base_general_puentes i ON i.id_puente = b.id_puente
    `;
    const p2 = await sql`
      SELECT count(*)::int AS n
      FROM puentes.bitacora b
      JOIN puentes.contratos_estructuracion e
        ON e.convenio_o_cto = b.convenio_o_cto
      WHERE nullif(trim(b.convenio_o_cto), '') IS NOT NULL
    `;
    const p3 = await sql`
      SELECT count(*)::int AS n
      FROM puentes.base_general_puentes i
      JOIN puentes.contratos_estructuracion e
        ON e.clave_proceso = i.clave_proceso
      WHERE nullif(trim(i.clave_proceso), '') IS NOT NULL
    `;
    console.log("JOINs puentes:");
    console.log(`  bitacora ⋈ inventario (id_puente): ${p1[0].n}`);
    console.log(`  bitacora ⋈ contratos (convenio_o_cto): ${p2[0].n}`);
    console.log(`  inventario ⋈ contratos (clave_proceso): ${p3[0].n}`);

    // JOINs Agua (requiere agua.general canónico)
    if (aguaNames.has("general")) {
      const a1 = await sql`
        SELECT count(*)::int AS n
        FROM agua.bitacora b
        JOIN agua.general g ON g.orden_de_proveeduria = b.orden_de_proveeduria
      `;
      const a2 = await sql`
        SELECT count(*)::int AS n
        FROM agua.pagos p
        JOIN agua.general g ON g.orden_de_proveeduria = p.orden_de_proveeduria
      `;
      console.log("JOINs agua:");
      console.log(`  bitacora ⋈ general (OP): ${a1[0].n}`);
      console.log(`  pagos ⋈ general (OP): ${a2[0].n}`);
    } else {
      console.error("SKIP JOINs agua: falta agua.general (prod aún con maqueta legacy)");
    }

    try {
      await sql`INSERT INTO public.records (id) VALUES (gen_random_uuid())`;
      console.error("FALLO DE SEGURIDAD: pudo INSERT en records");
      process.exit(2);
    } catch {
      console.log("OK: INSERT en public.records bloqueado");
    }

    if (!aguaOk) {
      console.error(
        "Agua medallón incompleto en este host. Aplicar sql/medallion/003_theme_capa_views.sql con rol admin (postgres).",
      );
      process.exit(4);
    }
    console.log("✓ Lectura medallón + JOINs OK");
  } finally {
    await sql.end({ timeout: 2 });
  }
}

main().catch((e) => {
  const msg = e instanceof Error ? e.message : String(e);
  console.error("Error de conexión:", msg);
  if (/ENOTFOUND|EHOSTUNREACH|IPv6/i.test(msg)) {
    console.error(`
Pista: el host db.*.supabase.co suele ser solo IPv6 y esta red no lo alcanza.
En Supabase → Project Settings → Database → Connect:
  1) Elige "Connection pooling" → Mode: Session
  2) Copia la URI
  3) Cambia el usuario a: medallion_reader.<project-ref>
  4) Pon esa URI en MEDALLION_DATABASE_URL y vuelve a probar
`);
  }
  process.exit(1);
});
