/**
 * Reimporta Puentes desde Excel (inventario + bitácora + estructuración).
 * Usado por scripts/reimport-puentes.ts y POST /api/admin/puentes-reimport.
 */
import ExcelJS from "exceljs";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { records } from "@/db/schema";
import { getTheme } from "@/themes";
import { remapRowToThemeFields } from "@/lib/excel/template";
import {
  insertValidatedRecords,
  upsertThemeCatalog,
} from "@/lib/records/repository";
import { prepareTrackingRow } from "@/lib/uploads/capa-inference";
import { validateRow } from "@/lib/validation/record-schema";
import { syncPuenteInventarioFromLatest } from "@/themes/puentes/puente-sync";
import { normalizeClaveProceso } from "@/themes/puentes/process-keys";
import {
  buildProcesoSeedRow,
  groupProcesosPendientes,
} from "@/themes/puentes/proceso-seed";
import { findDepartment, findMunicipality } from "@/lib/geo";
import type {
  RowValidationError,
  ValidatedRecord,
} from "@/lib/validation/record-schema";

const THEME_ID = "puentes";
const CAPA_INVENTARIO = "Inventario puente";
const CAPA_BITACORA = "Bitácora estado";
const CAPA_ESTRUCT = "Contrato estructuración";

export type PuentesReimportResult = {
  softDeleted: number;
  estructuracion: { validated: number; inserted: number; errors: number; skipped: number };
  inventario: { validated: number; inserted: number; errors: number; skipped: number };
  bitacora: { validated: number; inserted: number; errors: number; skipped: number };
  procesosEstructurados: number;
  huerfanos: number;
  huerfanosSample: { id: string; contrato: string }[];
  convenioBackfilled: number;
  inventarioSynced: number;
  inventarioSyncTotal: number;
  procesosSeeded: number;
  errorSample: RowValidationError[];
};

function parseMoneyCell(raw: unknown): number | undefined {
  const s = String(raw ?? "").trim();
  if (!s) return undefined;
  const cleaned = s.replace(/[^\d.,-]/g, "");
  if (!cleaned) return undefined;
  let normalized = cleaned;
  if (cleaned.includes(",") && cleaned.includes(".")) {
    normalized =
      cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned.replace(/,/g, "");
  } else if ((cleaned.match(/\./g) || []).length > 1) {
    normalized = cleaned.replace(/\./g, "");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
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
    if (Array.isArray(o.richText)) {
      return o.richText.map((t) => t.text).join("").trim();
    }
  }
  return String(v).trim();
}

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

function readSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
): { headers: string[]; ws: ExcelJS.Worksheet } {
  const ws =
    wb.getWorksheet(sheetName) ||
    wb.worksheets.find(
      (w) => w.name.trim().toLowerCase() === sheetName.toLowerCase(),
    );
  if (!ws) throw new Error(`Hoja "${sheetName}" no encontrada`);
  const headers: string[] = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = cellText(cell);
  });
  return { headers, ws };
}

function rowFromSheet(
  ws: ExcelJS.Worksheet,
  headers: string[],
  rowNumber: number,
): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  const row = ws.getRow(rowNumber);
  headers.forEach((h, col) => {
    if (!h || col === 0) return;
    const val = cellText(row.getCell(col));
    const key = h.trim();
    if (Object.prototype.hasOwnProperty.call(raw, key)) {
      if (/^id\s*unico$/i.test(key) || /^id$/i.test(key)) {
        const prev = String(raw[key] ?? "").trim();
        const next = String(val ?? "").trim();
        const prevNum = /^\d+$/.test(prev);
        const nextNum = /^\d+$/.test(next);
        if (nextNum && !prevNum) {
          raw[key] = next;
          if (prev) raw.codigo_operativo = prev;
        } else if (prevNum && next && !nextNum) {
          raw.codigo_operativo = next;
        } else if (!prev && next) {
          raw[key] = next;
        }
      }
      return;
    }
    raw[key] = val;
  });
  return raw;
}

async function softDeleteThemeRecords(): Promise<number> {
  const res = await db.execute(sql`
    UPDATE records
    SET
      deleted_at = NOW(),
      updated_at = NOW(),
      content_hash = content_hash || '-del-' || id::text
    WHERE theme_id = ${THEME_ID}
      AND deleted_at IS NULL
    RETURNING id
  `);
  return Array.isArray(res) ? res.length : 0;
}

function processRows(params: {
  theme: NonNullable<ReturnType<typeof getTheme>>;
  ws: ExcelJS.Worksheet;
  headers: string[];
  capa: string;
  hint: string;
  rowFilter?: (mapped: Record<string, unknown>) => boolean;
  rowPatch?: (
    mapped: Record<string, unknown>,
    rowNumber: number,
  ) => Record<string, unknown> | null;
  rowFinalize?: (
    prepared: Record<string, unknown>,
    rowNumber: number,
  ) => Record<string, unknown>;
}): { accepted: ValidatedRecord[]; errors: RowValidationError[]; skipped: number } {
  const accepted: ValidatedRecord[] = [];
  const errors: RowValidationError[] = [];
  let skipped = 0;

  params.ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const raw = rowFromSheet(params.ws, params.headers, rowNumber);
    if (!Object.values(raw).some((v) => String(v || "").trim())) return;

    let mapped = remapRowToThemeFields(params.theme, raw);
    mapped.tipo_registro = params.capa;
    mapped.capa = params.capa;

    if (params.rowFilter && !params.rowFilter(mapped)) {
      skipped += 1;
      return;
    }

    if (params.rowPatch) {
      const patched = params.rowPatch(mapped, rowNumber);
      if (!patched) {
        skipped += 1;
        return;
      }
      mapped = patched;
    }

    let prepared = prepareTrackingRow(params.theme, mapped, { hint: params.hint });
    if (params.rowFinalize) {
      prepared = params.rowFinalize(prepared, rowNumber);
    }
    const result = validateRow(params.theme, prepared, rowNumber);
    if (result.ok) accepted.push(result.data);
    else errors.push(...result.errors);
  });

  return { accepted, errors, skipped };
}

export async function runPuentesReimport(params: {
  buffer: Buffer;
  userId: string;
  seedProcesos?: boolean;
  log?: (msg: string) => void;
}): Promise<PuentesReimportResult> {
  const log = params.log || (() => undefined);
  const theme = getTheme(THEME_ID);
  if (!theme) throw new Error("Tema puentes no encontrado");

  await upsertThemeCatalog(theme);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(params.buffer as unknown as ExcelJS.Buffer);

  const softDeleted = await softDeleteThemeRecords();
  log(`Registros previos soft-delete: ${softDeleted}`);

  const estSheet = readSheet(wb, "Contratos Estructuracion");
  const estResult = processRows({
    theme,
    ws: estSheet.ws,
    headers: estSheet.headers,
    capa: CAPA_ESTRUCT,
    hint: "Contratos Estructuracion",
    rowFilter: (mapped) =>
      Boolean(String(mapped.contrato_convenio || mapped.contrato || "").trim()),
    rowPatch: (mapped) => {
      if (mapped.tipo && !mapped.tipo_proceso) {
        mapped.tipo_proceso = mapped.tipo;
        delete mapped.tipo;
      }
      const money = parseMoneyCell(mapped.valor);
      if (money !== undefined) mapped.valor = money;
      mapped.departamento = "Bogotá D.C.";
      mapped.municipio = "Bogotá D.C.";
      if (mapped["Fecha inicio"]) {
        mapped.fecha_inicio_proceso = mapped["Fecha inicio"];
        delete mapped["Fecha inicio"];
      }
      if (mapped["Fecha fin"]) {
        mapped.fecha_fin_proceso = mapped["Fecha fin"];
        delete mapped["Fecha fin"];
      }
      return mapped;
    },
  });
  log(
    `Estructuración: ${estResult.accepted.length} válidas · ${estResult.errors.length} errores · ${estResult.skipped} omitidas`,
  );

  const { inserted: estInserted } = await insertValidatedRecords({
    themeId: THEME_ID,
    items: estResult.accepted,
    source: "excel",
    userId: params.userId,
  });

  const procesosEstructurados = new Set<string>();
  for (const item of estResult.accepted) {
    const contrato = String(
      item.payload.contrato_convenio || item.payload.contrato || "",
    ).trim();
    if (!contrato) continue;
    procesosEstructurados.add(normalizeClaveProceso(contrato).toLowerCase());
  }

  const invSheet = readSheet(wb, "Base General Puentes");
  const invHuerfanos: { id: string; contrato: string }[] = [];
  const invResult = processRows({
    theme,
    ws: invSheet.ws,
    headers: invSheet.headers,
    capa: CAPA_INVENTARIO,
    hint: "Base General Puentes",
    rowPatch: (mapped) => {
      const idp = String(
        mapped.id_puente ||
          mapped.id_unico ||
          mapped.id ||
          mapped.ID ||
          mapped["ID UNICO"] ||
          "",
      ).trim();
      if (!idp) return null;
      mapped.id_puente = idp;
      mapped.clave_seguimiento = idp;
      const codigoOp = String(
        mapped.codigo_operativo ||
          mapped["ID UNICO_1"] ||
          mapped.id_unico_1 ||
          "",
      ).trim();
      if (codigoOp && codigoOp !== idp && !/^\d+$/.test(codigoOp)) {
        mapped.codigo_operativo = codigoOp;
      }
      const geo = canonicalizeGeo(
        String(mapped.departamento || ""),
        String(mapped.municipio || ""),
      );
      if (geo) {
        mapped.departamento = geo.departamento;
        mapped.municipio = geo.municipio;
      }
      if (mapped.comentarios && !mapped.descripcion_proceso) {
        mapped.descripcion_proceso = mapped.comentarios;
        delete mapped.comentarios;
      }
      const contrato = String(
        mapped.contrato_convenio || mapped.contrato || "",
      ).trim();
      const clave = contrato ? normalizeClaveProceso(contrato) : "";
      if (!clave || !procesosEstructurados.has(clave.toLowerCase())) {
        invHuerfanos.push({ id: idp, contrato: contrato || "(sin contrato)" });
      }
      return mapped;
    },
  });
  log(
    `Inventario: ${invResult.accepted.length} válidas · ${invResult.errors.length} errores · ${invResult.skipped} omitidas`,
  );

  const { inserted: invInserted } = await insertValidatedRecords({
    themeId: THEME_ID,
    items: invResult.accepted,
    source: "excel",
    userId: params.userId,
  });

  const inventarioCtx = new Map<
    string,
    {
      departamento: string;
      municipio: string;
      region: string;
      contrato_convenio: string;
      clave_proceso: string;
      tipo_vinculo: string;
    }
  >();
  for (const item of invResult.accepted) {
    const p = item.payload;
    const idp = String(p.id_puente || p.clave_seguimiento || "").trim();
    if (!idp) continue;
    inventarioCtx.set(idp.toLowerCase(), {
      departamento: String(p.departamento || ""),
      municipio: String(p.municipio || ""),
      region: String(p.region || ""),
      contrato_convenio: String(p.contrato_convenio || ""),
      clave_proceso: String(p.clave_proceso || ""),
      tipo_vinculo: String(p.tipo_vinculo || ""),
    });
  }

  const bitSheet = readSheet(wb, "bitacora");
  const bitExtraErrors: RowValidationError[] = [];
  const bitResult = processRows({
    theme,
    ws: bitSheet.ws,
    headers: bitSheet.headers,
    capa: CAPA_BITACORA,
    hint: "bitacora",
    rowPatch: (mapped, rowNumber) => {
      const idp = String(
        mapped.id_puente ||
          mapped.id_unico ||
          mapped.id ||
          mapped.ID ||
          mapped["ID UNICO"] ||
          "",
      ).trim();
      if (!idp) return null;
      mapped.id_puente = idp;
      mapped.clave_seguimiento = idp;

      const convenioExcel = String(
        mapped.convenio_o_cto || mapped["convenio o cto"] || "",
      ).trim();
      if (convenioExcel) mapped.convenio_o_cto = convenioExcel;

      const inv = inventarioCtx.get(idp.toLowerCase());
      if (inv?.departamento) {
        mapped.departamento = inv.departamento;
        mapped.municipio = inv.municipio;
        if (!mapped.region && inv.region) mapped.region = inv.region;
      } else if (mapped.departamento) {
        const geo = canonicalizeGeo(
          String(mapped.departamento || ""),
          String(mapped.municipio || ""),
        );
        if (!geo) {
          bitExtraErrors.push({
            row: rowNumber,
            field: "id_puente",
            code: "NO_INVENTARIO",
            message: `Puente ${idp} sin inventario ni geo válida`,
          });
          return null;
        }
        mapped.departamento = geo.departamento;
        mapped.municipio = geo.municipio;
      } else {
        return null;
      }
      return mapped;
    },
    rowFinalize: (prepared) => {
      const idp = String(
        prepared.id_puente || prepared.clave_seguimiento || "",
      ).trim();
      const convenioExcel = String(prepared.convenio_o_cto || "").trim();
      const inv = inventarioCtx.get(idp.toLowerCase());
      if (inv?.contrato_convenio) {
        prepared.contrato_convenio = inv.contrato_convenio;
        prepared.clave_proceso = inv.clave_proceso;
        prepared.tipo_vinculo = inv.tipo_vinculo;
      }
      if (convenioExcel) {
        prepared.convenio_o_cto = convenioExcel;
      } else if (inv?.contrato_convenio) {
        prepared.convenio_o_cto = inv.contrato_convenio;
      }
      return prepared;
    },
  });
  bitResult.errors.push(...bitExtraErrors);
  log(
    `Bitácora: ${bitResult.accepted.length} válidas · ${bitResult.errors.length} errores · ${bitResult.skipped} omitidas`,
  );

  const { inserted: bitInserted } = await insertValidatedRecords({
    themeId: THEME_ID,
    items: bitResult.accepted,
    source: "excel",
    userId: params.userId,
  });

  const convenioPorPuente = new Map<string, string>();
  for (const item of bitResult.accepted) {
    const idp = String(
      item.payload.id_puente || item.payload.clave_seguimiento || "",
    )
      .trim()
      .toLowerCase();
    const conv = String(item.payload.convenio_o_cto || "").trim();
    if (idp && conv) convenioPorPuente.set(idp, conv);
  }
  let convenioBackfilled = 0;
  if (convenioPorPuente.size) {
    for (const [idp, conv] of convenioPorPuente) {
      const rows = await db
        .select()
        .from(records)
        .where(
          and(
            eq(records.themeId, THEME_ID),
            isNull(records.deletedAt),
            sql`lower(trim(coalesce(${records.payload}->>'capa', ${records.payload}->>'tipo_registro',''))) like '%inventario%'`,
            sql`lower(trim(coalesce(${records.payload}->>'id_puente', ${records.payload}->>'clave_seguimiento',''))) = ${idp}`,
          ),
        )
        .limit(5);
      for (const row of rows) {
        const payload = {
          ...(row.payload as Record<string, unknown>),
          convenio_o_cto: conv,
        };
        await db
          .update(records)
          .set({ payload, updatedAt: new Date() })
          .where(eq(records.id, row.id));
        convenioBackfilled += 1;
      }
    }
  }

  const ids = [
    ...new Set(
      [...invResult.accepted, ...bitResult.accepted]
        .map((r) =>
          String(r.payload.id_puente || r.payload.clave_seguimiento || "").trim(),
        )
        .filter(Boolean),
    ),
  ];
  let synced = 0;
  for (const idPuente of ids) {
    const r = await syncPuenteInventarioFromLatest({
      idPuente,
      userId: params.userId,
      sourceCapa: CAPA_BITACORA,
    });
    if (r.ok) synced += 1;
  }

  let procesosSeeded = 0;
  if (params.seedProcesos && invHuerfanos.length) {
    const pendientes = groupProcesosPendientes(
      invHuerfanos.map((h) => ({
        idPuente: h.id,
        contrato: h.contrato === "(sin contrato)" ? "" : h.contrato,
      })),
      procesosEstructurados,
    );
    const seedItems: ValidatedRecord[] = [];
    for (const p of pendientes) {
      const prepared = prepareTrackingRow(theme, buildProcesoSeedRow(p), {
        hint: "Contratos Estructuracion",
      });
      const result = validateRow(theme, prepared, 0);
      if (result.ok) seedItems.push(result.data);
    }
    const { inserted: seedInserted } = await insertValidatedRecords({
      themeId: THEME_ID,
      items: seedItems,
      source: "excel",
      userId: params.userId,
    });
    procesosSeeded = seedInserted.length;
  }

  const allErrors = [
    ...invResult.errors,
    ...bitResult.errors,
    ...estResult.errors,
  ];

  return {
    softDeleted,
    estructuracion: {
      validated: estResult.accepted.length,
      inserted: estInserted.length,
      errors: estResult.errors.length,
      skipped: estResult.skipped,
    },
    inventario: {
      validated: invResult.accepted.length,
      inserted: invInserted.length,
      errors: invResult.errors.length,
      skipped: invResult.skipped,
    },
    bitacora: {
      validated: bitResult.accepted.length,
      inserted: bitInserted.length,
      errors: bitResult.errors.length,
      skipped: bitResult.skipped,
    },
    procesosEstructurados: procesosEstructurados.size,
    huerfanos: invHuerfanos.length,
    huerfanosSample: invHuerfanos.slice(0, 15),
    convenioBackfilled,
    inventarioSynced: synced,
    inventarioSyncTotal: ids.length,
    procesosSeeded,
    errorSample: allErrors.slice(0, 10),
  };
}
