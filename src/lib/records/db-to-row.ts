import type { records } from "@/db/schema";
import type { RecordRow } from "@/lib/records/types";

/** Convierte fila PostgreSQL → RecordRow para UI/API. */
export function dbToRow(r: typeof records.$inferSelect): RecordRow {
  const payload = (r.payload || {}) as Record<string, string | number>;
  const row = { ...payload } as Record<string, string | number>;
  row.id = r.id;
  row.departamento = r.departamento || String(payload.departamento || "");
  row.municipio = r.municipio || String(payload.municipio || "");
  row.fecha = String(r.fecha);
  // Preferir estado de negocio del payload (p. ej. convenio) sobre el default de columna.
  const payloadEstado = payload.estado;
  if (
    payloadEstado !== undefined &&
    payloadEstado !== null &&
    String(payloadEstado).trim() !== ""
  ) {
    row.estado = payloadEstado;
  } else {
    row.estado = r.estado;
  }
  row.valor =
    Number(r.valor) ||
    Number(payload.valor ?? payload.valor_total ?? payload.valor_unitario ?? 0) ||
    0;
  // Preservar ID legacy del payload (p. ej. id_puente Excel) sin colisionar con UUID.
  if (payload.id !== undefined && payload.id !== r.id) {
    row.id_legacy = payload.id;
  }
  return row as RecordRow;
}
