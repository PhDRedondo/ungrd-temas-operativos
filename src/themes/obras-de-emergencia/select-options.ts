/**
 * Opciones de captura — alineadas al tablero obras_emergencia (zip SMD)
 * y a valores ya usados en Excel oficiales.
 */
export const ESTADO_OBRA_OPCIONES = [
  "Ejecución",
  "Terminado",
  "Suspendido",
  "Preparativo",
  "Modificación",
  "Estructuración",
  "Programado",
  "En ejecución",
  "Finalizado",
] as const;

/** Alias zip (minúsculas) → etiqueta canónica en captura. */
export const ESTADO_OBRA_ALIASES: Record<string, string> = {
  ejecución: "Ejecución",
  ejecucion: "Ejecución",
  "en ejecución": "En ejecución",
  "en ejecucion": "En ejecución",
  terminado: "Terminado",
  finalizado: "Finalizado",
  suspendido: "Suspendido",
  preparativo: "Preparativo",
  modificacion: "Modificación",
  modificación: "Modificación",
  estructuracion: "Estructuración",
  estructuración: "Estructuración",
  programado: "Programado",
};

export function canonicalEstadoObra(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const hit = ESTADO_OBRA_OPCIONES.find(
    (o) => o.toLowerCase() === s.toLowerCase(),
  );
  if (hit) return hit;
  const alias = ESTADO_OBRA_ALIASES[s.toLowerCase()];
  return alias || s;
}
