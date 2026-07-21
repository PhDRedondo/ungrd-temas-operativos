import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { uploads, users } from "@/db/schema";
import type { UploadListItem } from "@/lib/uploads/types";

export type { UploadListItem } from "@/lib/uploads/types";

export async function listUploads(params: {
  themeId?: string;
  userId?: string;
  limit?: number;
}): Promise<UploadListItem[]> {
  const limit = params.limit ?? 50;

  const conditions = [];
  if (params.themeId) conditions.push(eq(uploads.themeId, params.themeId));
  if (params.userId) conditions.push(eq(uploads.createdBy, params.userId));

  const query = db
    .select({
      id: uploads.id,
      themeId: uploads.themeId,
      fileName: uploads.fileName,
      status: uploads.status,
      accepted: uploads.accepted,
      rejected: uploads.rejected,
      duplicates: uploads.duplicates,
      schemaVersion: uploads.schemaVersion,
      createdAt: uploads.createdAt,
      finishedAt: uploads.finishedAt,
      errors: uploads.errors,
      createdByEmail: users.email,
      createdByName: users.name,
    })
    .from(uploads)
    .leftJoin(users, eq(uploads.createdBy, users.id))
    .orderBy(desc(uploads.createdAt))
    .limit(limit);

  const rows =
    conditions.length === 0
      ? await query
      : await query.where(
          conditions.length === 1 ? conditions[0]! : and(...conditions),
        );

  return rows.map((r) => ({
    id: r.id,
    themeId: r.themeId,
    fileName: r.fileName,
    status: r.status,
    accepted: r.accepted,
    rejected: r.rejected,
    duplicates: r.duplicates ?? 0,
    schemaVersion: r.schemaVersion,
    createdAt: r.createdAt.toISOString(),
    finishedAt: r.finishedAt ? r.finishedAt.toISOString() : null,
    createdByEmail: r.createdByEmail,
    createdByName: r.createdByName,
    errorCount: Array.isArray(r.errors) ? r.errors.length : 0,
  }));
}

export async function getUploadById(uploadId: string) {
  const [row] = await db
    .select({
      id: uploads.id,
      themeId: uploads.themeId,
      fileName: uploads.fileName,
      storagePath: uploads.storagePath,
      status: uploads.status,
      accepted: uploads.accepted,
      rejected: uploads.rejected,
      schemaVersion: uploads.schemaVersion,
      errors: uploads.errors,
      createdAt: uploads.createdAt,
      finishedAt: uploads.finishedAt,
      createdBy: uploads.createdBy,
      createdByEmail: users.email,
      createdByName: users.name,
    })
    .from(uploads)
    .leftJoin(users, eq(uploads.createdBy, users.id))
    .where(eq(uploads.id, uploadId))
    .limit(1);

  return row ?? null;
}

export function errorsToCsv(
  errors: unknown[],
): string {
  const header = "row,field,code,message";
  const lines = (errors as { row?: number; field?: string; code?: string; message?: string }[]).map(
    (e) =>
      [
        e.row ?? "",
        csvEscape(e.field ?? ""),
        csvEscape(e.code ?? ""),
        csvEscape(e.message ?? ""),
      ].join(","),
  );
  return [header, ...lines].join("\n");
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}
