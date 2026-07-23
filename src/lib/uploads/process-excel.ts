/**
 * Pipeline compartido de carga Excel: validar, clasificar upsert, dry-run.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { records } from "@/db/schema";
import type { ThemeConfig } from "@/themes/shared/types";
import { remapRowToThemeFields } from "@/lib/excel/template";
import {
  validateRow,
  type RowValidationError,
  type ValidatedRecord,
} from "@/lib/validation/record-schema";
import {
  insertValidatedRecords,
  type RecordRow,
} from "@/lib/records/repository";

export type UploadMode = "insert" | "upsert";

export type ClassifiedRow = {
  item: ValidatedRecord;
  rowNumber: number;
  action: "insert" | "update" | "skip_duplicate";
  existingId?: string;
};

export type ValidateBatchResult = {
  accepted: ValidatedRecord[];
  errors: RowValidationError[];
  classified: ClassifiedRow[];
  summary: {
    totalRows: number;
    valid: number;
    invalid: number;
    wouldInsert: number;
    wouldUpdate: number;
    wouldSkipDuplicate: number;
    withoutTrackingKey: number;
  };
};

/** Clave de negocio: seguimiento + capa (permite bitácora y maqueta juntas). */
export function businessTrackingKey(item: ValidatedRecord): string | null {
  const clave = String(item.payload.clave_seguimiento ?? "")
    .trim()
    .toLowerCase();
  if (!clave) return null;
  const capa = String(
    item.payload.tipo_registro ?? item.payload.capa ?? "",
  )
    .trim()
    .toLowerCase();
  return `${clave}\u0000${capa}`;
}

export function parseBusinessTrackingKey(key: string): {
  clave: string;
  capa: string;
} {
  const [clave, capa = ""] = key.split("\u0000");
  return { clave: clave || "", capa };
}

export function validateExcelRows(
  theme: ThemeConfig,
  rows: Record<string, unknown>[],
): { accepted: ValidatedRecord[]; errors: RowValidationError[] } {
  const accepted: ValidatedRecord[] = [];
  const errors: RowValidationError[] = [];
  rows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const mapped = remapRowToThemeFields(theme, raw);
    const result = validateRow(theme, mapped, rowNumber);
    if (result.ok) accepted.push(result.data);
    else errors.push(...result.errors);
  });
  return { accepted, errors };
}

/** Carga mapa clave_negocio → id de registro existente (no borrado). */
export async function loadExistingTrackingMap(
  themeId: string,
): Promise<Map<string, string>> {
  const rows = await db
    .select({
      id: records.id,
      clave: sql<string>`lower(coalesce(${records.payload}->>'clave_seguimiento',''))`,
      tipo: sql<string>`lower(coalesce(${records.payload}->>'tipo_registro', ${records.payload}->>'capa',''))`,
    })
    .from(records)
    .where(and(eq(records.themeId, themeId), isNull(records.deletedAt)));

  const map = new Map<string, string>();
  for (const r of rows) {
    const clave = String(r.clave || "").trim();
    if (!clave) continue;
    const key = `${clave}\u0000${String(r.tipo || "").trim()}`;
    if (!map.has(key)) map.set(key, r.id);
  }
  return map;
}

export async function classifyForUpsert(
  themeId: string,
  accepted: ValidatedRecord[],
  mode: UploadMode,
): Promise<ClassifiedRow[]> {
  if (mode === "insert") {
    return accepted.map((item, i) => ({
      item,
      rowNumber: i + 2,
      action: "insert" as const,
    }));
  }

  const existing = await loadExistingTrackingMap(themeId);
  const seenHash = new Set<string>();
  const seenBiz = new Set<string>();
  const out: ClassifiedRow[] = [];

  for (let i = 0; i < accepted.length; i++) {
    const item = accepted[i]!;
    const rowNumber = i + 2;
    if (seenHash.has(item.contentHash)) {
      out.push({ item, rowNumber, action: "skip_duplicate" });
      continue;
    }
    seenHash.add(item.contentHash);

    const biz = businessTrackingKey(item);
    if (!biz) {
      out.push({ item, rowNumber, action: "insert" });
      continue;
    }
    if (seenBiz.has(biz)) {
      out.push({ item, rowNumber, action: "skip_duplicate" });
      continue;
    }
    seenBiz.add(biz);

    const existingId = existing.get(biz);
    if (existingId) {
      out.push({ item, rowNumber, action: "update", existingId });
    } else {
      out.push({ item, rowNumber, action: "insert" });
    }
  }
  return out;
}

export async function buildValidateBatch(
  theme: ThemeConfig,
  rows: Record<string, unknown>[],
  mode: UploadMode,
): Promise<ValidateBatchResult> {
  const { accepted, errors } = validateExcelRows(theme, rows);
  const classified = await classifyForUpsert(theme.id, accepted, mode);
  const withoutTrackingKey = accepted.filter(
    (a) => !businessTrackingKey(a),
  ).length;

  return {
    accepted,
    errors,
    classified,
    summary: {
      totalRows: rows.length,
      valid: accepted.length,
      invalid: rows.length - accepted.length,
      wouldInsert: classified.filter((c) => c.action === "insert").length,
      wouldUpdate: classified.filter((c) => c.action === "update").length,
      wouldSkipDuplicate: classified.filter(
        (c) => c.action === "skip_duplicate",
      ).length,
      withoutTrackingKey,
    },
  };
}

export async function upsertValidatedRecords(params: {
  themeId: string;
  classified: ClassifiedRow[];
  source: "form" | "excel" | "seed";
  uploadId?: string;
  userId?: string;
}): Promise<{
  inserted: RecordRow[];
  updated: number;
  duplicates: number;
}> {
  const toInsert = params.classified
    .filter((c) => c.action === "insert")
    .map((c) => c.item);
  const toUpdate = params.classified.filter((c) => c.action === "update");
  const duplicates = params.classified.filter(
    (c) => c.action === "skip_duplicate",
  ).length;

  let updated = 0;
  let updateDupes = 0;
  for (const c of toUpdate) {
    if (!c.existingId) continue;
    try {
      await db
        .update(records)
        .set({
          departamento: c.item.departamento || "SIN DEPARTAMENTO",
          municipio: c.item.municipio || "SIN MUNICIPIO",
          fecha: c.item.fecha || new Date().toISOString().slice(0, 10),
          estado: c.item.estado || "SIN ESTADO",
          valor: String(c.item.valor ?? 0),
          payload: c.item.payload,
          contentHash: c.item.contentHash,
          source: params.source,
          uploadId: params.uploadId,
        })
        .where(eq(records.id, c.existingId));
      updated += 1;
    } catch {
      // Choque raro de contentHash único con otra fila
      updateDupes += 1;
    }
  }

  const { inserted, duplicates: insertDups } = await insertValidatedRecords({
    themeId: params.themeId,
    items: toInsert,
    source: params.source,
    uploadId: params.uploadId,
    userId: params.userId,
  });

  return {
    inserted,
    updated,
    duplicates: duplicates + insertDups + updateDupes,
  };
}
