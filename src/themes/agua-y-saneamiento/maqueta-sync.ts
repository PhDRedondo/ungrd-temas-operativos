/**
 * Sincroniza la fila Alta / Maqueta con el ÚLTIMO evento de cada tabla
 * actualizable (Bitácora, estructuración, Pagos, Modificaciones).
 *
 * Regla (Modelo_Alimentacion): la Maqueta siempre refleja el vigente;
 * el historial vive en las capas append.
 */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { records } from "@/db/schema";
import type { RecordRow } from "@/lib/records/types";
import { dbToRow } from "@/lib/records/db-to-row";
import { getTheme } from "@/themes";
import { patchRecordWithVersion } from "@/lib/records/versions";
import {
  aguaCapaLookupVariants,
  normalizeAguaCapa,
} from "@/themes/agua-y-saneamiento/capture-forms";
import {
  computeAguaMaquetaDias,
  DIAS_DEPENDENCIA_FIELDS,
} from "@/themes/agua-y-saneamiento/maqueta-dias";

const THEME_ID = "agua-y-saneamiento";
const ALTA_CAPA = "Alta / orden";

function opOf(r: RecordRow): string {
  return String(r.orden_de_proveeduria || r.clave_seguimiento || "").trim();
}

function capaOf(r: RecordRow): string {
  return normalizeAguaCapa(String(r.tipo_registro || r.capa || ""));
}

function dateKey(r: RecordRow, fields: string[]): string {
  for (const f of fields) {
    const v = String(r[f] || "").trim();
    if (v) return v.slice(0, 10);
  }
  return "0000-00-00";
}

function latestOf(rows: RecordRow[], dateFields: string[]): RecordRow | null {
  if (!rows.length) return null;
  return rows
    .slice()
    .sort((a, b) => {
      const da = dateKey(a, dateFields);
      const db = dateKey(b, dateFields);
      if (da !== db) return db.localeCompare(da); // más reciente primero
      return String(b.id).localeCompare(String(a.id));
    })[0]!;
}

function put(
  patch: Record<string, unknown>,
  key: string,
  value: unknown,
) {
  if (value === undefined || value === null) return;
  const s = String(value).trim();
  if (s === "") return;
  patch[key] = value;
}

/**
 * Tras un append (o carga), actualiza Alta/Maqueta de esa OP con lo último.
 */
export async function syncAguaMaquetaFromLatest(params: {
  op: string;
  userId?: string;
  sourceCapa?: string;
}): Promise<{ ok: boolean; altaId?: string; changedFields?: string[] }> {
  const op = params.op.trim();
  if (!op) return { ok: false };

  const theme = getTheme(THEME_ID);
  if (!theme) return { ok: false };

  const opFilter = sql`(
    lower(trim(coalesce(${records.payload}->>'orden_de_proveeduria',''))) = ${op.toLowerCase()}
    OR lower(trim(coalesce(${records.payload}->>'clave_seguimiento',''))) = ${op.toLowerCase()}
  )`;

  const rowsDb = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.themeId, THEME_ID),
        isNull(records.deletedAt),
        opFilter,
      ),
    )
    .orderBy(desc(records.updatedAt));

  const rows = rowsDb.map(dbToRow);
  if (!rows.length) return { ok: false };

  const altaVariants = new Set(aguaCapaLookupVariants(ALTA_CAPA));
  const alta = rows.find((r) => altaVariants.has(capaOf(r)) || altaVariants.has(String(r.tipo_registro || r.capa || "").trim()));
  if (!alta?.id) return { ok: false };

  const byCapa = (capa: string) =>
    rows.filter((r) => capaOf(r) === capa || String(r.tipo_registro || r.capa || "").trim() === capa);

  const bitacora = latestOf(byCapa("Bitácora estado"), [
    "fecha_estado",
    "fecha",
  ]);
  const estruct = latestOf(byCapa("Bitácora estructuración"), [
    "fecha_estado",
    "fecha_de_asignacion",
    "fecha",
  ]);
  const pago = latestOf(byCapa("Pago / desembolso"), [
    "fecha_de_pago",
    "fecha",
  ]);
  const modif = latestOf(byCapa("Modificación contractual"), [
    "fecha",
    "fecha_estado",
  ]);

  const patch: Record<string, unknown> = {};

  // BO–BV · último evento bitácora
  if (bitacora) {
    put(patch, "estado_actual", bitacora.estado);
    put(patch, "proceso_actual", bitacora.proceso);
    put(patch, "dependencia", bitacora.dependencia);
    put(patch, "comentario_ult_seguimiento_a_supervision", bitacora.comentario);
    put(patch, "fecha_ultimo_seguimiento", bitacora.fecha_estado || bitacora.fecha);
    put(patch, "etapa", bitacora.estado_macro);
    // Columna de negocio del registro Alta: refleja el estado vigente
    put(patch, "estado", bitacora.estado);
  }

  // AK, AM–AR · última estructuración
  if (estruct) {
    put(patch, "estado_de_ejecucion", estruct.estado_de_ejecucion || estruct.estado);
    put(patch, "fecha_de_asignacion", estruct.fecha_de_asignacion);
    put(patch, "fecha_inicio_orden", estruct.fecha_inicio_orden);
    put(patch, "fecha_fin_orden", estruct.fecha_fin_orden);
    put(patch, "ejecucion", estruct.ejecucion);
    put(patch, "expediente", estruct.expediente);
    put(patch, "fecha_radicacion_expediente", estruct.fecha_radicacion_expediente);
    put(
      patch,
      "responsable_apoyo_a_la_supervision",
      estruct.responsable_apoyo_a_la_supervision,
    );
  }

  // BI–BN · último pago
  if (pago) {
    put(patch, "sd", pago.sd_solicitud_de_desembolso || pago.sd);
    put(patch, "voucher", pago.voucher);
    put(patch, "comprobante_de_egreso", pago.comprobante_de_egreso);
    put(
      patch,
      "valor_pagado",
      pago.valor_pagado_total_con_impuestos ||
        pago.valor_pagado_sin_impuestos ||
        pago.valor_pagado,
    );
    put(patch, "fecha_de_pago", pago.fecha_de_pago);
    put(patch, "n_ratificacion", pago.n_ratificacion);
    put(patch, "op_paga", pago.op_paga);
  }

  // T/U vigentes desde última modificación (si trae esos campos)
  if (modif) {
    put(patch, "forma_de_pago", modif.forma_de_pago);
    put(patch, "plazo_de_ejecucion_dias", modif.plazo_de_ejecucion_dias);
  }

  // AY–BH, BT · días calculados desde historial Bitácora (no se digitan)
  const bitacoraAll = byCapa("Bitácora estado");
  const fechaAsignacion =
    patch.fecha_de_asignacion ??
    alta.fecha_de_asignacion ??
    estruct?.fecha_de_asignacion;
  const fechaPago =
    patch.fecha_de_pago ?? alta.fecha_de_pago ?? pago?.fecha_de_pago;
  const dias = computeAguaMaquetaDias({
    events: bitacoraAll,
    fechaAsignacion,
    fechaPago,
  });
  if (dias) {
    for (const field of DIAS_DEPENDENCIA_FIELDS) {
      patch[field] = dias.porDependencia[field];
    }
    if (dias.dias_totales_en_la_linea !== undefined) {
      patch.dias_totales_en_la_linea = dias.dias_totales_en_la_linea;
    }
    if (dias.dias_en_gestion_de_pagos !== undefined) {
      patch.dias_en_gestion_de_pagos = dias.dias_en_gestion_de_pagos;
    }
    if (dias.dias_desde_ult_gestion !== undefined) {
      patch.dias_desde_ult_gestion = dias.dias_desde_ult_gestion;
    }
  }

  if (!Object.keys(patch).length) return { ok: true, altaId: String(alta.id) };

  const source = params.sourceCapa
    ? normalizeAguaCapa(params.sourceCapa) || params.sourceCapa
    : "tablas actualizables";

  try {
    const result = await patchRecordWithVersion({
      theme,
      recordId: String(alta.id),
      patch,
      userId: params.userId,
      reason: `sync Maqueta ← último vigente (${source})`,
    });
    return {
      ok: true,
      altaId: String(alta.id),
      changedFields: result.changedFields,
    };
  } catch (err) {
    console.error("[maqueta-sync]", err);
    return { ok: false, altaId: String(alta.id) };
  }
}
