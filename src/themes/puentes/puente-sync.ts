/**
 * Sincroniza Inventario puente con el último evento de Bitácora estado.
 */
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { records } from "@/db/schema";
import type { RecordRow } from "@/lib/records/types";
import { dbToRow } from "@/lib/records/db-to-row";
import { patchRecordWithVersion } from "@/lib/records/versions";
import { getTheme } from "@/themes";
import {
  normalizePuenteCapa,
  puenteCapaLookupVariants,
} from "@/themes/puentes/capture-forms";

const THEME_ID = "puentes";
const INVENTARIO_CAPA = "Inventario puente";

function idPuenteOf(r: RecordRow): string {
  return String(
    r.id_puente || r.id_legacy || r.clave_seguimiento || "",
  ).trim();
}

function capaOf(r: RecordRow): string {
  return normalizePuenteCapa(String(r.tipo_registro || r.capa || ""));
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
      if (da !== db) return db.localeCompare(da);
      return String(b.id).localeCompare(String(a.id));
    })[0]!;
}

function put(patch: Record<string, unknown>, key: string, value: unknown) {
  if (value === undefined || value === null) return;
  const s = String(value).trim();
  if (s === "") return;
  patch[key] = value;
}

export async function syncPuenteInventarioFromLatest(params: {
  idPuente: string;
  userId?: string;
  sourceCapa?: string;
}): Promise<{ ok: boolean; changedFields?: string[] }> {
  const idPuente = params.idPuente.trim();
  if (!idPuente) return { ok: false };

  const variants = puenteCapaLookupVariants(INVENTARIO_CAPA);
  const invCapaFilter = sql`(
    coalesce(${records.payload}->>'tipo_registro','') IN (${sql.join(
      variants.map((v) => sql`${v}`),
      sql`, `,
    )})
    OR coalesce(${records.payload}->>'capa','') IN (${sql.join(
      variants.map((v) => sql`${v}`),
      sql`, `,
    )})
  )`;

  const idFilter = sql`(
    trim(coalesce(${records.payload}->>'id_puente','')) = ${idPuente}
    OR trim(coalesce(${records.payload}->>'id','')) = ${idPuente}
    OR trim(coalesce(${records.payload}->>'clave_seguimiento','')) = ${idPuente}
  )`;

  const [inventarioRow] = await db
    .select()
    .from(records)
    .where(
      and(
        eq(records.themeId, THEME_ID),
        isNull(records.deletedAt),
        invCapaFilter,
        idFilter,
      ),
    )
    .orderBy(desc(records.updatedAt))
    .limit(1);

  if (!inventarioRow) return { ok: false };

  const allRows = await db
    .select()
    .from(records)
    .where(
      and(eq(records.themeId, THEME_ID), isNull(records.deletedAt), idFilter),
    );

  const rows = allRows.map(dbToRow);
  const byCapa = (capa: string) =>
    rows.filter((r) => capaOf(r) === normalizePuenteCapa(capa));

  const bitacora = latestOf(byCapa("Bitácora estado"), [
    "fecha_inicio",
    "fecha_corte_reporte",
    "fecha",
  ]);

  const patch: Record<string, unknown> = {};
  if (bitacora) {
    put(patch, "ubicacion_actual", bitacora.ubicacion_actual || bitacora.lugar);
    put(patch, "estado_puente", bitacora.estado_puente || bitacora.estado);
    put(patch, "situacion_prestamo", bitacora.situacion_prestamo);
    put(patch, "entidad_receptora", bitacora.ente_receptor || bitacora.entidad_receptora);
    put(patch, "region", bitacora.region);
    put(patch, "departamento", bitacora.departamento);
    put(patch, "municipio", bitacora.municipio);
    put(patch, "fecha_desde_ultimo_estado", bitacora.fecha_inicio || bitacora.fecha);
    put(patch, "estado", bitacora.estado_puente || bitacora.estado);
  }

  if (!Object.keys(patch).length) return { ok: true, changedFields: [] };

  const theme = getTheme(THEME_ID);
  if (!theme) return { ok: false };

  try {
    const result = await patchRecordWithVersion({
      theme,
      recordId: inventarioRow.id,
      patch,
      userId: params.userId,
      reason: `sync inventario ← ${params.sourceCapa || "bitácora"}`,
    });
    return { ok: true, changedFields: result.changedFields };
  } catch (err) {
    console.error("[puente-sync]", err);
    return { ok: false };
  }
}
