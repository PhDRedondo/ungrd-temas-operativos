/**
 * Reemplaza records theme_id=fic con plantilla_fic_v3.xlsx (base consolidada).
 *
 * Uso:
 *   npx tsx scripts/import-fic-xlsx.ts
 *   npx tsx scripts/import-fic-xlsx.ts "/ruta/plantilla_fic_v3.xlsx"
 *   npx tsx scripts/import-fic-xlsx.ts archivo.xlsx --dry-run
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

const DEFAULT_XLSX =
  "/Users/jackstive26/Downloads/plantilla_fic_v3 (1).xlsx";

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v).split(/\r?\n/)[0]?.trim() ?? "";
  if (!s || s === "None" || s === "nan" || s === "NaN" || s === "NaT") {
    return "";
  }
  return s;
}

function parseSheet(filePath: string): Record<string, unknown>[] {
  const wb = XLSX.readFile(filePath, { cellDates: true, raw: false });
  const sheetName =
    wb.SheetNames.find((n) => /^fic$/i.test(n.trim())) ||
    wb.SheetNames.find((n) => /fic|transferenc/i.test(n)) ||
    wb.SheetNames.find((n) => !n.startsWith("_") && n !== "Instrucciones") ||
    wb.SheetNames[0]!;
  const ws = wb.Sheets[sheetName]!;
  const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(
    ws,
    { header: 1, defval: "", raw: false },
  );
  const headers = (matrix[0] || []).map((h) => String(h ?? "").trim());
  const rows: Record<string, unknown>[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r] || [];
    if (!row.some((c) => String(c ?? "").trim() !== "")) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (!h) return;
      obj[h] = row[i] ?? "";
    });
    rows.push(obj);
  }
  console.log(`Excel hoja "${sheetName}": ${rows.length} filas`);
  return rows;
}

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--dry-run");
  const dryRun = process.argv.includes("--dry-run");
  const filePath = args[0] || DEFAULT_XLSX;
  if (!existsSync(filePath)) {
    console.error("No existe el Excel:", filePath);
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("Falta DATABASE_URL en .env.local");
    process.exit(1);
  }

  const host =
    process.env.DATABASE_URL.match(/@([^/]+)/)?.[1] || "(sin host)";
  console.log(`DB host: ${host}${dryRun ? " · dry-run" : ""}`);
  if (/127\.0\.0\.1|localhost/.test(host)) {
    console.error("Abortado: DATABASE_URL apunta a local.");
    process.exit(1);
  }

  const { db } = await import("../src/db");
  const { records } = await import("../src/db/schema");
  const { and, eq, isNull } = await import("drizzle-orm");
  const { getTheme } = await import("../src/themes");
  const { remapRowToThemeFields } = await import("../src/lib/excel/template");
  const { prepareTrackingRow } = await import(
    "../src/lib/uploads/capa-inference"
  );
  const {
    insertValidatedRecords,
    ensureUser,
    upsertThemeCatalog,
  } = await import("../src/lib/records/repository");
  const { validateRow } = await import("../src/lib/validation/record-schema");
  type ValidatedRecord =
    import("../src/lib/validation/record-schema").ValidatedRecord;
  type RowValidationError =
    import("../src/lib/validation/record-schema").RowValidationError;

  const theme = getTheme("fic");
  if (!theme) {
    console.error("Tema fic no registrado");
    process.exit(1);
  }

  await upsertThemeCatalog(theme);
  const userId = await ensureUser({
    keycloakSub: "import-fic-parquet",
    email: "import-fic@ungrd.gov.co",
    name: "Import FIC",
    role: "admin",
  });

  const rawRows = parseSheet(filePath);
  const accepted: ValidatedRecord[] = [];
  const errors: RowValidationError[] = [];

  rawRows.forEach((raw, idx) => {
    const mapped = prepareTrackingRow(
      theme,
      remapRowToThemeFields(theme, raw),
      { hint: "plantilla_fic_v3" },
    );
    const cdp = cell(mapped.no_cdp);
    const id = cell(mapped.id_transferencia);
    if (!cdp && !id) {
      errors.push({
        row: idx + 2,
        field: "no_cdp",
        code: "required",
        message: "Sin número FIC ni id_transferencia",
      });
      return;
    }
    if (cdp) mapped.no_cdp = cdp;
    if (id) mapped.id_transferencia = id;
    if (cdp && id) mapped.clave_seguimiento = `${cdp}·${id}`;
    else if (cdp) mapped.clave_seguimiento = cdp;

    const result = validateRow(theme, mapped, idx + 2);
    if (result.ok) accepted.push(result.data);
    else errors.push(...result.errors);
  });

  console.log(`Validadas: ${accepted.length} · Errores: ${errors.length}`);
  if (errors.length) {
    console.log("Muestra errores:", JSON.stringify(errors.slice(0, 10), null, 2));
  }

  if (dryRun) {
    const sample = accepted[0]?.payload || {};
    console.log("Muestra payload[0] claves nuevas:", {
      formato: sample.formato_de_aprobacion_de_la_atencion,
      acto2: sample.acto_administrativo_otorgamiento_del_recurso_2,
      fechaActo2: sample.fecha_acto_administrativo_resolucion_2,
      fechaMod: sample.fecha_acto_administrativo_modificacion,
      valor: accepted[0]?.valor,
      fecha: accepted[0]?.fecha,
    });
    return;
  }

  const now = new Date();
  const softDeleted = await db
    .update(records)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(records.themeId, "fic"), isNull(records.deletedAt)))
    .returning({ id: records.id });
  console.log(`Soft-delete FIC vivos: ${softDeleted.length}`);

  const { inserted, duplicates } = await insertValidatedRecords({
    themeId: "fic",
    items: accepted,
    source: "excel",
    userId,
  });

  console.log(
    `✓ FIC xlsx → PostgreSQL: insertados=${inserted.length} duplicados=${duplicates} rechazados=${errors.length}`,
  );

  mkdirSync(path.join(process.cwd(), ".tmp"), { recursive: true });
  writeFileSync(
    path.join(process.cwd(), ".tmp/import-fic-xlsx.last.json"),
    JSON.stringify(
      {
        at: new Date().toISOString(),
        host,
        filePath,
        softDeleted: softDeleted.length,
        accepted: accepted.length,
        inserted: inserted.length,
        duplicates,
        errors: errors.length,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
