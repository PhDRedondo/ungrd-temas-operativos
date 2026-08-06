/**
 * Admin: reemplaza Bitácora estado Agua desde Excel (multipart field `file`).
 * Misma lógica que scripts/reimport-agua-bitacora.ts — para prod sin psql local.
 */
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getTheme } from "@/themes";
import { requireAdmin } from "@/lib/auth/session";
import { remapRowToThemeFields } from "@/lib/excel/template";
import {
  insertValidatedRecords,
  writeAudit,
} from "@/lib/records/repository";
import { prepareTrackingRow } from "@/lib/uploads/capa-inference";
import {
  validateRow,
  type RowValidationError,
  type ValidatedRecord,
} from "@/lib/validation/record-schema";
import { syncAguaMaquetaFromLatest } from "@/themes/agua-y-saneamiento/maqueta-sync";
import { findDepartment, findMunicipality } from "@/lib/geo";

export const runtime = "nodejs";
export const maxDuration = 300;

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
    const o = v as {
      text?: string;
      result?: unknown;
      richText?: { text: string }[];
    };
    if (o.result != null) return String(o.result).trim();
    if (o.text) return String(o.text).trim();
    if (Array.isArray(o.richText))
      return o.richText.map((t) => t.text).join("").trim();
  }
  return String(v).trim();
}

export async function POST(req: Request) {
  const authz = await requireAdmin();
  if (!authz.ok) return authz.response;

  const theme = getTheme(THEME_ID);
  if (!theme) {
    return NextResponse.json({ error: "Tema no encontrado" }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Adjunte el Excel en el campo file" },
      { status: 400 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  // exceljs typings esperan Buffer Node; runtime acepta Uint8Array/Buffer
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
  const ws = wb.getWorksheet("bitacora");
  if (!ws) {
    return NextResponse.json(
      { error: 'Hoja "bitacora" no encontrada' },
      { status: 400 },
    );
  }

  const userId = authz.actor.userId;

  const altas = await db.execute(sql`
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
  const altaGeo = new Map<string, { departamento: string; municipio: string }>();
  for (const r of altas as unknown as Array<{
    op: string;
    departamento: string;
    municipio: string;
  }>) {
    const op = String(r.op || "").trim();
    if (!op || altaGeo.has(op)) continue;
    altaGeo.set(op, {
      departamento: String(r.departamento || "").trim(),
      municipio: String(r.municipio || "").trim(),
    });
  }

  const deletedRes = await db.execute(sql`
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
  const softDeleted = Array.isArray(deletedRes) ? deletedRes.length : 0;

  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = cellText(cell);
  });

  const accepted: ValidatedRecord[] = [];
  const errors: RowValidationError[] = [];

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
    if (!op) return;
    mapped.orden_de_proveeduria = op;
    mapped.clave_seguimiento = op;

    const geoRaw = altaGeo.get(op.toLowerCase());
    if (!geoRaw?.departamento) {
      errors.push({
        row: rowNumber,
        field: "orden_de_proveeduria",
        code: "NO_ALTA",
        message: `OP ${op} sin Alta`,
      });
      return;
    }
    const geo = canonicalizeGeo(geoRaw.departamento, geoRaw.municipio || "");
    if (!geo) {
      errors.push({
        row: rowNumber,
        field: "departamento",
        code: "INVALID_VALUE",
        message: `Departamento no DIVIPOLA: ${geoRaw.departamento}`,
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

  const { inserted, duplicates } = await insertValidatedRecords({
    themeId: THEME_ID,
    items: accepted,
    source: "excel",
    userId,
  });

  const ops = [
    ...new Set(
      accepted
        .map((r) =>
          String(
            r.payload.orden_de_proveeduria || r.payload.clave_seguimiento || "",
          ).trim(),
        )
        .filter(Boolean),
    ),
  ];
  let synced = 0;
  for (const op of ops) {
    const r = await syncAguaMaquetaFromLatest({
      op,
      userId,
      sourceCapa: CAPA,
    });
    if (r.ok) synced += 1;
  }

  await writeAudit({
    userId,
    action: "admin.agua_reimport_bitacora",
    entity: "records",
    entityId: THEME_ID,
    after: {
      fileName: file.name,
      softDeleted,
      accepted: accepted.length,
      inserted: inserted.length,
      duplicates,
      errors: errors.length,
      synced,
    },
  });

  return NextResponse.json({
    ok: true,
    fileName: file.name,
    softDeleted,
    validated: accepted.length,
    inserted: inserted.length,
    duplicates,
    errorCount: errors.length,
    errorSample: errors.slice(0, 10),
    opsSynced: synced,
    opsTotal: ops.length,
  });
}
