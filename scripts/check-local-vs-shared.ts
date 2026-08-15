/**
 * Chequeo solo-lectura: local vs Supabase (records + tablas compartidas).
 * No escribe ni borra nada.
 *
 *   npx tsx scripts/check-local-vs-shared.ts
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });
import postgres from "postgres";
import {
  loadMedallionEnv,
  maskDbUrl,
  resolveAdminDatabaseUrl,
} from "./lib/medallion-db-url";

loadMedallionEnv();

const THEMES = [
  "puentes",
  "agua-y-saneamiento",
  "carrotanques",
  "banco-de-maquinaria",
  "subsidios-de-arriendos",
] as const;

const OFFICIAL: Record<string, string[]> = {
  "agua-y-saneamiento": [
    "Alta / orden",
    "Modificación contractual",
    "Bitácora estado",
    "Pago / desembolso",
    "Control ejecución física",
  ],
  "banco-de-maquinaria": [
    "Convenio o proceso",
    "Maqueta / inventario",
    "Bitácora convenio",
    "Entrega a beneficiario",
  ],
  carrotanques: ["Maqueta / inventario", "Bitácora estado", "Suministro / viajes"],
  puentes: ["Contrato estructuración", "Inventario puente", "Bitácora estado"],
  "subsidios-de-arriendos": ["Consolidado / envío"],
};

const REAL = `lower(trim(coalesce(source,''))) NOT IN ('seed','demo','harness','smoke','test')`;
const CAPA = `coalesce(payload->>'tipo_registro', payload->>'capa', '')`;
const FAIL: string[] = [];
const WARN: string[] = [];

function fail(msg: string) {
  FAIL.push(msg);
  console.log("FAIL", msg);
}
function warn(msg: string) {
  WARN.push(msg);
  console.log("WARN", msg);
}
function ok(msg: string) {
  console.log("OK  ", msg);
}

async function tableExists(
  sql: postgres.Sql,
  schema: string,
  name: string,
): Promise<boolean> {
  const r = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = ${schema} AND table_name = ${name}
    LIMIT 1
  `;
  return r.length > 0;
}

async function main() {
  const localUrl = process.env.DATABASE_URL || "";
  if (!/127\.0\.0\.1|localhost/i.test(localUrl)) {
    throw new Error("DATABASE_URL no es local; aborto para no mezclar orígenes");
  }
  const { adminUrl } = resolveAdminDatabaseUrl();
  const readerUrl = process.env.MEDALLION_DATABASE_URL || "";
  console.log("local ", maskDbUrl(localUrl));
  console.log("admin ", maskDbUrl(adminUrl));
  if (readerUrl) console.log("reader", maskDbUrl(readerUrl));

  const local = postgres(localUrl, { max: 1, ssl: false });
  const dest = postgres(adminUrl, { max: 1, ssl: "require", prepare: false });
  const reader = readerUrl
    ? postgres(readerUrl, { max: 1, ssl: "require", prepare: false })
    : null;

  try {
    const themesL = await local`
      SELECT id, schema_version FROM themes WHERE id IN ${local(THEMES as unknown as string[])} ORDER BY 1
    `;
    const themesD = await dest`
      SELECT id, schema_version FROM themes WHERE id IN ${dest(THEMES as unknown as string[])} ORDER BY 1
    `;
    for (const t of themesL) {
      const d = themesD.find((x) => x.id === t.id);
      if (!d) fail(`falta theme ${t.id} en dest`);
      else if (Number(d.schema_version) !== Number(t.schema_version)) {
        fail(`schema_version ${t.id} local=${t.schema_version} dest=${d.schema_version}`);
      } else ok(`theme ${t.id} v${t.schema_version}`);
    }

    for (const themeId of THEMES) {
      const capas = OFFICIAL[themeId];
      const inList = capas.map((c) => `'${c.replace(/'/g, "''")}'`).join(",");
      const q = `
        SELECT ${CAPA} AS capa, content_hash, id::text AS id, source, estado,
               md5(coalesce((payload - 'registrada_ante_el_runt')::text,'')) AS payload_md5,
               (payload ? 'registrada_ante_el_runt') AS has_runt
        FROM records
        WHERE theme_id = '${themeId}' AND deleted_at IS NULL AND ${REAL}
          AND ${CAPA} = ANY(ARRAY[${inList}])
      `;
      const L = await local.unsafe(q);
      const D = await dest.unsafe(q);
      const byCapaL: Record<string, number> = {};
      const byCapaD: Record<string, number> = {};
      for (const r of L) byCapaL[r.capa] = (byCapaL[r.capa] || 0) + 1;
      for (const r of D) byCapaD[r.capa] = (byCapaD[r.capa] || 0) + 1;

      console.log(`\n=== ${themeId} records oficiales ===`);
      for (const c of capas) {
        const a = byCapaL[c] || 0;
        const b = byCapaD[c] || 0;
        if (a === b) ok(`${c}: ${a}`);
        else fail(`${themeId} / ${c}: local=${a} dest=${b}`);
      }

      const extraDest = await dest.unsafe(`
        SELECT ${CAPA} AS capa, count(*)::int AS n
        FROM records
        WHERE theme_id = '${themeId}' AND deleted_at IS NULL
          AND (${CAPA} = '' OR NOT (${CAPA} = ANY(ARRAY[${inList}])))
        GROUP BY 1
      `);
      for (const r of extraDest) {
        if (Number(r.n) > 0) fail(`${themeId} dest capa extra viva '${r.capa}': ${r.n}`);
      }

      const hL = new Set(L.map((r) => r.content_hash));
      const hD = new Set(D.map((r) => r.content_hash));
      const miss = [...hL].filter((h) => !hD.has(h));
      const extra = [...hD].filter((h) => !hL.has(h));
      if (miss.length) fail(`${themeId}: ${miss.length} hashes locales ausentes en dest`);
      else ok(`${themeId}: ${hL.size} hashes locales presentes en dest`);
      if (extra.length) fail(`${themeId}: ${extra.length} hashes dest que no están en local`);
      else ok(`${themeId}: dest no tiene hashes oficiales de más`);

      const md5D = new Map(D.map((r) => [r.content_hash, r.payload_md5]));
      let payloadDiff = 0;
      for (const r of L) {
        const d = md5D.get(r.content_hash);
        if (d && d !== r.payload_md5) payloadDiff += 1;
      }
      if (payloadDiff) fail(`${themeId}: ${payloadDiff} payloads distintos con el mismo hash`);
      else ok(`${themeId}: payloads idénticos para hashes comunes`);

      const runtL = L.filter((r) => r.has_runt).length;
      const runtD = D.filter((r) => r.has_runt).length;
      if (themeId === "banco-de-maquinaria") {
        if (runtD) fail(`banco dest todavía tiene registrada_ante_el_runt en ${runtD} filas`);
        else ok("banco dest sin columna RUNT");
        if (runtL) warn(`banco local aún tiene RUNT en ${runtL} filas (no se comparte)`);
      }
    }

    const seedDest = await dest`
      SELECT theme_id, count(*)::int AS n FROM records
      WHERE deleted_at IS NULL AND ${dest.unsafe(REAL.replace("NOT IN", "IN"))}
        AND theme_id IN ${dest(THEMES as unknown as string[])}
      GROUP BY 1
    `;
    if (seedDest.length) fail(`dest tiene seed/demo vivo: ${JSON.stringify(seedDest)}`);
    else ok("dest 4 temas: 0 seed/demo/harness vivos");

    const shared: [string, string][] = [
      ["agua", "general"],
      ["agua", "bitacora"],
      ["agua", "pagos"],
      ["agua", "modificaciones"],
      ["agua", "control_y_seguimiento_detalle_m"],
      ["agua", "cdps_y_rc"],
      ["agua", "variables_lider"],
      ["agua", "bitacora_estructuracion"],
      ["puentes", "contratos_estructuracion"],
      ["puentes", "base_general_puentes"],
      ["puentes", "bitacora"],
      ["carrotanques", "base"],
      ["banco_maquinaria", "base"],
      ["subsidios_arriendos", "consolidado"],
    ];
    // Vistas derivadas: proyectan campos de Alta; si el SQL local está viejo
    // el conteo de la vista local puede ser 0. Se compara el filtro sobre records.
    const derived = new Set([
      "agua.cdps_y_rc",
      "agua.variables_lider",
      "agua.bitacora_estructuracion",
    ]);

    console.log("\n=== tablas compartidas (vista dest vs records locales equivalentes) ===");
    const localHasAgua = await tableExists(local, "agua", "general");

    for (const [schema, name] of shared) {
      const destHas = await tableExists(dest, schema, name);
      if (!destHas) {
        fail(`falta ${schema}.${name} en dest`);
        continue;
      }
      const destN = (
        await dest.unsafe(`SELECT count(*)::int AS n FROM ${schema}.${name}`)
      )[0].n as number;

      let localN: number | null = null;
      if (localHasAgua && (await tableExists(local, schema, name))) {
        localN = (
          await local.unsafe(`SELECT count(*)::int AS n FROM ${schema}.${name}`)
        )[0].n as number;
      }

      const label = `${schema}.${name}`;
      if (derived.has(label)) {
        const hashes = await dest.unsafe(`
          SELECT r.content_hash
          FROM ${schema}.${name} v
          JOIN records r ON r.id = v.record_id
        `);
        const hset = hashes.map((r) => r.content_hash);
        if (hset.length !== destN) {
          fail(`${label}: hashes ${hset.length} ≠ vista ${destN}`);
        } else if (!hset.length) {
          warn(`${label}: vista dest vacía`);
        } else {
          const locHit = await local`
            SELECT count(*)::int AS n FROM records
            WHERE content_hash IN ${local(hset)} AND deleted_at IS NULL
          `;
          if (Number(locHit[0].n) === destN) {
            ok(`${label}: ${destN} filas; mismos content_hash vivos en local`);
          } else {
            fail(`${label}: vista=${destN} hashes locales vivos=${locHit[0].n}`);
          }
        }
        if (localN !== null && localN !== destN) {
          warn(
            `${label}: vista local=${localN} vs dest=${destN} (SQL local viejo; datos records OK)`,
          );
        }
      } else if (localN !== null) {
        if (localN === destN) ok(`${label}: local=${localN} dest=${destN}`);
        else fail(`${label}: local=${localN} dest=${destN}`);
      } else {
        ok(`${label}: dest=${destN} (local no tiene schema bronze)`);
      }

      if (reader) {
        try {
          const rN = (
            await reader.unsafe(`SELECT count(*)::int AS n FROM ${schema}.${name}`)
          )[0].n as number;
          if (rN !== destN) fail(`reader ${schema}.${name}: ${rN} ≠ admin ${destN}`);
          else ok(`reader ${schema}.${name}: ${rN}`);
        } catch (e) {
          fail(`reader no puede leer ${schema}.${name}: ${(e as Error).message.slice(0, 120)}`);
        }
      }
    }

    const silverPairs: [string, string, string][] = [
      ["agua.bitacora", "silver_agua", "bitacora"],
      ["agua.pagos", "silver_agua", "pagos"],
      ["agua.modificaciones", "silver_agua", "modificaciones"],
      ["agua.control_y_seguimiento_detalle_m", "silver_agua", "control_y_seguimiento_detalle_m"],
      ["agua.cdps_y_rc", "silver_agua", "cdps_y_rc"],
      ["agua.variables_lider", "silver_agua", "variables_lider"],
      ["agua.bitacora_estructuracion", "silver_agua", "bitacora_estructuracion"],
      ["puentes.base_general_puentes", "silver_puentes", "base_general_puentes"],
      ["puentes.bitacora", "silver_puentes", "bitacora"],
      ["puentes.contratos_estructuracion", "silver_puentes", "contratos_estructuracion"],
    ];
    console.log("\n=== Silver vs Bronze (dest) ===");
    for (const [bronze, ss, st] of silverPairs) {
      if (!(await tableExists(dest, ss, st))) {
        fail(`falta ${ss}.${st}`);
        continue;
      }
      const [row] = await dest.unsafe(
        `SELECT (SELECT count(*)::int FROM ${bronze}) AS b, (SELECT count(*)::int FROM ${ss}.${st}) AS s`,
      );
      if (Number(row.b) === Number(row.s)) ok(`${bronze} = ${ss}.${st} (${row.s})`);
      else fail(`${bronze}=${row.b} vs ${ss}.${st}=${row.s}`);
    }

    if (await tableExists(dest, "silver_agua", "general")) {
      const [g] = await dest`
        SELECT
          (SELECT count(DISTINCT orden_de_proveeduria)::int FROM agua.general WHERE orden_de_proveeduria IS NOT NULL) AS ops,
          (SELECT count(*)::int FROM silver_agua.general) AS silver_n,
          (SELECT count(*)::int FROM agua.general) AS bronze_n
      `;
      if (Number(g.ops) === Number(g.silver_n)) {
        ok(`silver_agua.general hub 1:1 OP (${g.silver_n}); bronze filas=${g.bronze_n}`);
      } else {
        fail(`silver_agua.general ${g.silver_n} ≠ OPs distintas bronze ${g.ops}`);
      }
    }

    const localAlta = await local`
      SELECT count(*)::int AS n FROM records
      WHERE theme_id='agua-y-saneamiento' AND deleted_at IS NULL AND ${local.unsafe(REAL)}
        AND ${local.unsafe(CAPA)} = 'Alta / orden'
    `;
    const destAlta = await dest`
      SELECT count(*)::int AS n FROM records
      WHERE theme_id='agua-y-saneamiento' AND deleted_at IS NULL AND ${dest.unsafe(REAL)}
        AND ${dest.unsafe(CAPA)} = 'Alta / orden'
    `;
    const destGeneral = await dest`SELECT count(*)::int AS n FROM agua.general`;
    if (Number(localAlta[0].n) === Number(destAlta[0].n) && Number(destAlta[0].n) === Number(destGeneral[0].n)) {
      ok(`agua.general = altas locales/dest (${destGeneral[0].n})`);
    } else {
      fail(
        `agua.general dest=${destGeneral[0].n} altas local=${localAlta[0].n} dest=${destAlta[0].n}`,
      );
    }

    console.log("\n=== resumen ===");
    console.log(`FAIL ${FAIL.length}  WARN ${WARN.length}`);
    if (FAIL.length) {
      for (const m of FAIL) console.log(" -", m);
      process.exitCode = 1;
    } else {
      console.log("CHECK OK: local visible oficial = dest records = tablas compartidas");
    }
  } finally {
    await local.end();
    await dest.end();
    if (reader) await reader.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
