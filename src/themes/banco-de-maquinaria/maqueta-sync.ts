/**
 * Sync Banco de Maquinaria:
 *  1) Bitácora → Convenio.estado (+ observaciones) y DETALLE.estado_convenio
 *     (geo del convenio no se pisa: viene del alta de convenio)
 *  2) Entrega → DETALLE.estado_maquina = ENTREGADA
 */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { records } from "@/db/schema";
import type { RecordRow } from "@/lib/records/types";
import { dbToRow } from "@/lib/records/db-to-row";
import { patchRecordWithVersion } from "@/lib/records/versions";
import { getTheme } from "@/themes";
import {
  bmaqCapaLookupVariants,
  normalizeBmaqCapa,
} from "@/themes/banco-de-maquinaria/capture-forms";

const THEME_ID = "banco-de-maquinaria";
const MAQUETA_CAPA = "Maqueta / inventario";
const CONVENIO_CAPA = "Convenio o proceso";
const BITACORA_CAPA = "Bitácora convenio";
const ENTREGA_CAPA = "Entrega a beneficiario";

function capaOf(r: RecordRow): string {
  return normalizeBmaqCapa(String(r.tipo_registro || r.capa || ""));
}

function serialOf(r: RecordRow): string {
  return String(r.serial || r.clave_seguimiento || "").trim();
}

function convenioOf(r: RecordRow): string {
  return String(r.no_convenio || r.clave_seguimiento || "").trim();
}

function dateKey(r: RecordRow, fields: string[]): string {
  for (const f of fields) {
    const v = String(r[f] || "").trim();
    if (v) return v.slice(0, 10);
  }
  return "0000-00-00";
}

function payloadVal(
  r: RecordRow,
  ...keys: string[]
): string | number | undefined {
  const raw = r as Record<string, unknown>;
  for (const k of keys) {
    const v = raw[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return v as string | number;
    }
  }
  return undefined;
}

function latestOf(rows: RecordRow[], dateFields: string[]): RecordRow | null {
  if (!rows.length) return null;
  return rows
    .slice()
    .sort((a, b) => {
      const da = dateKey(a, dateFields);
      const db_ = dateKey(b, dateFields);
      if (da !== db_) return db_.localeCompare(da);
      return String(b.id).localeCompare(String(a.id));
    })[0]!;
}

function put(patch: Record<string, unknown>, key: string, value: unknown) {
  if (value === undefined || value === null) return;
  const s = String(value).trim();
  if (s === "") return;
  if (/^(sin registro|no registra|n\/?a|-)$/i.test(s)) return;
  patch[key] = typeof value === "number" ? value : s;
}

function capaSqlFilter(capa: string) {
  const variants = bmaqCapaLookupVariants(capa);
  return sql`(
    coalesce(${records.payload}->>'tipo_registro','') IN (${sql.join(
      variants.map((v) => sql`${v}`),
      sql`, `,
    )})
    OR coalesce(${records.payload}->>'capa','') IN (${sql.join(
      variants.map((v) => sql`${v}`),
      sql`, `,
    )})
  )`;
}

function serialSqlFilter(serial: string) {
  const s = serial.toLowerCase();
  return sql`(
    lower(trim(coalesce(${records.payload}->>'serial',''))) = ${s}
    OR lower(trim(coalesce(${records.payload}->>'clave_seguimiento',''))) = ${s}
  )`;
}

function convenioSqlFilter(noConvenio: string) {
  const c = noConvenio.toLowerCase();
  return sql`(
    lower(trim(coalesce(${records.payload}->>'no_convenio',''))) = ${c}
    OR lower(trim(coalesce(${records.payload}->>'clave_seguimiento',''))) = ${c}
  )`;
}

/**
 * Tras bitácora: actualiza el convenio y proyecta estado_convenio a cada equipo.
 */
export async function syncBmaqConvenioFromBitacora(params: {
  noConvenio: string;
  userId?: string;
  sourceCapa?: string;
}): Promise<{ ok: boolean; changedFields?: string[]; equipos?: number }> {
  const noConvenio = params.noConvenio.trim();
  if (!noConvenio) return { ok: false };

  const theme = getTheme(THEME_ID);
  if (!theme) return { ok: false };

  const bitRowsDb = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.themeId, THEME_ID),
        isNull(records.deletedAt),
        capaSqlFilter(BITACORA_CAPA),
        convenioSqlFilter(noConvenio),
      ),
    );

  const bitacora = latestOf(
    bitRowsDb.map(dbToRow),
    ["fecha_de_estado", "fecha", "fecha_acta_de_inicio"],
  );
  if (!bitacora) return { ok: true, changedFields: [] };

  const estado = payloadVal(bitacora, "estado");
  const comentario = payloadVal(bitacora, "comentario", "observaciones");

  const changedAll = new Set<string>();

  const [convenioRow] = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.themeId, THEME_ID),
        isNull(records.deletedAt),
        capaSqlFilter(CONVENIO_CAPA),
        convenioSqlFilter(noConvenio),
      ),
    )
    .orderBy(desc(records.updatedAt))
    .limit(1);

  if (convenioRow) {
    const patch: Record<string, unknown> = {};
    // Solo el seguimiento (último estado / comentario). Depto/muni viven en el convenio.
    put(patch, "estado", estado);
    put(patch, "observaciones", comentario);
    if (Object.keys(patch).length) {
      try {
        const result = await patchRecordWithVersion({
          theme,
          recordId: convenioRow.id,
          patch,
          userId: params.userId,
          reason: `sync convenio ← ${params.sourceCapa || BITACORA_CAPA}`,
        });
        for (const f of result.changedFields || []) changedAll.add(f);
      } catch (err) {
        console.error("[bmaq-convenio-sync]", err);
        return { ok: false };
      }
    }
  }

  // Proyectar ESTADO CONVENIO a todos los equipos del convenio
  const detalleRows = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.themeId, THEME_ID),
        isNull(records.deletedAt),
        capaSqlFilter(MAQUETA_CAPA),
        sql`lower(trim(coalesce(${records.payload}->>'no_convenio',''))) = ${noConvenio.toLowerCase()}`,
      ),
    );

  let equipos = 0;
  if (estado !== undefined) {
    for (const row of detalleRows) {
      const patch: Record<string, unknown> = {};
      put(patch, "estado_convenio", estado);
      if (!Object.keys(patch).length) continue;
      try {
        const result = await patchRecordWithVersion({
          theme,
          recordId: row.id,
          patch,
          userId: params.userId,
          reason: `sync detalle.estado_convenio ← ${params.sourceCapa || BITACORA_CAPA}`,
        });
        if (result.changedFields?.length) {
          equipos += 1;
          for (const f of result.changedFields) changedAll.add(f);
        }
      } catch (err) {
        console.error("[bmaq-detalle-estado-convenio]", err);
      }
    }
  }

  return {
    ok: true,
    changedFields: [...changedAll],
    equipos,
  };
}

/**
 * Tras entrega: marca el detalle del serial como ENTREGADA.
 */
export async function syncBmaqDetalleFromEntrega(params: {
  serial: string;
  userId?: string;
  sourceCapa?: string;
}): Promise<{ ok: boolean; changedFields?: string[] }> {
  const serial = params.serial.trim();
  if (!serial) return { ok: false };

  const theme = getTheme(THEME_ID);
  if (!theme) return { ok: false };

  const entregaRows = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.themeId, THEME_ID),
        isNull(records.deletedAt),
        capaSqlFilter(ENTREGA_CAPA),
        serialSqlFilter(serial),
      ),
    )
    .limit(1);

  if (!entregaRows.length) return { ok: true, changedFields: [] };

  const [maquetaRow] = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.themeId, THEME_ID),
        isNull(records.deletedAt),
        capaSqlFilter(MAQUETA_CAPA),
        serialSqlFilter(serial),
      ),
    )
    .orderBy(desc(records.updatedAt))
    .limit(1);

  if (!maquetaRow) return { ok: false };

  const patch: Record<string, unknown> = { estado_maquina: "ENTREGADA" };

  try {
    const result = await patchRecordWithVersion({
      theme,
      recordId: maquetaRow.id,
      patch,
      userId: params.userId,
      reason: `sync detalle ← ${params.sourceCapa || ENTREGA_CAPA}`,
    });
    return { ok: true, changedFields: result.changedFields };
  } catch (err) {
    console.error("[bmaq-entrega-sync]", err);
    return { ok: false };
  }
}

export function serialFromRecord(r: RecordRow): string {
  return serialOf(r);
}

export function convenioFromRecord(r: RecordRow): string {
  return convenioOf(r);
}

export function capaFromRecord(r: RecordRow): string {
  return capaOf(r);
}
