/**
 * Estados de legalización FIC (AppSheet CONTROL FIC + Excel Seguimiento_FIC).
 * Aliases toleran variantes del Excel y del form AppSheet.
 */
export const ESTADO_LEGALIZACION_OPCIONES = [
  "LEGALIZADO 100%",
  "LEGALIZADO",
  "LEGALIZADO PARCIALMENTE",
  "EN EJECUCIÓN",
  "POR LEGALIZAR",
  "SIN LEGALIZAR",
  "EN PROCESO",
  "PENDIENTE",
  "PRÓRROGA",
  "VENCIDO",
  "CIERRE",
  "REINTEGRO",
  "ANULADO",
] as const;

export const ESTADO_LEGALIZACION_ALIASES: Record<string, string> = {
  "legalizado 100%": "LEGALIZADO 100%",
  "legalizado 100": "LEGALIZADO 100%",
  legalizado: "LEGALIZADO",
  "legalizado parcialmente": "LEGALIZADO PARCIALMENTE",
  "en ejecución": "EN EJECUCIÓN",
  "en ejecucion": "EN EJECUCIÓN",
  ejecucion: "EN EJECUCIÓN",
  ejecución: "EN EJECUCIÓN",
  "por legalizar": "POR LEGALIZAR",
  "sin legalizar": "SIN LEGALIZAR",
  "en proceso": "EN PROCESO",
  pendiente: "PENDIENTE",
  prorroga: "PRÓRROGA",
  prórroga: "PRÓRROGA",
  "con prorroga": "PRÓRROGA",
  "con prórroga": "PRÓRROGA",
  vencido: "VENCIDO",
  vencida: "VENCIDO",
  cierre: "CIERRE",
  reintegro: "REINTEGRO",
  anulado: "ANULADO",
};

export function canonicalEstadoLegalizacion(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const hit = ESTADO_LEGALIZACION_OPCIONES.find(
    (o) => o.toLowerCase() === s.toLowerCase(),
  );
  if (hit) return hit;
  const alias = ESTADO_LEGALIZACION_ALIASES[s.toLowerCase()];
  return alias || s;
}

/** Tipos de evento frecuentes en transferencias FIC (texto libre + sugerencias). */
export const TIPO_EVENTO_SUGERIDOS = [
  "Inundación",
  "Avalancha",
  "Vendaval",
  "Sequía",
  "Sismo",
  "Deslizamiento",
  "Otro",
] as const;
