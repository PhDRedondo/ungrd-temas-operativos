/**
 * Sincroniza Maqueta / inventario con:
 *  - último evento de Bitácora → M–P y T–Z
 *  - sumatoria de Suministro DEF → Q–R–S
 *
 * B–J (alta) y K–L (categorías editables) no se tocan aquí.
 */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { records } from "@/db/schema";
import type { RecordRow } from "@/lib/records/types";
import { dbToRow } from "@/lib/records/db-to-row";
import { patchRecordWithVersion } from "@/lib/records/versions";
import { getTheme } from "@/themes";
import {
  carroCapaLookupVariants,
  normalizeCarroCapa,
} from "@/themes/carrotanques/capture-forms";

const THEME_ID = "carrotanques";
const MAQUETA_CAPA = "Maqueta / inventario";

function placaOf(r: RecordRow): string {
  return String(r.placa || r.clave_seguimiento || "").trim();
}

function capaOf(r: RecordRow): string {
  return normalizeCarroCapa(String(r.tipo_registro || r.capa || ""));
}

function dateKey(r: RecordRow, fields: string[]): string {
  for (const f of fields) {
    const v = String(r[f] || "").trim();
    if (v) return v.slice(0, 10);
  }
  return "0000-00-00";
}

/** Preferir valor de payload si la columna base lo sobrescribió (p. ej. estado). */
function payloadVal(
  r: RecordRow,
  ...keys: string[]
): string | number | undefined {
  const raw = r as Record<string, unknown>;
  for (const k of keys) {
    const v = raw[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v as string | number;
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
      // Desempate: más reciente por id (insert append)
      return String(b.id).localeCompare(String(a.id));
    })[0]!;
}

function put(patch: Record<string, unknown>, key: string, value: unknown) {
  if (value === undefined || value === null) return;
  const s = String(value).trim();
  if (s === "") return;
  // No pisar maqueta con placeholders vacíos de Excel
  if (/^(sin registro|no registra|n\/?a|-)$/i.test(s)) return;
  patch[key] = typeof value === "number" ? value : s;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Suma litros / personas / comunidades de todos los suministros de la placa. */
export function sumSuministroByPlaca(rows: RecordRow[]): {
  lt_suministrados: number;
  per_benef: number;
  com_benef: number;
} {
  let lt = 0;
  let per = 0;
  let com = 0;
  for (const r of rows) {
    lt += toNumber(r.litros_suministrados ?? r.lt_suministrados);
    per += toNumber(r.personas_beneficiadas ?? r.per_benef);
    com += toNumber(r.comunidades_beneficiadas ?? r.com_benef);
  }
  return {
    lt_suministrados: lt,
    per_benef: per,
    com_benef: com,
  };
}

export async function syncCarrotanqueMaquetaFromLatest(params: {
  placa: string;
  userId?: string;
  sourceCapa?: string;
}): Promise<{ ok: boolean; changedFields?: string[] }> {
  const placa = params.placa.trim();
  if (!placa) return { ok: false };

  const variants = carroCapaLookupVariants(MAQUETA_CAPA);
  const maquetaCapaFilter = sql`(
    coalesce(${records.payload}->>'tipo_registro','') IN (${sql.join(
      variants.map((v) => sql`${v}`),
      sql`, `,
    )})
    OR coalesce(${records.payload}->>'capa','') IN (${sql.join(
      variants.map((v) => sql`${v}`),
      sql`, `,
    )})
  )`;

  const placaFilter = sql`(
    lower(trim(coalesce(${records.payload}->>'placa',''))) = ${placa.toLowerCase()}
    OR lower(trim(coalesce(${records.payload}->>'clave_seguimiento',''))) = ${placa.toLowerCase()}
  )`;

  const [maquetaRow] = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.themeId, THEME_ID),
        isNull(records.deletedAt),
        maquetaCapaFilter,
        placaFilter,
      ),
    )
    .orderBy(desc(records.updatedAt))
    .limit(1);

  if (!maquetaRow) return { ok: false };

  const allRows = await db
    .select()
    .from(records)
    .where(
      and(eq(records.themeId, THEME_ID), isNull(records.deletedAt), placaFilter),
    );

  const rows = allRows.map(dbToRow);
  const byCapa = (capa: string) =>
    rows.filter((r) => capaOf(r) === normalizeCarroCapa(capa));

  const bitacora = latestOf(byCapa("Bitácora estado"), [
    "fecha_inicio_estado_actual",
    "fech_fin_estado_actual",
    "fecha_corte_del_reporte",
    "fecha_inicio",
    "fecha",
  ]);

  const suministroRows = byCapa("Suministro / viajes");
  const sums = sumSuministroByPlaca(suministroRows);

  const patch: Record<string, unknown> = {};

  /**
   * M–Z de la maqueta (excepto Q–R–S = suma suministro):
   * M ubicación · N depto · O municipio · P región
   * T fecha inicio · U fecha fin · V fecha desde últ. · W entidad
   * X estado · Y situación · Z observaciones
   * ← último evento de Bitácora de esa placa.
   */
  if (bitacora) {
    put(patch, "ubicacion_actual", payloadVal(bitacora, "ubicacion_actual"));
    put(
      patch,
      "departamento",
      payloadVal(bitacora, "departamento"),
    );
    put(patch, "municipio", payloadVal(bitacora, "municipio"));
    put(patch, "region", payloadVal(bitacora, "region"));
    put(
      patch,
      "fecha_inicio_estado_actual",
      payloadVal(
        bitacora,
        "fecha_inicio_estado_actual",
        "fecha_inicio",
        "fecha",
      ),
    );
    put(
      patch,
      "fech_fin_estado_actual",
      payloadVal(bitacora, "fech_fin_estado_actual", "fecha_fin"),
    );
    put(
      patch,
      "fecha_desde_ultm_estado",
      payloadVal(
        bitacora,
        "fecha_corte_del_reporte",
        "fecha_inicio_estado_actual",
        "fecha_inicio",
        "fecha",
      ),
    );
    const ente = payloadVal(
      bitacora,
      "ente_receptor",
      "entidad_receptora",
    );
    put(patch, "entidad_receptora", ente);
    put(patch, "ente_receptor", ente);
    put(patch, "estado", payloadVal(bitacora, "estado"));
    put(
      patch,
      "situacion_de_prestamo",
      payloadVal(bitacora, "situacion_de_prestamo"),
    );
    put(patch, "observaciones", payloadVal(bitacora, "observaciones"));
  }

  // Q–R–S ← acumulado de TODOS los suministros de la placa
  // (aunque no haya filas → 0, para no dejar valores viejos)
  patch.lt_suministrados = sums.lt_suministrados;
  patch.per_benef = sums.per_benef;
  patch.com_benef = sums.com_benef;
  // aliases de lectura en analítica / Excel
  patch.personas_beneficiadas = sums.per_benef;
  patch.comunidades_beneficiadas = sums.com_benef;
  patch.litros_suministrados = sums.lt_suministrados;

  if (!Object.keys(patch).length) return { ok: true, changedFields: [] };

  const theme = getTheme(THEME_ID);
  if (!theme) return { ok: false };

  try {
    const result = await patchRecordWithVersion({
      theme,
      recordId: maquetaRow.id,
      patch,
      userId: params.userId,
      reason: `sync maqueta ← ${params.sourceCapa || "bitácora/suministro"}`,
    });
    return { ok: true, changedFields: result.changedFields };
  } catch (err) {
    console.error("[carrotanques-maqueta-sync]", err);
    return { ok: false };
  }
}

/** Helper para scripts: normaliza placa de cualquier fila. */
export function placaFromRecord(r: RecordRow): string {
  return placaOf(r);
}
