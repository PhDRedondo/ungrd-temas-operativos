/**
 * Reimporta Puentes desde puentes 2.xlsx (inventario + bitácora + estructuración).
 *
 * - Soft-delete capas previas del tema
 * - Orden de alimentación: Contrato estructuración → Inventario → Bitácora
 *   (el proceso contractual nace primero; de él nacen los puentes y luego sus eventos)
 * - Reporta puentes cuyo contrato no está estructurado (procesos huérfanos)
 * - Hereda DIVIPOLA del inventario en bitácora
 * - Sincroniza inventario con última bitácora por id_puente
 *
 * Uso:
 *   npx tsx scripts/reimport-puentes.ts
 *   npx tsx scripts/reimport-puentes.ts "/ruta/puentes 2.xlsx"
 *   npx tsx scripts/reimport-puentes.ts "/ruta/archivo.xlsx" --seed-procesos
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
import { syncPuenteInventarioFromLatest } from "../src/themes/puentes/puente-sync";
import { normalizeClaveProceso } from "../src/themes/puentes/process-keys";
import {
  buildProcesoSeedRow,
  groupProcesosPendientes,
} from "../src/themes/puentes/proceso-seed";
import { findDepartment, findMunicipality } from "../src/lib/geo";
import type {
  RowValidationError,
  ValidatedRecord,
} from "../src/lib/validation/record-schema";

const THEME_ID = "puentes";
const CAPA_INVENTARIO = "Inventario puente";
const CAPA_BITACORA = "Bitácora estado";
const CAPA_ESTRUCT = "Contrato estructuración";

const DEFAULT_FILE = path.join(
  process.env.HOME || "",
  "Downloads",
  "puentes 2.xlsx",
);

/** Crea etapa inicial en Estructuración para procesos que solo vienen del inventario. */
const SEED_PROCESOS = process.argv.includes("--seed-procesos");

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
    // Base General trae dos «ID UNICO»: el numérico (1..N) y el código operativo.
    // Preferimos el ID numérico como llave canónica del puente.
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
  /**
   * Se aplica tras `prepareTrackingRow`, que ya descartó lo que la capa no
   * puede declarar (p. ej. el contrato en bitácora). Aquí se inyecta lo que
   * la fila hereda de su capa padre.
   */
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

async function main() {
  const filePath =
    process.argv.slice(2).find((a) => !a.startsWith("--")) || DEFAULT_FILE;
  const theme = getTheme(THEME_ID);
  if (!theme) throw new Error("Tema puentes no encontrado");

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

  const deleted = await softDeleteThemeRecords();
  console.log(`Registros previos soft-delete: ${deleted}`);

  // ── 1 · Contrato estructuración (raíz: aquí nace el proceso) ──
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
  console.log(
    `Estructuración: ${estResult.accepted.length} válidas · ${estResult.errors.length} errores · ${estResult.skipped} omitidas`,
  );

  const { inserted: estInserted } = await insertValidatedRecords({
    themeId: THEME_ID,
    items: estResult.accepted,
    source: "excel",
    userId,
  });
  console.log(`Estructuración insertados: ${estInserted.length}`);

  /** Procesos ya estructurados: base para validar de dónde nace cada puente. */
  const procesosEstructurados = new Set<string>();
  for (const item of estResult.accepted) {
    const contrato = String(
      item.payload.contrato_convenio || item.payload.contrato || "",
    ).trim();
    if (!contrato) continue;
    procesosEstructurados.add(normalizeClaveProceso(contrato).toLowerCase());
  }
  console.log(`Procesos estructurados: ${procesosEstructurados.size}`);

  // ── 2 · Inventario (los puentes nacen de un proceso) ──
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
      const geo = canonicalizeGeo(
        String(mapped.departamento || ""),
        String(mapped.municipio || ""),
      );
      if (geo) {
        mapped.departamento = geo.departamento;
        mapped.municipio = geo.municipio;
      }
      // En Base General la columna "comentarios" trae el texto legal del proceso.
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
  console.log(
    `Inventario: ${invResult.accepted.length} válidas · ${invResult.errors.length} errores · ${invResult.skipped} omitidas`,
  );
  if (invHuerfanos.length) {
    console.log(
      `Aviso · ${invHuerfanos.length} puente(s) sin proceso estructurado previo:`,
    );
    for (const h of invHuerfanos.slice(0, 15)) {
      console.log(`  - ${h.id} → ${h.contrato}`);
    }
    if (invHuerfanos.length > 15) {
      console.log(`  … y ${invHuerfanos.length - 15} más`);
    }
  }

  const { inserted: invInserted } = await insertValidatedRecords({
    themeId: THEME_ID,
    items: invResult.accepted,
    source: "excel",
    userId,
  });
  console.log(`Inventario insertados: ${invInserted.length}`);

  /** Contexto heredable del activo: territorio + proceso del que nació. */
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

  // ── 3 · Bitácora (evolución del puente ya inventariado) ──
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

      // Conservar etiqueta Excel «convenio o cto» para filtrar seguimiento.
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
      // El contrato del archivo ya fue descartado: el evento hereda el proceso
      // del puente. Se conserva convenio_o_cto (etiqueta Excel de seguimiento).
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
  console.log(
    `Bitácora: ${bitResult.accepted.length} válidas · ${bitResult.errors.length} errores · ${bitResult.skipped} omitidas`,
  );

  const { inserted: bitInserted } = await insertValidatedRecords({
    themeId: THEME_ID,
    items: bitResult.accepted,
    source: "excel",
    userId,
  });
  console.log(`Bitácora insertados: ${bitInserted.length}`);

  // Propagar «convenio o cto» del Excel a inventario (filtro de bitácora).
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
  if (convenioPorPuente.size) {
    const { db } = await import("../src/db");
    const { records } = await import("../src/db/schema");
    const { and, eq, isNull, sql } = await import("drizzle-orm");
    let backfilled = 0;
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
        backfilled += 1;
      }
    }
    console.log(
      `Inventario: convenio_o_cto propagado a ${backfilled} registro(s)`,
    );
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
  console.log(`Sincronizando inventario para ${ids.length} puentes…`);
  let synced = 0;
  for (const idPuente of ids) {
    const r = await syncPuenteInventarioFromLatest({
      idPuente,
      userId,
      sourceCapa: CAPA_BITACORA,
    });
    if (r.ok) synced += 1;
  }
  console.log(`Inventario sync OK: ${synced}/${ids.length}`);

  // Opción explícita: sembrar en Estructuración los procesos que solo existían
  // referenciados desde el inventario, para cerrar el orden proceso → puente.
  if (SEED_PROCESOS && invHuerfanos.length) {
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
      userId,
    });
    console.log(
      `Procesos sembrados en Estructuración: ${seedInserted.length}/${pendientes.length}`,
    );
  } else if (invHuerfanos.length) {
    console.log(
      "Sugerencia: correr con --seed-procesos para crear la etapa inicial de esos procesos.",
    );
  }

  const allErrors = [
    ...invResult.errors,
    ...bitResult.errors,
    ...estResult.errors,
  ];
  if (allErrors.length) {
    console.log("Muestra errores:", JSON.stringify(allErrors.slice(0, 8), null, 2));
  }

  console.log("✓ Reimport Puentes completado");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
