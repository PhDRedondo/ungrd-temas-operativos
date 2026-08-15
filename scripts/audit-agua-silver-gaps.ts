/**
 * Audita huecos Agua: columnas Silver vacías con datos en payload bajo otro nombre,
 * y labels Excel que no mapean (p. ej. observaciones="obs").
 *
 *   npx tsx scripts/audit-agua-silver-gaps.ts
 */
import postgres from "postgres";
import { loadMedallionEnv } from "./lib/medallion-db-url";
import { config as theme } from "../src/themes/agua-y-saneamiento/theme";

loadMedallionEnv();

const url = process.env.MEDALLION_DATABASE_URL || process.env.DATABASE_URL;
if (!url) throw new Error("Falta MEDALLION_DATABASE_URL");

function norm(s: string) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

async function main() {
  const sql = postgres(url, { ssl: "require", max: 1, prepare: false });

  // 1) Labels que no coinciden con el name (riesgo Excel)
  console.log("=== Labels vs name (sospechosos) ===");
  for (const f of theme.fields) {
    const ln = norm(f.label);
    const nn = norm(f.name);
    if (ln !== nn && ln.length <= 4) {
      console.log(`  ${f.name} label=${JSON.stringify(f.label)} norm=${ln}`);
    }
  }

  // 2) Por cada form: fill rate en bronze
  const forms = theme.captureForms || [];
  const sheetMap: Record<string, string> = {
    alta: "general",
    "variables-lider": "variables_lider",
    modificaciones: "modificaciones",
    bitacora: "bitacora",
    pagos: "pagos",
    "cdps-rc": "cdps_y_rc",
    "bitacora-estructuracion": "bitacora_estructuracion",
    control: "control_y_seguimiento_detalle_m",
  };

  for (const form of forms) {
    const table = sheetMap[form.id];
    if (!table) continue;
    const cols = (form.fieldNames || []).filter(
      (n) => !["orden_de_proveeduria"].includes(n) || true,
    );
    console.log(`\n=== agua.${table} / ${form.id} ===`);
    const colList = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'agua' AND table_name = ${table}
      ORDER BY ordinal_position`;
    const have = new Set(colList.map((c) => c.column_name as string));
    const missingFromView = cols.filter((c) => !have.has(c));
    if (missingFromView.length) {
      console.log("  MISSING IN BRONZE VIEW:", missingFromView.join(", "));
    }

    // fill rates for form fields present in view
    const present = cols.filter((c) => have.has(c));
    if (!present.length) continue;
    const selects = present
      .map(
        (c) =>
          `count(*) FILTER (WHERE nullif(trim(${c}::text),'') IS NOT NULL)::int AS ${c}`,
      )
      .join(",\n  ");
    const q = `SELECT count(*)::int AS n, ${selects} FROM agua.${table}`;
    const [row] = await sql.unsafe(q);
    const n = Number(row.n);
    const empty: string[] = [];
    const partial: string[] = [];
    for (const c of present) {
      const v = Number(row[c] ?? 0);
      if (v === 0) empty.push(c);
      else if (v < n * 0.05) partial.push(`${c}(${v}/${n})`);
    }
    if (empty.length) console.log("  EMPTY (0 nonempty):", empty.join(", "));
    if (partial.length) console.log("  SPARSE (<5%):", partial.join(", "));
    console.log(
      "  ok_fill:",
      present.filter((c) => !empty.includes(c) && !partial.some((p) => p.startsWith(c + "("))).length,
      "/",
      present.length,
      "n=",
      n,
    );
  }

  // 3) Bitácora: ¿estado vacío pero estado_macro lleno?
  const [bit] = await sql`
    SELECT
      count(*)::int AS n,
      count(*) FILTER (WHERE nullif(trim(estado),'') IS NOT NULL)::int AS estado,
      count(*) FILTER (WHERE nullif(trim(estado_macro),'') IS NOT NULL)::int AS estado_macro,
      count(*) FILTER (WHERE nullif(trim(comentario),'') IS NOT NULL)::int AS comentario,
      count(*) FILTER (WHERE nullif(trim(fecha_estado),'') IS NOT NULL)::int AS fecha_estado
    FROM agua.bitacora`;
  console.log("\n=== bitacora summary ===", bit);

  // 4) general: estado / fechas (sin observaciones: no está en hoja General)
  const [gen] = await sql`
    SELECT
      count(*)::int AS n,
      count(*) FILTER (WHERE nullif(trim(estado),'') IS NOT NULL)::int AS estado,
      count(*) FILTER (WHERE nullif(trim(estado_de_ejecucion),'') IS NOT NULL)::int AS estado_de_ejecucion,
      count(*) FILTER (WHERE nullif(trim(estado_actual),'') IS NOT NULL)::int AS estado_actual,
      count(*) FILTER (WHERE nullif(trim(fecha_inicio_orden),'') IS NOT NULL)::int AS fecha_inicio_orden,
      count(*) FILTER (WHERE nullif(trim(fecha_fin_orden),'') IS NOT NULL)::int AS fecha_fin_orden
    FROM agua.general`;
  console.log("=== general summary ===", gen);

  const counts = await sql`
    SELECT relname AS t, n_live_tup::int AS n
    FROM pg_stat_user_tables
    WHERE schemaname = 'silver_agua'
    ORDER BY 1`;
  console.log("=== silver_agua counts ===");
  for (const r of counts) console.log(`  ${r.t}: ${r.n}`);

  await sql.end({ timeout: 1 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
