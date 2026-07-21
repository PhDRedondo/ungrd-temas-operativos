import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, records, themes, uploads, users } from "@/db/schema";
import type { ThemeConfig } from "@/themes/shared/types";
import type { ValidatedRecord } from "@/lib/validation/record-schema";
import type { AppRole } from "@/themes/shared/types";
import type { RecordRow } from "@/lib/records/types";

export type { RecordRow } from "@/lib/records/types";
export { formatCop, formatNumber } from "@/lib/records/types";

function dbToRow(r: typeof records.$inferSelect): RecordRow {
  const payload = (r.payload || {}) as Record<string, string | number>;
  return {
    id: r.id,
    departamento: r.departamento,
    municipio: r.municipio,
    fecha: String(r.fecha),
    estado: r.estado,
    valor: Number(r.valor),
    ...payload,
  };
}

export async function upsertThemeCatalog(theme: ThemeConfig) {
  const version = theme.schemaVersion ?? 1;
  await db
    .insert(themes)
    .values({
      id: theme.id,
      name: theme.name,
      shortName: theme.shortName,
      description: theme.description,
      unit: theme.unit,
      valueLabel: theme.valueLabel,
      schemaVersion: version,
      fieldSchema: theme.fields,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: themes.id,
      set: {
        name: theme.name,
        shortName: theme.shortName,
        description: theme.description,
        unit: theme.unit,
        valueLabel: theme.valueLabel,
        schemaVersion: version,
        fieldSchema: theme.fields,
        updatedAt: new Date(),
      },
    });
}

export async function ensureUser(params: {
  keycloakSub: string;
  email: string;
  name: string;
  role: AppRole;
}) {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.keycloakSub, params.keycloakSub))
    .limit(1);
  if (existing) {
    await db
      .update(users)
      .set({
        email: params.email,
        name: params.name,
        role: params.role,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
    return existing.id;
  }
  const [row] = await db
    .insert(users)
    .values({
      keycloakSub: params.keycloakSub,
      email: params.email,
      name: params.name,
      role: params.role,
    })
    .returning({ id: users.id });
  return row!.id;
}

export async function getRecordsForTheme(themeId: string): Promise<RecordRow[]> {
  const rows = await db
    .select()
    .from(records)
    .where(and(eq(records.themeId, themeId), isNull(records.deletedAt)))
    .orderBy(desc(records.createdAt));
  return rows.map(dbToRow);
}

export async function insertValidatedRecords(params: {
  themeId: string;
  items: ValidatedRecord[];
  source: "form" | "excel" | "seed";
  uploadId?: string;
  userId?: string;
}): Promise<{ inserted: RecordRow[]; duplicates: number }> {
  if (!params.items.length) return { inserted: [], duplicates: 0 };

  // Deduplicar dentro del mismo lote
  const seen = new Set<string>();
  const unique: ValidatedRecord[] = [];
  let duplicates = 0;
  for (const item of params.items) {
    if (seen.has(item.contentHash)) {
      duplicates += 1;
      continue;
    }
    seen.add(item.contentHash);
    unique.push(item);
  }

  const BATCH = 40;
  const inserted: (typeof records.$inferSelect)[] = [];
  for (let i = 0; i < unique.length; i += BATCH) {
    const chunk = unique.slice(i, i + BATCH);
    const rows = await db
      .insert(records)
      .values(
        chunk.map((item) => ({
          themeId: params.themeId,
          departamento: item.departamento || "SIN DEPARTAMENTO",
          municipio: item.municipio || "SIN MUNICIPIO",
          fecha: item.fecha || new Date().toISOString().slice(0, 10),
          estado: item.estado || "SIN ESTADO",
          valor: String(item.valor ?? 0),
          payload: item.payload,
          source: params.source,
          contentHash: item.contentHash,
          uploadId: params.uploadId,
          createdBy: params.userId,
        })),
      )
      .onConflictDoNothing({
        target: [records.themeId, records.contentHash],
      })
      .returning();
    inserted.push(...rows);
  }

  duplicates += unique.length - inserted.length;
  return { inserted: inserted.map(dbToRow), duplicates };
}

export async function createUpload(params: {
  themeId: string;
  schemaVersion: number;
  fileName: string;
  storagePath?: string;
  userId?: string;
  status?: string;
}) {
  const [row] = await db
    .insert(uploads)
    .values({
      themeId: params.themeId,
      schemaVersion: params.schemaVersion,
      fileName: params.fileName,
      storagePath: params.storagePath,
      status: params.status || "processing",
      createdBy: params.userId,
    })
    .returning();
  return row!;
}

export async function finishUpload(params: {
  uploadId: string;
  status: "done" | "failed";
  accepted: number;
  rejected: number;
  duplicates?: number;
  errors: unknown[];
}) {
  await db
    .update(uploads)
    .set({
      status: params.status,
      accepted: params.accepted,
      rejected: params.rejected,
      duplicates: params.duplicates ?? 0,
      errors: params.errors,
      finishedAt: new Date(),
    })
    .where(eq(uploads.id, params.uploadId));
}

export async function writeAudit(params: {
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}) {
  await db.insert(auditLog).values({
    userId: params.userId,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    before: params.before ?? null,
    after: params.after ?? null,
  });
}

/** Agregaciones SQL para analítica (escala mejor que solo cliente). */
export async function getThemeAggregates(themeId: string) {
  const byDept = await db
    .select({
      key: records.departamento,
      count: sql<number>`count(*)::int`,
      valor: sql<number>`coalesce(sum(${records.valor}),0)::float`,
    })
    .from(records)
    .where(and(eq(records.themeId, themeId), isNull(records.deletedAt)))
    .groupBy(records.departamento)
    .orderBy(sql`count(*) desc`);

  const byEstado = await db
    .select({
      key: records.estado,
      count: sql<number>`count(*)::int`,
      valor: sql<number>`coalesce(sum(${records.valor}),0)::float`,
    })
    .from(records)
    .where(and(eq(records.themeId, themeId), isNull(records.deletedAt)))
    .groupBy(records.estado);

  const byTipoRegistro = await db
    .select({
      key: sql<string>`coalesce(${records.payload}->>'tipo_registro', ${records.payload}->>'capa', 'Sin clasificar')`,
      count: sql<number>`count(*)::int`,
      valor: sql<number>`coalesce(sum(${records.valor}),0)::float`,
    })
    .from(records)
    .where(and(eq(records.themeId, themeId), isNull(records.deletedAt)))
    .groupBy(
      sql`coalesce(${records.payload}->>'tipo_registro', ${records.payload}->>'capa', 'Sin clasificar')`,
    )
    .orderBy(sql`count(*) desc`);

  const byClaveSeguimiento = await db
    .select({
      key: sql<string>`coalesce(nullif(${records.payload}->>'clave_seguimiento',''), '(sin clave)')`,
      count: sql<number>`count(*)::int`,
      valor: sql<number>`coalesce(sum(${records.valor}),0)::float`,
    })
    .from(records)
    .where(and(eq(records.themeId, themeId), isNull(records.deletedAt)))
    .groupBy(
      sql`coalesce(nullif(${records.payload}->>'clave_seguimiento',''), '(sin clave)')`,
    )
    .orderBy(sql`count(*) desc`)
    .limit(50);

  const byMonth = await db
    .select({
      key: sql<string>`to_char(${records.fecha}, 'YYYY-MM')`,
      count: sql<number>`count(*)::int`,
      valor: sql<number>`coalesce(sum(${records.valor}),0)::float`,
    })
    .from(records)
    .where(and(eq(records.themeId, themeId), isNull(records.deletedAt)))
    .groupBy(sql`to_char(${records.fecha}, 'YYYY-MM')`)
    .orderBy(sql`to_char(${records.fecha}, 'YYYY-MM')`);

  const [totals] = await db
    .select({
      count: sql<number>`count(*)::int`,
      valor: sql<number>`coalesce(sum(${records.valor}),0)::float`,
    })
    .from(records)
    .where(and(eq(records.themeId, themeId), isNull(records.deletedAt)));

  return {
    totals: totals || { count: 0, valor: 0 },
    byDepartamento: byDept,
    byEstado,
    byTipoRegistro,
    byClaveSeguimiento,
    byMonth,
  };
}
