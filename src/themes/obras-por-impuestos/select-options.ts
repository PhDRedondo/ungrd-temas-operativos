/**
 * Estados de convenio — obras por impuestos.
 * Incluye alias del Excel ArcGIS y del tablero SMD.
 */
export const ESTADO_CONVENIO_OPCIONES = [
  "Ejecución",
  "En ejecución",
  "Terminado",
  "Finalizado",
  "Suspendido",
  "Liquidado",
  "En liquidación",
  "Estructuración",
  "Programado",
  "Preparativo",
] as const;

export const ESTADO_CONVENIO_ALIASES: Record<string, string> = {
  ejecución: "Ejecución",
  ejecucion: "Ejecución",
  "en ejecución": "En ejecución",
  "en ejecucion": "En ejecución",
  terminado: "Terminado",
  finalizado: "Finalizado",
  suspendido: "Suspendido",
  liquidado: "Liquidado",
  "en liquidación": "En liquidación",
  "en liquidacion": "En liquidación",
  estructuracion: "Estructuración",
  estructuración: "Estructuración",
  programado: "Programado",
  preparativo: "Preparativo",
};

export function canonicalEstadoConvenio(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const hit = ESTADO_CONVENIO_OPCIONES.find(
    (o) => o.toLowerCase() === s.toLowerCase(),
  );
  if (hit) return hit;
  const alias = ESTADO_CONVENIO_ALIASES[s.toLowerCase()];
  return alias || s;
}
