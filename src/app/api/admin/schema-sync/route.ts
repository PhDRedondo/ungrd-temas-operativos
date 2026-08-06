import { NextResponse } from "next/server";
import { sql as dsql } from "drizzle-orm";
import { db } from "@/db";
import { requireAdmin } from "@/lib/auth/session";
import { writeAudit } from "@/lib/records/repository";
import { upsertThemeCatalog } from "@/lib/records/repository";
import { THEMES } from "@/themes";

/**
 * Alinea schema mínimo en producción (columnas/tablas nuevas).
 * Idempotente — seguro re-ejecutar.
 */
export async function POST() {
  const authz = await requireAdmin();
  if (!authz.ok) return authz.response;

  const steps: string[] = [];

  await db.execute(dsql`
    ALTER TABLE records
    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()
  `);
  steps.push("records.updated_at");

  await db.execute(dsql`
    CREATE TABLE IF NOT EXISTS record_versions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      record_id uuid NOT NULL REFERENCES records(id) ON DELETE CASCADE,
      theme_id text NOT NULL REFERENCES themes(id),
      version integer NOT NULL,
      departamento text NOT NULL,
      municipio text NOT NULL,
      fecha date NOT NULL,
      estado text NOT NULL,
      valor numeric(18, 2) NOT NULL DEFAULT 0,
      payload jsonb NOT NULL DEFAULT '{}'::jsonb,
      changed_fields jsonb DEFAULT '[]'::jsonb,
      reason text NOT NULL DEFAULT '',
      created_by uuid REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  steps.push("record_versions");

  await db.execute(dsql`
    CREATE UNIQUE INDEX IF NOT EXISTS record_versions_uidx
    ON record_versions (record_id, version)
  `);
  await db.execute(dsql`
    CREATE INDEX IF NOT EXISTS record_versions_record_idx
    ON record_versions (record_id)
  `);
  await db.execute(dsql`
    CREATE INDEX IF NOT EXISTS record_versions_theme_idx
    ON record_versions (theme_id)
  `);
  steps.push("record_versions_indexes");

  for (const theme of THEMES) {
    await upsertThemeCatalog(theme);
  }
  steps.push(`themes_catalog:${THEMES.length}`);

  await writeAudit({
    userId: authz.actor.userId,
    action: "admin.schema_sync",
    entity: "schema",
    entityId: "public",
    after: { steps },
  });

  return NextResponse.json({ ok: true, steps });
}
