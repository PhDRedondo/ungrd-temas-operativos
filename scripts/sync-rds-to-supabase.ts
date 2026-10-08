/**
 * Copia lo operativo de RDS Alibaba → Supabase (espejo de transición).
 * No imprime passwords. Destino: DATABASE_URL_SUPABASE.
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";
import { maskDbUrl } from "./lib/medallion-db-url";

const BATCH = 80;
const THEME = "ejecucion-financiera";

function sslFor(url: string): false | "require" {
  if (/127\.0\.0\.1|localhost/.test(url)) return false;
  try {
    const u = new URL(url.replace(/^postgres(ql)?:/i, "http:"));
    const mode = (u.searchParams.get("sslmode") || "").toLowerCase();
    if (mode === "disable" || mode === "allow" || mode === "prefer") return false;
  } catch {
    /* ignore */
  }
  return "require";
}

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function counts(sql: postgres.Sql, label: string) {
  const themes = await sql`
    SELECT theme_id, count(*) FILTER (WHERE deleted_at IS NULL)::int AS live
    FROM records
    GROUP BY 1
    ORDER BY 1
  `;
  const smd = await sql`
    SELECT
      count(*) FILTER (WHERE deleted_at IS NULL)::int AS live,
      count(*) FILTER (WHERE deleted_at IS NULL AND coalesce(payload->>'_kind','') = 'corte-cupo')::int AS cupos
    FROM records
    WHERE theme_id = ${THEME}
  `;
  const uploads = await sql`
    SELECT count(*)::int AS n FROM uploads WHERE theme_id = ${THEME}
  `;
  console.log(`\n[${label}]`);
  console.log("  ejecucion-financiera live", smd[0]?.live, "cupos", smd[0]?.cupos, "uploads", uploads[0]?.n);
  for (const t of themes) console.log(`  ${t.theme_id}: ${t.live}`);
  return { themes, smd: smd[0], uploads: uploads[0]?.n ?? 0 };
}

async function main() {
  const srcUrl = process.env.DATABASE_URL?.trim() || "";
  const destUrl = process.env.DATABASE_URL_SUPABASE?.trim() || "";
  if (!srcUrl) throw new Error("Falta DATABASE_URL (RDS)");
  if (!destUrl) throw new Error("Falta DATABASE_URL_SUPABASE");
  if (!/rds\.aliyuncs\.com/i.test(srcUrl)) {
    throw new Error("DATABASE_URL no es RDS Alibaba; aborto");
  }
  if (!/supabase/i.test(destUrl)) {
    throw new Error("DATABASE_URL_SUPABASE no parece Supabase; aborto");
  }

  const src = postgres(srcUrl, {
    max: 2,
    ssl: sslFor(srcUrl),
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 30,
  });
  const dest = postgres(destUrl, {
    max: 4,
    ssl: sslFor(destUrl),
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 30,
  });

  console.log("origen", maskDbUrl(srcUrl));
  console.log("destino", maskDbUrl(destUrl));
  await counts(src, "RDS");
  await counts(dest, "Supabase antes");

  const theme = await src`
    SELECT id, name, short_name, description, unit, value_label, schema_version, field_schema, updated_at
    FROM themes WHERE id = ${THEME}
  `;
  for (const t of theme) {
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
  console.log("\ntheme upsert", theme.map((t) => `${t.id}@v${t.schema_version}`).join(", ") || "(vacío)");

  const users = await src`
    SELECT DISTINCT u.id, u.keycloak_sub, u.email, u.name, u.role, u.created_at, u.updated_at
    FROM users u
    WHERE u.id IN (
      SELECT created_by FROM uploads WHERE theme_id = ${THEME} AND created_by IS NOT NULL
      UNION
      SELECT created_by FROM records WHERE theme_id = ${THEME} AND created_by IS NOT NULL
    )
  `;
  for (const part of chunk(users, BATCH)) {
    await dest`
      INSERT INTO users (id, keycloak_sub, email, name, role, created_at, updated_at)
      SELECT * FROM jsonb_to_recordset(${dest.json(
        part.map((u) => ({
          id: u.id,
          keycloak_sub: u.keycloak_sub,
          email: u.email,
          name: u.name,
          role: u.role,
          created_at: u.created_at,
          updated_at: u.updated_at,
        })) as never,
      )}) AS x(
        id uuid, keycloak_sub text, email text, name text, role text,
        created_at timestamptz, updated_at timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        role = EXCLUDED.role,
        updated_at = EXCLUDED.updated_at
    `;
  }
  console.log("users upsert", users.length);

  const uploads = await src`
    SELECT id, theme_id, schema_version, file_name, storage_path, status,
           accepted, rejected, duplicates, errors, created_by, created_at, finished_at
    FROM uploads
    WHERE theme_id = ${THEME}
  `;
  for (const part of chunk(uploads, BATCH)) {
    await dest`
      INSERT INTO uploads (
        id, theme_id, schema_version, file_name, storage_path, status,
        accepted, rejected, duplicates, errors, created_by, created_at, finished_at
      )
      SELECT * FROM jsonb_to_recordset(${dest.json(
        part.map((u) => ({
          id: u.id,
          theme_id: u.theme_id,
          schema_version: u.schema_version,
          file_name: u.file_name,
          storage_path: u.storage_path,
          status: u.status,
          accepted: u.accepted,
          rejected: u.rejected,
          duplicates: u.duplicates,
          errors: u.errors ?? [],
          created_by: u.created_by,
          created_at: u.created_at,
          finished_at: u.finished_at,
        })) as never,
      )}) AS x(
        id uuid, theme_id text, schema_version int, file_name text, storage_path text,
        status text, accepted int, rejected int, duplicates int, errors jsonb,
        created_by uuid, created_at timestamptz, finished_at timestamptz
      )
      ON CONFLICT (id) DO UPDATE SET
        file_name = EXCLUDED.file_name,
        status = EXCLUDED.status,
        accepted = EXCLUDED.accepted,
        rejected = EXCLUDED.rejected,
        duplicates = EXCLUDED.duplicates,
        errors = EXCLUDED.errors,
        finished_at = EXCLUDED.finished_at
    `;
  }
  console.log("uploads upsert", uploads.length);

  const records = await src`
    SELECT id, theme_id, departamento, municipio, fecha::text AS fecha, estado, valor::text AS valor,
           payload, source, content_hash, upload_id, created_by, created_at, updated_at, deleted_at
    FROM records
    WHERE theme_id = ${THEME}
  `;
  const live = records.filter((r) => !r.deleted_at);
  const destUploadIds = new Set(
    (await dest`SELECT id FROM uploads WHERE theme_id = ${THEME}`).map((x) => x.id),
  );
  const destUserIds = new Set((await dest`SELECT id FROM users`).map((x) => x.id));

  const destHashes = new Map(
    (
      await dest`
        SELECT id, content_hash FROM records WHERE theme_id = ${THEME}
      `
    ).map((x) => [x.content_hash, x.id]),
  );

  const keepDestIds = new Set<string>();
  let upserted = 0;
  let hashUpdated = 0;
  let inserted = 0;
  for (const part of chunk(live, BATCH)) {
    const byHash: Array<(typeof live)[number] & { destId: string }> = [];
    const byId: typeof live = [];
    for (const r of part) {
      const existingId = destHashes.get(r.content_hash);
      if (existingId && existingId !== r.id) {
        byHash.push({ ...r, destId: existingId });
        keepDestIds.add(existingId);
      } else {
        byId.push(r);
        keepDestIds.add(r.id);
      }
    }
    if (byHash.length) {
      await dest`
        UPDATE records r SET
          departamento = v.departamento,
          municipio = v.municipio,
          fecha = v.fecha,
          estado = v.estado,
          valor = v.valor,
          payload = v.payload,
          source = v.source,
          upload_id = v.upload_id,
          updated_at = v.updated_at,
          deleted_at = NULL
        FROM jsonb_to_recordset(${dest.json(
          byHash.map((r) => ({
            id: r.destId,
            departamento: r.departamento,
            municipio: r.municipio,
            fecha: r.fecha,
            estado: r.estado,
            valor: r.valor,
            payload: r.payload,
            source: r.source,
            upload_id: r.upload_id && destUploadIds.has(r.upload_id) ? r.upload_id : null,
            updated_at: r.updated_at,
          })) as never,
        )}) AS v(
          id uuid, departamento text, municipio text, fecha date, estado text,
          valor numeric, payload jsonb, source text, upload_id uuid, updated_at timestamptz
        )
        WHERE r.id = v.id
      `;
      hashUpdated += byHash.length;
    }
    if (byId.length) {
      const rows = byId.map((r) => ({
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
        upload_id: r.upload_id && destUploadIds.has(r.upload_id) ? r.upload_id : null,
        created_by: r.created_by && destUserIds.has(r.created_by) ? r.created_by : null,
        created_at: r.created_at,
        updated_at: r.updated_at,
      }));
      await dest`
        INSERT INTO records (
          id, theme_id, departamento, municipio, fecha, estado, valor,
          payload, source, content_hash, upload_id, created_by, created_at, updated_at, deleted_at
        )
        SELECT x.id, x.theme_id, x.departamento, x.municipio, x.fecha, x.estado, x.valor,
               x.payload, x.source, x.content_hash, x.upload_id, x.created_by, x.created_at, x.updated_at, NULL
        FROM jsonb_to_recordset(${dest.json(rows as never)}) AS x(
          id uuid, theme_id text, departamento text, municipio text, fecha date, estado text,
          valor numeric, payload jsonb, source text, content_hash text, upload_id uuid,
          created_by uuid, created_at timestamptz, updated_at timestamptz
        )
        ON CONFLICT (id) DO UPDATE SET
          departamento = EXCLUDED.departamento,
          municipio = EXCLUDED.municipio,
          fecha = EXCLUDED.fecha,
          estado = EXCLUDED.estado,
          valor = EXCLUDED.valor,
          payload = EXCLUDED.payload,
          source = EXCLUDED.source,
          content_hash = EXCLUDED.content_hash,
          upload_id = EXCLUDED.upload_id,
          updated_at = EXCLUDED.updated_at,
          deleted_at = NULL
      `;
      inserted += byId.length;
    }
    upserted += part.length;
    process.stdout.write(`  records ${upserted}/${live.length}\r`);
  }
  console.log(`  records listos ${live.length} (insert/id ${inserted}, hash ${hashUpdated})          `);

  const keepIds = [...keepDestIds];
  let hidden = 0;
  if (keepIds.length) {
    const gone = await dest`
      UPDATE records
      SET deleted_at = now(), updated_at = now()
      WHERE theme_id = ${THEME}
        AND deleted_at IS NULL
        AND id NOT IN ${dest(keepIds)}
      RETURNING id
    `;
    hidden = gone.length;
  }
  console.log("ocultos en supabase (ya no viven en RDS)", hidden);

  await counts(dest, "Supabase después");

  await src.end();
  await dest.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
