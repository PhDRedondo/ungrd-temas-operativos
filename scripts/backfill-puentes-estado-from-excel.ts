/**
 * Rellena payload.estado del inventario Puentes desde Excel Base General
 * (columna «Estado»: Instalado / Asignado / Disponible).
 *
 *   npx tsx scripts/backfill-puentes-estado-from-excel.ts [ruta.xlsx]
 */
import ExcelJS from "exceljs";
import postgres from "postgres";
import { remapRowToThemeFields } from "../src/lib/excel/template";
import { getTheme } from "../src/themes";
import {
  loadMedallionEnv,
  resolveAdminDatabaseUrl,
  maskDbUrl,
} from "./lib/medallion-db-url";

loadMedallionEnv();

const EXCEL =
  process.argv[2] ||
  // Preferir archivo con columna «ID» numérica (no solo ID UNICO largo).
  `${process.env.HOME}/Downloads/puentes 2.xlsx`;

async function main() {
  const theme = getTheme("puentes");
  if (!theme) throw new Error("Tema puentes no encontrado");

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(EXCEL);
  const ws =
    wb.getWorksheet("Base General Puentes") ||
    wb.worksheets.find((w) => /base.?general/i.test(w.name));
  if (!ws) throw new Error("Hoja Base General Puentes no encontrada");

  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = String(cell.text || cell.value || "").trim();
  });

  const byId = new Map<string, string>();
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const raw: Record<string, unknown> = {};
    headers.forEach((h, col) => {
      if (!h) return;
      const cell = row.getCell(col);
      let v: unknown = cell.text || cell.value;
      if (v && typeof v === "object" && "result" in (v as object)) {
        v = (v as { result?: unknown }).result;
      }
      raw[h] = v;
    });
    const mapped = remapRowToThemeFields(theme, raw);
    const idp = String(
      mapped.id_puente || mapped.id_unico || mapped.id || raw["ID UNICO"] || raw.ID || "",
    ).trim();
    const estado = String(mapped.estado || raw.Estado || raw.ESTADO || "").trim();
    if (idp && estado) byId.set(idp.toLowerCase(), estado);
  });

  console.log(`Excel: ${byId.size} filas con Estado (${EXCEL})`);

  const { adminUrl } = resolveAdminDatabaseUrl();
  console.log("DB:", maskDbUrl(adminUrl));
  const sql = postgres(adminUrl, { ssl: "require", max: 1, prepare: false });

  let updated = 0;
  let skipped = 0;
  for (const [idp, estado] of byId) {
    const res = await sql`
      UPDATE public.records
      SET
        payload = payload || jsonb_build_object('estado', ${estado}::text),
        updated_at = now()
      WHERE theme_id = 'puentes'
        AND deleted_at IS NULL
        AND lower(coalesce(payload->>'capa', payload->>'tipo_registro', ''))
            LIKE '%inventario%'
        AND lower(trim(coalesce(
          payload->>'id_puente',
          payload->>'id',
          payload->>'clave_seguimiento',
          ''
        ))) = ${idp}::text
        AND nullif(trim(coalesce(payload->>'estado', '')), '') IS NULL
      RETURNING id`;
    if (res.length) updated += res.length;
    else skipped += 1;
  }

  const [check] = await sql`
    SELECT
      count(*)::int AS n,
      count(*) FILTER (WHERE nullif(trim(payload->>'estado'), '') IS NOT NULL)::int AS con_estado
    FROM public.records
    WHERE theme_id = 'puentes'
      AND deleted_at IS NULL
      AND lower(coalesce(payload->>'capa', '')) LIKE '%inventario%'`;
  console.log(`Updated rows: ${updated} · skipped(no match/already set): ${skipped}`);
  console.log(`Inventario: ${check.con_estado}/${check.n} con estado`);
  await sql.end({ timeout: 1 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
