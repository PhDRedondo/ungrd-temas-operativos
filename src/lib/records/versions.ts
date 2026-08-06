/**
 * Versionamiento de registros: snapshots + restore (trazabilidad).
 */
import { and, desc, eq, isNull, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { recordVersions, records } from "@/db/schema";
import type { ThemeConfig } from "@/themes/shared/types";
import {
  normalizeValidated,
  rowContentHash,
} from "@/lib/validation/record-schema";
import type { RecordRow } from "@/lib/records/types";
import { writeAudit } from "@/lib/records/repository";

export type RecordVersionView = {
  id: string;
  recordId: string;
  version: number;
  departamento: string;
  municipio: string;
  fecha: string;
  estado: string;
  valor: number;
  payload: Record<string, unknown>;
  changedFields: string[];
  reason: string;
  createdBy: string | null;
  createdAt: string;
};

function dbRecordToFlat(r: typeof records.$inferSelect): Record<string, unknown> {
  const payload = (r.payload || {}) as Record<string, unknown>;
  return {
    ...payload,
    departamento: r.departamento,
    municipio: r.municipio,
    fecha: String(r.fecha),
    estado: r.estado,
    valor: Number(r.valor),
  };
}

function toVersionView(
  v: typeof recordVersions.$inferSelect,
): RecordVersionView {
  return {
    id: v.id,
    recordId: v.recordId,
    version: v.version,
    departamento: v.departamento,
    municipio: v.municipio,
    fecha: String(v.fecha),
    estado: v.estado,
    valor: Number(v.valor),
    payload: (v.payload || {}) as Record<string, unknown>,
    changedFields: (v.changedFields || []) as string[],
    reason: v.reason || "",
    createdBy: v.createdBy,
    createdAt: v.createdAt.toISOString(),
  };
}

async function nextVersionNumber(recordId: string): Promise<number> {
  const [row] = await db
    .select({ m: max(recordVersions.version) })
    .from(recordVersions)
    .where(eq(recordVersions.recordId, recordId));
  return Number(row?.m || 0) + 1;
}

async function insertSnapshot(params: {
  record: typeof records.$inferSelect;
  changedFields: string[];
  reason: string;
  userId?: string;
}) {
  const version = await nextVersionNumber(params.record.id);
  const [row] = await db
    .insert(recordVersions)
    .values({
      recordId: params.record.id,
      themeId: params.record.themeId,
      version,
      departamento: params.record.departamento,
      municipio: params.record.municipio,
      fecha: String(params.record.fecha),
      estado: params.record.estado,
      valor: String(params.record.valor ?? 0),
      payload: params.record.payload || {},
      changedFields: params.changedFields,
      reason: params.reason,
      createdBy: params.userId,
    })
    .returning();
  return row!;
}

function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed: string[] = [];
  for (const k of keys) {
    if (k === "id") continue;
    const a = before[k];
    const b = after[k];
    if (String(a ?? "") !== String(b ?? "")) changed.push(k);
  }
  return changed;
}

export async function getRecordById(recordId: string) {
  const [row] = await db
    .select()
    .from(records)
    .where(and(eq(records.id, recordId), isNull(records.deletedAt)))
    .limit(1);
  return row || null;
}

export async function listRecordVersions(
  recordId: string,
): Promise<RecordVersionView[]> {
  const rows = await db
    .select()
    .from(recordVersions)
    .where(eq(recordVersions.recordId, recordId))
    .orderBy(desc(recordVersions.version));
  return rows.map(toVersionView);
}

export async function getRecordVersion(recordId: string, version: number) {
  const [row] = await db
    .select()
    .from(recordVersions)
    .where(
      and(
        eq(recordVersions.recordId, recordId),
        eq(recordVersions.version, version),
      ),
    )
    .limit(1);
  return row ? toVersionView(row) : null;
}

/**
 * Aplica cambios parciales al registro, versionando el estado anterior.
 */
export async function patchRecordWithVersion(params: {
  theme: ThemeConfig;
  recordId: string;
  patch: Record<string, unknown>;
  userId?: string;
  reason?: string;
}): Promise<{ record: RecordRow; version: number; changedFields: string[] }> {
  const current = await getRecordById(params.recordId);
  if (!current) throw new Error("Registro no encontrado");
  if (current.themeId !== params.theme.id) {
    throw new Error("El registro no pertenece a este tema");
  }

  // Bootstrap: si no hay versiones, guardar foto inicial
  const existingVersions = await listRecordVersions(params.recordId);
  if (!existingVersions.length) {
    await insertSnapshot({
      record: current,
      changedFields: [],
      reason: "versión inicial",
      userId: params.userId,
    });
  }

  const beforeFlat = dbRecordToFlat(current);
  const merged: Record<string, unknown> = { ...beforeFlat };
  for (const [k, v] of Object.entries(params.patch)) {
    if (k === "id" || k === "tipo_registro" || k === "capa") continue;
    merged[k] = v;
  }
  // conservar discriminadores de capa
  if (beforeFlat.tipo_registro) merged.tipo_registro = beforeFlat.tipo_registro;
  if (beforeFlat.capa) merged.capa = beforeFlat.capa;

  const validated = normalizeValidated(params.theme, merged);
  const changedFields = diffFields(beforeFlat, {
    ...validated.raw,
    departamento: validated.departamento,
    municipio: validated.municipio,
    fecha: validated.fecha,
    estado: validated.estado,
    valor: validated.valor,
  });

  if (!changedFields.length) {
    const payload = (current.payload || {}) as Record<string, string | number>;
    return {
      record: {
        id: current.id,
        departamento: current.departamento,
        municipio: current.municipio,
        fecha: String(current.fecha),
        estado: current.estado,
        valor: Number(current.valor),
        ...payload,
      },
      version: existingVersions[0]?.version || 1,
      changedFields: [],
    };
  }

  // Hash único: si choca con otra fila, sufijo con id
  let contentHash = validated.contentHash;
  const [clash] = await db
    .select({ id: records.id })
    .from(records)
    .where(
      and(
        eq(records.themeId, params.theme.id),
        eq(records.contentHash, contentHash),
        sql`${records.id} <> ${params.recordId}`,
      ),
    )
    .limit(1);
  if (clash) {
    contentHash = rowContentHash(params.theme.id, {
      ...validated.raw,
      _recordId: params.recordId,
      _v: Date.now(),
    });
  }

  const [updated] = await db
    .update(records)
    .set({
      departamento: validated.departamento || "SIN DEPARTAMENTO",
      municipio: validated.municipio || "SIN MUNICIPIO",
      fecha: validated.fecha || new Date().toISOString().slice(0, 10),
      estado: validated.estado || "SIN ESTADO",
      valor: String(validated.valor ?? 0),
      payload: validated.payload,
      contentHash,
      updatedAt: new Date(),
    })
    .where(eq(records.id, params.recordId))
    .returning();

  if (!updated) throw new Error("No se pudo actualizar");

  const snap = await insertSnapshot({
    record: updated,
    changedFields,
    reason: params.reason || "edición en grilla de seguimiento",
    userId: params.userId,
  });

  await writeAudit({
    userId: params.userId,
    action: "record.update",
    entity: "records",
    entityId: params.recordId,
    before: beforeFlat,
    after: dbRecordToFlat(updated),
  });

  const payload = (updated.payload || {}) as Record<string, string | number>;
  return {
    record: {
      id: updated.id,
      departamento: updated.departamento,
      municipio: updated.municipio,
      fecha: String(updated.fecha),
      estado: updated.estado,
      valor: Number(updated.valor),
      ...payload,
    },
    version: snap.version,
    changedFields,
  };
}

/**
 * Restaura una versión anterior: aplica su payload y crea una versión nueva.
 */
export async function restoreRecordVersion(params: {
  theme: ThemeConfig;
  recordId: string;
  version: number;
  userId?: string;
}): Promise<{ record: RecordRow; version: number }> {
  const target = await getRecordVersion(params.recordId, params.version);
  if (!target) throw new Error("Versión no encontrada");

  const patch: Record<string, unknown> = {
    ...target.payload,
    departamento: target.departamento,
    municipio: target.municipio,
    fecha: target.fecha,
    estado: target.estado,
    valor: target.valor,
  };

  const result = await patchRecordWithVersion({
    theme: params.theme,
    recordId: params.recordId,
    patch,
    userId: params.userId,
    reason: `restauración de versión ${params.version}`,
  });

  return { record: result.record, version: result.version };
}
