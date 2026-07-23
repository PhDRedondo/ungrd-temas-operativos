import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { after } from "next/server";
import { NextResponse } from "next/server";
import { getTheme } from "@/themes";
import { requireThemeWrite } from "@/lib/auth/session";
import { parseExcelUpload } from "@/lib/excel/template";
import {
  createUpload,
  finishUpload,
  upsertThemeCatalog,
  writeAudit,
} from "@/lib/records/repository";
import { schemaFingerprint } from "@/lib/validation/record-schema";
import {
  buildValidateBatch,
  upsertValidatedRecords,
  type UploadMode,
} from "@/lib/uploads/process-excel";

type Ctx = { params: Promise<{ slug: string }> };

const ASYNC_THRESHOLD = 500;

function parseMode(raw: FormDataEntryValue | null): UploadMode {
  return raw === "upsert" ? "upsert" : "insert";
}

function parseDryRun(raw: FormDataEntryValue | null): boolean {
  return raw === "1" || raw === "true" || raw === "yes";
}

async function processRows(params: {
  themeId: string;
  uploadId: string;
  userId: string;
  rows: Record<string, unknown>[];
  theme: NonNullable<ReturnType<typeof getTheme>>;
  mode: UploadMode;
  hint?: string;
}) {
  const batch = await buildValidateBatch(params.theme, params.rows, params.mode, {
    hint: params.hint,
  });

  try {
    const { inserted, updated, duplicates } = await upsertValidatedRecords({
      themeId: params.themeId,
      classified: batch.classified,
      source: "excel",
      uploadId: params.uploadId,
      userId: params.userId,
    });

    const acceptedTotal = inserted.length + updated;
    await finishUpload({
      uploadId: params.uploadId,
      status:
        batch.errors.length && !acceptedTotal && !duplicates
          ? "failed"
          : "done",
      accepted: acceptedTotal,
      rejected: batch.summary.invalid,
      duplicates,
      errors: batch.errors,
    });

    await writeAudit({
      userId: params.userId,
      action: "upload.process",
      entity: "uploads",
      entityId: params.uploadId,
      after: {
        mode: params.mode,
        inserted: inserted.length,
        updated,
        rejected: batch.summary.invalid,
        duplicates,
      },
    });

    return {
      inserted,
      updated,
      duplicates,
      errors: batch.errors,
      summary: batch.summary,
    };
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
  const dryRun = parseDryRun(form.get("dryRun"));
  const mode = parseMode(form.get("mode"));

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
      {
        error: `Archivo demasiado grande (máx ${maxMb} MB)`,
        code: "PAYLOAD_TOO_LARGE",
      },
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

  const capaHint = [file.name, parsed.meta.sheetName].filter(Boolean).join(" ");

  // Dry-run: valida y clasifica sin escribir en BD ni disco
  if (dryRun) {
    const batch = await buildValidateBatch(theme, parsed.rows, mode, {
      hint: capaHint,
    });
    return NextResponse.json({
      ok: true,
      dryRun: true,
      mode,
      uploadId: null,
      ...batch.summary,
      accepted: batch.summary.valid,
      rejected: batch.summary.invalid,
      duplicates: batch.summary.wouldSkipDuplicate,
      wouldInsert: batch.summary.wouldInsert,
      wouldUpdate: batch.summary.wouldUpdate,
      errors: batch.errors.slice(0, 80),
      preview: batch.accepted.slice(0, 8).map((r) => ({
        ...r.raw,
        id: "(preview)",
      })),
      tip:
        mode === "upsert"
          ? "Modo actualizar: filas con la misma clave de seguimiento + capa se actualizarán. Si la capa venía vacía, se infirió del nombre del archivo/hoja."
          : "Modo solo altas: no se actualizarán registros existentes (solo hash idéntico se omite).",
      capaHint: capaHint || null,
    });
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
          mode,
          hint: capaHint,
        });
      } catch (err) {
        console.error("[upload async]", err);
      }
    });

    return NextResponse.json({
      ok: true,
      async: true,
      dryRun: false,
      mode,
      uploadId: upload.id,
      queued: parsed.rows.length,
      message: `Carga en cola (${parsed.rows.length} filas, modo ${mode}). Consulte la bandeja.`,
    });
  }

  const result = await processRows({
    themeId: theme.id,
    uploadId: upload.id,
    userId: authz.actor.userId,
    rows: parsed.rows,
    theme,
    mode,
    hint: capaHint,
  });

  return NextResponse.json({
    ok: true,
    async: false,
    dryRun: false,
    mode,
    uploadId: upload.id,
    accepted: result.inserted.length + result.updated,
    inserted: result.inserted.length,
    updated: result.updated,
    rejected: result.summary.invalid,
    duplicates: result.duplicates,
    wouldInsert: result.summary.wouldInsert,
    wouldUpdate: result.summary.wouldUpdate,
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
