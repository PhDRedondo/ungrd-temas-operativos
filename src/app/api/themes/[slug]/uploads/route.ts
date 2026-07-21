import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { after } from "next/server";
import { NextResponse } from "next/server";
import { getTheme } from "@/themes";
import { requireThemeWrite } from "@/lib/auth/session";
import { parseExcelUpload, remapRowToThemeFields } from "@/lib/excel/template";
import {
  createUpload,
  finishUpload,
  insertValidatedRecords,
  upsertThemeCatalog,
  writeAudit,
} from "@/lib/records/repository";
import {
  schemaFingerprint,
  validateRow,
  type RowValidationError,
  type ValidatedRecord,
} from "@/lib/validation/record-schema";

type Ctx = { params: Promise<{ slug: string }> };

const ASYNC_THRESHOLD = 500;

async function processRows(params: {
  themeId: string;
  uploadId: string;
  userId: string;
  rows: Record<string, unknown>[];
  theme: NonNullable<ReturnType<typeof getTheme>>;
}) {
  const accepted: ValidatedRecord[] = [];
  const errors: RowValidationError[] = [];

  params.rows.forEach((raw, idx) => {
    const rowNumber = idx + 2;
    const mapped = remapRowToThemeFields(params.theme, raw);
    const result = validateRow(params.theme, mapped, rowNumber);
    if (result.ok) accepted.push(result.data);
    else errors.push(...result.errors);
  });

  try {
    const { inserted, duplicates } = await insertValidatedRecords({
      themeId: params.themeId,
      items: accepted,
      source: "excel",
      uploadId: params.uploadId,
      userId: params.userId,
    });

    await finishUpload({
      uploadId: params.uploadId,
      status: errors.length && !inserted.length && !duplicates ? "failed" : "done",
      accepted: inserted.length,
      rejected: params.rows.length - accepted.length,
      duplicates,
      errors,
    });

    await writeAudit({
      userId: params.userId,
      action: "upload.process",
      entity: "uploads",
      entityId: params.uploadId,
      after: {
        accepted: inserted.length,
        rejected: params.rows.length - accepted.length,
        duplicates,
      },
    });

    return { inserted, duplicates, errors, acceptedCount: accepted.length };
  } catch (err) {
    await finishUpload({
      uploadId: params.uploadId,
      status: "failed",
      accepted: 0,
      rejected: params.rows.length,
      duplicates: 0,
      errors: [
        {
          row: 0,
          field: "_",
          code: "SERVER",
          message: err instanceof Error ? err.message : "Error al insertar",
        },
      ],
    });
    throw err;
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const authz = await requireThemeWrite(slug);
  if (!authz.ok) return authz.response;

  const theme = getTheme(slug);
  if (!theme) {
    return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  }

  await upsertThemeCatalog(theme);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  const maxMb = Number(process.env.SECURITY_MAX_BODY_MB) || 12;
  const maxBytes = maxMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return NextResponse.json(
      {
        error: `Archivo demasiado grande (máx ${maxMb} MB)`,
        code: "PAYLOAD_TOO_LARGE",
      },
      { status: 413 },
    );
  }

  const nameLower = file.name.toLowerCase();
  if (!nameLower.endsWith(".xlsx") && !nameLower.endsWith(".xls")) {
    return NextResponse.json(
      { error: "Solo se permiten archivos Excel (.xlsx)", code: "BAD_FILE_TYPE" },
      { status: 415 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > maxBytes) {
    return NextResponse.json(
      { error: `Archivo demasiado grande (máx ${maxMb} MB)`, code: "PAYLOAD_TOO_LARGE" },
      { status: 413 },
    );
  }

  const parsed = await parseExcelUpload(buf);

  if (parsed.meta.themeId && parsed.meta.themeId !== theme.id) {
    return NextResponse.json(
      {
        error: `La plantilla pertenece al tema "${parsed.meta.themeId}", no a "${theme.id}"`,
      },
      { status: 400 },
    );
  }

  const expectedVersion = theme.schemaVersion ?? 1;
  if (
    parsed.meta.schemaVersion !== undefined &&
    parsed.meta.schemaVersion !== expectedVersion
  ) {
    return NextResponse.json(
      {
        error: `Versión de plantilla desactualizada (archivo v${parsed.meta.schemaVersion}, actual v${expectedVersion}). Descargue la plantilla nueva.`,
      },
      { status: 400 },
    );
  }

  const expectedFp = schemaFingerprint(theme);
  if (parsed.meta.fingerprint && parsed.meta.fingerprint !== expectedFp) {
    return NextResponse.json(
      {
        error:
          "La huella del schema no coincide. Descargue la plantilla oficial del tema.",
      },
      { status: 400 },
    );
  }

  if (!parsed.rows.length) {
    return NextResponse.json(
      { error: "El archivo no contiene filas de datos" },
      { status: 400 },
    );
  }

  const uploadsDir = path.join(process.cwd(), "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const storageName = `${Date.now()}_${theme.id}_${safeName}`;
  await writeFile(path.join(uploadsDir, storageName), buf);

  const asyncMode = parsed.rows.length >= ASYNC_THRESHOLD;

  const upload = await createUpload({
    themeId: theme.id,
    schemaVersion: expectedVersion,
    fileName: file.name,
    storagePath: storageName,
    userId: authz.actor.userId,
    status: asyncMode ? "pending" : "processing",
  });

  if (asyncMode) {
    after(async () => {
      try {
        await dbUpdateProcessing(upload.id);
        await processRows({
          themeId: theme.id,
          uploadId: upload.id,
          userId: authz.actor.userId,
          rows: parsed.rows,
          theme,
        });
      } catch (err) {
        console.error("[upload async]", err);
      }
    });

    return NextResponse.json({
      ok: true,
      async: true,
      uploadId: upload.id,
      queued: parsed.rows.length,
      message: `Carga en cola (${parsed.rows.length} filas). Consulte la bandeja.`,
    });
  }

  const result = await processRows({
    themeId: theme.id,
    uploadId: upload.id,
    userId: authz.actor.userId,
    rows: parsed.rows,
    theme,
  });

  return NextResponse.json({
    ok: true,
    async: false,
    uploadId: upload.id,
    accepted: result.inserted.length,
    rejected: parsed.rows.length - result.acceptedCount,
    duplicates: result.duplicates,
    errors: result.errors,
    preview: result.inserted.slice(0, 8),
  });
}

async function dbUpdateProcessing(uploadId: string) {
  const { db } = await import("@/db");
  const { uploads } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  await db
    .update(uploads)
    .set({ status: "processing" })
    .where(eq(uploads.id, uploadId));
}
