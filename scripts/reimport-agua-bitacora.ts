/**
 * Reemplaza la capa «Bitácora estado» de Agua con el Excel oficial.
 *
 * - Soft-delete de bitácoras previas (libera content_hash)
 * - Inserta eventos de la hoja `bitacora`
 * - Hereda depto/municipio del Alta por OP
 * - Sincroniza Maqueta (estado/proceso/dependencia vigentes)
 *
 * Uso:
 *   npx tsx scripts/reimport-agua-bitacora.ts
 *   npx tsx scripts/reimport-agua-bitacora.ts "/ruta/Bitacora….xlsx"
 */
import "dotenv/config";
import { config } from "dotenv";
config({ path: ".env.local" });

import path from "path";
import ExcelJS from "exceljs";
import { sql } from "drizzle-orm";
import { db } from "../src/db";
import { getTheme } from "../src/themes";
import { remapRowToThemeFields } from "../src/lib/excel/template";
import {
  insertValidatedRecords,
  upsertThemeCatalog,
  ensureUser,
} from "../src/lib/records/repository";
import { prepareTrackingRow } from "../src/lib/uploads/capa-inference";
import { validateRow } from "../src/lib/validation/record-schema";
import { syncAguaMaquetaFromLatest } from "../src/themes/agua-y-saneamiento/maqueta-sync";
import { findDepartment, findMunicipality } from "../src/lib/geo";

const THEME_ID = "agua-y-saneamiento";
const CAPA = "Bitácora estado";

function canonicalizeGeo(departamento: string, municipio: string) {
  const dept = findDepartment(departamento);
  if (!dept) return null;
  const muni =
    findMunicipality(dept.name, municipio) ||
    findMunicipality(dept.name, dept.name) ||
    dept.municipalities[0];
  return {
    departamento: dept.name,
    municipio: muni?.name || dept.municipalities[0]?.name || dept.name,
  };
}

const DEFAULT_FILE = path.join(
  process.env.HOME || "",
  "Downloads",
  "Bitacora Agua y Saneamiento def (1).xlsx",
);

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return String(v).trim();
  }
  if (v instanceof Date) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (o.result != null) return String(o.result).trim();
    if (o.text) return String(o.text).trim();
    if (Array.isArray(o.richText)) return o.richText.map((t) => t.text).join("").trim();
  }
  return String(v).trim();
}

async function loadAltaGeo(): Promise<
  Map<string, { departamento: string; municipio: string }>
> {
  const rows = await db.execute(sql`
    SELECT
      lower(trim(COALESCE(payload->>'orden_de_proveeduria', payload->>'clave_seguimiento', ''))) AS op,
      COALESCE(departamento, payload->>'departamento', '') AS departamento,
      COALESCE(municipio, payload->>'municipio', '') AS municipio
    FROM records
    WHERE theme_id = ${THEME_ID}
      AND deleted_at IS NULL
      AND (
        COALESCE(payload->>'tipo_registro','') IN ('Alta / orden', 'Maqueta / orden')
        OR COALESCE(payload->>'capa','') IN ('Alta / orden', 'Maqueta / orden')
      )
  `);
  const map = new Map<string, { departamento: string; municipio: string }>();
  for (const r of rows as unknown as Array<{
    op: string;
    departamento: string;
    municipio: string;
  }>) {
    const op = String(r.op || "").trim();
    if (!op || map.has(op)) continue;
    map.set(op, {
      departamento: String(r.departamento || "").trim(),
      municipio: String(r.municipio || "").trim(),
    });
  }
  return map;
}

async function softDeleteBitacora(): Promise<number> {
  const res = await db.execute(sql`
    UPDATE records
    SET
      deleted_at = NOW(),
      updated_at = NOW(),
      content_hash = content_hash || '-del-' || id::text
    WHERE theme_id = ${THEME_ID}
      AND deleted_at IS NULL
      AND (
        COALESCE(payload->>'tipo_registro','') IN ('Bitácora estado', 'Bitácora')
        OR COALESCE(payload->>'capa','') IN ('Bitácora estado', 'Bitácora')
      )
    RETURNING id
  `);
  return Array.isArray(res) ? res.length : 0;
}

async function main() {
  const filePath = process.argv[2] || DEFAULT_FILE;
  const theme = getTheme(THEME_ID);
  if (!theme) throw new Error("Tema agua-y-saneamiento no encontrado");

  await upsertThemeCatalog(theme);
  const userId = await ensureUser({
    keycloakSub: "import-script",
    email: "import@ungrd.gov.co",
    name: "Importador",
    role: "admin",
  });

  console.log("Leyendo", filePath);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.getWorksheet("bitacora");
  if (!ws) throw new Error('Hoja "bitacora" no encontrada');

  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = cellText(cell);
  });

  const altaGeo = await loadAltaGeo();
  console.log(`Altas con geo: ${altaGeo.size}`);

  const deleted = await softDeleteBitacora();
  console.log(`Bitácoras previas soft-delete: ${deleted}`);

  const accepted: import("../src/lib/validation/record-schema").ValidatedRecord[] =
    [];
  const errors: import("../src/lib/validation/record-schema").RowValidationError[] =
    [];
  let skippedNoOp = 0;

  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const raw: Record<string, unknown> = {};
    headers.forEach((h, col) => {
      if (!h || col === 0) return;
      raw[h] = cellText(row.getCell(col));
    });
    if (!Object.values(raw).some((v) => String(v || "").trim())) return;

    const mapped = remapRowToThemeFields(theme, raw);
    mapped.tipo_registro = CAPA;
    mapped.capa = CAPA;

    const op = String(
      mapped.orden_de_proveeduria || mapped.clave_seguimiento || "",
    ).trim();
    if (!op) {
      skippedNoOp += 1;
      return;
    }
    mapped.orden_de_proveeduria = op;
    mapped.clave_seguimiento = op;

    const geoRaw = altaGeo.get(op.toLowerCase());
    if (!geoRaw?.departamento) {
      errors.push({
        row: rowNumber,
        field: "orden_de_proveeduria",
        code: "NO_ALTA",
        message: `OP ${op} sin Alta / orden en DB`,
      });
      return;
    }
    const geo = canonicalizeGeo(geoRaw.departamento, geoRaw.municipio || "");
    if (!geo) {
      errors.push({
        row: rowNumber,
        field: "departamento",
        code: "INVALID_VALUE",
        message: `Departamento no DIVIPOLA: ${geoRaw.departamento} (OP ${op})`,
      });
      return;
    }
    mapped.departamento = geo.departamento;
    mapped.municipio = geo.municipio;

    const prepared = prepareTrackingRow(theme, mapped, {
      hint: "bitacora.xlsx",
    });
    const result = validateRow(theme, prepared, rowNumber);
    if (result.ok) accepted.push(result.data);
    else errors.push(...result.errors);
  });

  console.log(
    `Validadas: ${accepted.length} · errores: ${errors.length} · sin OP: ${skippedNoOp}`,
  );
  if (errors.length) {
    const byCode = new Map<string, number>();
    for (const e of errors) {
      const k = `${e.code}:${e.field}`;
      byCode.set(k, (byCode.get(k) || 0) + 1);
    }
    console.log("Errores por tipo:", Object.fromEntries(byCode));
    console.log("Muestra:", JSON.stringify(errors.slice(0, 8), null, 2));
  }

  const { inserted, duplicates } = await insertValidatedRecords({
    themeId: THEME_ID,
    items: accepted,
    source: "excel",
    userId,
  });
  console.log(`Insertados: ${inserted.length} · duplicados lote: ${duplicates}`);

  const ops = [
    ...new Set(
      accepted
        .map((r) =>
          String(r.payload.orden_de_proveeduria || r.payload.clave_seguimiento || "").trim(),
        )
        .filter(Boolean),
    ),
  ];
  console.log(`Sincronizando Maqueta para ${ops.length} OPs…`);
  let synced = 0;
  for (const op of ops) {
    const r = await syncAguaMaquetaFromLatest({
      op,
      userId,
      sourceCapa: CAPA,
    });
    if (r.ok) synced += 1;
  }
  console.log(`Maqueta sync OK: ${synced}/${ops.length}`);
  console.log("✓ Reimport bitácora Agua completado");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
