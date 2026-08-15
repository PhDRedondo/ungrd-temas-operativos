/**
 * Copia a Supabase lo vivo y visible en local (4 temas operativos).
 * Inserta faltantes, actualiza coincidencias y oculta (soft-delete) en destino
 * lo que no está en las capas oficiales de local: stubs, duplicados viejos,
 * capas vacías o datos inventados. No hace DELETE físico.
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
] as const;

const OFFICIAL_CAPA: Record<string, Set<string>> = {
  "agua-y-saneamiento": new Set([
    "Alta / orden",
    "Variables líder",
    "Modificación contractual",
    "Bitácora estado",
    "Bitácora estructuración",
    "Pago / desembolso",
    "CDPS y RC",
    "Control ejecución física",
  ]),
  "banco-de-maquinaria": new Set([
    "Convenio o proceso",
    "Maqueta / inventario",
    "Bitácora convenio",
    "Entrega a beneficiario",
  ]),
  carrotanques: new Set([
    "Maqueta / inventario",
    "Bitácora estado",
    "Suministro / viajes",
  ]),
  puentes: new Set([
    "Contrato estructuración",
    "Inventario puente",
    "Bitácora estado",
  ]),
};

const APPEND_CAPA = new Set([
  "Bitácora estado",
  "Bitácora convenio",
  "Pago / desembolso",
  "Modificación contractual",
  "Control ejecución física",
  "Suministro / viajes",
  "Bitácora estructuración",
  "CDPS y RC",
]);

const STRIP_PAYLOAD: Record<string, string[]> = {
  "banco-de-maquinaria": ["registrada_ante_el_runt"],
};

const REAL_SOURCE = new Set(["excel", "form", "manual"]);

const BATCH = 80;

type Rec = {
  id: string;
  theme_id: string;
  departamento: string;
  municipio: string;
  fecha: string;
  estado: string;
  valor: string;
  payload: Record<string, unknown>;
  source: string;
  content_hash: string;
  created_at: Date;
  updated_at: Date;
};

function capaOf(p: Record<string, unknown>): string {
  return String(p.tipo_registro || p.capa || "").trim();
}

function claveOf(themeId: string, p: Record<string, unknown>): string {
  if (themeId === "banco-de-maquinaria") {
    const capa = capaOf(p);
    if (capa === "Maqueta / inventario" || capa === "Entrega a beneficiario") {
      return String(p.serial || p.clave_seguimiento || "").trim().toLowerCase();
    }
    return String(p.no_convenio || p.clave_seguimiento || "").trim().toLowerCase();
  }
  if (themeId === "carrotanques") {
    return String(p.placa || p.clave_seguimiento || "").trim().toLowerCase();
  }
  if (themeId === "puentes") {
    return String(
      p.id_puente ||
        p.contrato_convenio ||
        p.clave_proceso ||
        p.contrato ||
        p.clave_seguimiento ||
        "",
    )
      .trim()
      .toLowerCase();
  }
  return String(p.orden_de_proveeduria || p.clave_seguimiento || "")
    .trim()
    .toLowerCase();
}

function cleanPayload(
  themeId: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const strip = STRIP_PAYLOAD[themeId];
  if (!strip?.length) return payload;
  const out = { ...payload };
  for (const k of strip) delete out[k];
  return out;
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
    max: 4,
    ssl: "require",
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 30,
  });

  const themes = await local`
    SELECT id, name, short_name, description, unit, value_label, schema_version, field_schema, updated_at
    FROM themes WHERE id IN ${local(THEMES as unknown as string[])}
  `;
  for (const t of themes) {
    await dest`
      INSERT INTO themes (id, name, short_name, description, unit, value_label, schema_version, field_schema, updated_at)
      VALUES (${t.id}, ${t.name}, ${t.short_name}, ${t.description}, ${t.unit}, ${t.value_label}, ${t.schema_version}, ${dest.json(t.field_schema as never)}, ${t.updated_at})
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
  }
  console.log("themes upsert", themes.map((t) => `${t.id}@v${t.schema_version}`).join(", "));

  const stats = {
    scanned: 0,
    inserted: 0,
    updated: 0,
    versionsInserted: 0,
    hidden: 0,
  };

  for (const themeId of THEMES) {
    const official = OFFICIAL_CAPA[themeId]!;
    const rows = (await local`
      SELECT id, theme_id, departamento, municipio, fecha::text AS fecha, estado, valor::text AS valor,
             payload, source, content_hash, created_at, updated_at
      FROM records
      WHERE theme_id = ${themeId} AND deleted_at IS NULL
    `) as Rec[];
    const visible = rows.filter((r) => {
      const capa = capaOf(r.payload || {});
      return (
        official.has(capa) &&
        capa.length > 0 &&
        REAL_SOURCE.has(String(r.source || ""))
      );
    });
    console.log(`\n${themeId}: oficiales ${visible.length}`);
    const keepHashes = [...new Set(visible.map((r) => r.content_hash))];

    const destRows = await dest`
      SELECT id, content_hash, deleted_at,
             coalesce(payload->>'tipo_registro', payload->>'capa','') AS capa,
             lower(trim(coalesce(
               CASE
                 WHEN coalesce(payload->>'tipo_registro', payload->>'capa','') IN ('Maqueta / inventario','Entrega a beneficiario')
                   THEN coalesce(payload->>'serial', payload->>'clave_seguimiento')
                 WHEN coalesce(payload->>'tipo_registro', payload->>'capa','') = 'Convenio o proceso'
                   THEN coalesce(payload->>'no_convenio', payload->>'clave_seguimiento')
                 ELSE coalesce(
                   payload->>'serial', payload->>'no_convenio', payload->>'placa',
                   payload->>'id_puente', payload->>'orden_de_proveeduria', payload->>'clave_seguimiento'
                 )
               END, ''
             ))) AS clave
      FROM records
      WHERE theme_id = ${themeId}
    `;
    const byId = new Map<string, (typeof destRows)[number]>();
    const byHash = new Map<string, (typeof destRows)[number]>();
    const byKey = new Map<string, (typeof destRows)[number]>();
    for (const d of destRows) {
      byId.set(d.id, d);
      byHash.set(d.content_hash, d);
      const k = `${d.capa}::${d.clave}`;
      if (!d.deleted_at && d.clave && !APPEND_CAPA.has(d.capa) && !byKey.has(k)) {
        byKey.set(k, d);
      }
    }

    const toInsert: Rec[] = [];
    const toUpdate: { targetId: string; row: Rec; payload: Record<string, unknown> }[] = [];
    const claimedDest = new Set<string>();

    for (const r of visible) {
      stats.scanned += 1;
      const payload = cleanPayload(themeId, r.payload || {});
      const capa = capaOf(payload);
      const clave = claveOf(themeId, payload);
      let match =
        byId.get(r.id) ||
        byHash.get(r.content_hash) ||
        undefined;
      if (!match && !APPEND_CAPA.has(capa) && clave) {
        const cand = byKey.get(`${capa}::${clave}`);
        if (cand && !claimedDest.has(cand.id)) match = cand;
      }
      if (!match || (claimedDest.has(match.id) && match.id !== r.id)) {
        toInsert.push({ ...r, payload });
      } else {
        claimedDest.add(match.id);
        toUpdate.push({ targetId: match.id, row: { ...r, payload }, payload });
      }
    }

    for (const part of chunk(toUpdate, BATCH)) {
      await dest`
        UPDATE records r SET
          departamento = v.departamento,
          municipio = v.municipio,
          fecha = v.fecha,
          estado = v.estado,
          valor = v.valor,
          payload = v.payload,
          content_hash = v.content_hash,
          updated_at = v.updated_at,
          deleted_at = NULL
        FROM jsonb_to_recordset(${dest.json(
          part.map((u) => ({
            id: u.targetId,
            departamento: u.row.departamento,
            municipio: u.row.municipio,
            fecha: u.row.fecha,
            estado: u.row.estado,
            valor: u.row.valor,
            payload: u.payload,
            content_hash: u.row.content_hash,
            updated_at: u.row.updated_at,
          })) as never,
        )}) AS v(
          id uuid, departamento text, municipio text, fecha date, estado text,
          valor numeric, payload jsonb, content_hash text, updated_at timestamptz
        )
        WHERE r.id = v.id
      `;
      stats.updated += part.length;
      process.stdout.write(`  update ${stats.updated}\r`);
    }
    if (toUpdate.length) console.log(`  actualizados ${toUpdate.length}`);

    for (const part of chunk(toInsert, BATCH)) {
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
      stats.inserted += part.length;
      process.stdout.write(`  insert ${stats.inserted}\r`);
    }
    if (toInsert.length) console.log(`  insertados ${toInsert.length}`);

    if (keepHashes.length) {
      const hidden = await dest`
        UPDATE records
        SET deleted_at = now(), updated_at = now()
        WHERE theme_id = ${themeId}
          AND deleted_at IS NULL
          AND content_hash NOT IN ${dest(keepHashes)}
        RETURNING id
      `;
      stats.hidden += hidden.length;
      console.log(`  ocultos (no están en local visible) ${hidden.length}`);
    }
  }

  const versions = await local`
    SELECT v.id, v.record_id, v.theme_id, v.version, v.departamento, v.municipio,
           v.fecha::text AS fecha, v.estado, v.valor::text AS valor, v.payload,
           v.changed_fields, v.reason, v.created_at
    FROM record_versions v
    JOIN records r ON r.id = v.record_id
    WHERE v.theme_id IN ${local(THEMES as unknown as string[])}
      AND r.deleted_at IS NULL
  `;
  const destIds = new Set(
    (
      await dest`SELECT id FROM records WHERE theme_id IN ${dest(THEMES as unknown as string[])}`
    ).map((x) => x.id),
  );
  const versOk = versions.filter((v) => destIds.has(v.record_id));
  for (const part of chunk(versOk, BATCH)) {
    const ins = await dest`
      INSERT INTO record_versions (
        id, record_id, theme_id, version, departamento, municipio, fecha, estado, valor,
        payload, changed_fields, reason, created_at
      )
      SELECT * FROM jsonb_to_recordset(${dest.json(
        part.map((v) => ({
          id: v.id,
          record_id: v.record_id,
          theme_id: v.theme_id,
          version: v.version,
          departamento: v.departamento,
          municipio: v.municipio,
          fecha: v.fecha,
          estado: v.estado,
          valor: v.valor,
          payload: v.payload,
          changed_fields: v.changed_fields || [],
          reason: v.reason,
          created_at: v.created_at,
        })) as never,
      )}) AS x(
        id uuid, record_id uuid, theme_id text, version int, departamento text, municipio text,
        fecha date, estado text, valor numeric, payload jsonb, changed_fields jsonb,
        reason text, created_at timestamptz
      )
      ON CONFLICT (record_id, version) DO NOTHING
      RETURNING id
    `;
    stats.versionsInserted += ins.length;
  }
  console.log(`versiones nuevas ${stats.versionsInserted}/${versOk.length}`);

  await dest`
    UPDATE records
    SET payload = payload - 'registrada_ante_el_runt'
    WHERE theme_id = 'banco-de-maquinaria'
      AND payload ? 'registrada_ante_el_runt'
  `;
  console.log("banco: columna registrada_ante_el_runt retirada del payload en destino");

  console.log("\n=== resultado ===");
  console.log(stats);

  const after = await dest`
    SELECT theme_id,
           coalesce(payload->>'tipo_registro', payload->>'capa', '(vacío)') AS capa,
           count(*) FILTER (WHERE deleted_at IS NULL)::int AS vivos
    FROM records
    WHERE theme_id IN ${dest(THEMES as unknown as string[])}
    GROUP BY 1,2
    ORDER BY 1, vivos DESC
  `;
  console.log(after);

  await local.end();
  await dest.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
