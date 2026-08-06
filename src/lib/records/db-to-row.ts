import type { records } from "@/db/schema";
import type { RecordRow } from "@/lib/records/types";

/** Convierte fila PostgreSQL → RecordRow para UI/API. */
export function dbToRow(r: typeof records.$inferSelect): RecordRow {
  const payload = (r.payload || {}) as Record<string, string | number>;
  const row = { ...payload } as Record<string, string | number>;
  row.id = r.id;
  row.departamento = r.departamento;
  row.municipio = r.municipio;
  row.fecha = String(r.fecha);
  row.estado = r.estado;
  row.valor = Number(r.valor);
  // Preservar ID legacy del payload (p. ej. id_puente Excel) sin colisionar con UUID.
  if (payload.id !== undefined && payload.id !== r.id) {
    row.id_legacy = payload.id;
  }
  return row as RecordRow;
}
