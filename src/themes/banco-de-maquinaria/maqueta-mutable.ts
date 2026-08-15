/**
 * Mutabilidad Banco de Maquinaria.
 *
 * Convenio (raíz, como proceso en Puentes):
 *  - Alta única del marco contractual.
 *  - F–I editables en el mismo registro:
 *      F cantidad expectativa · G cantidad entregada ·
 *      H tiempo de ejecución · I fecha acta de inicio
 *
 * Detalle (equipos del convenio):
 *  - Identidad del equipo inmutable tras el alta.
 *  - Operativo (ubicación, encargado, estado máquina…) editable.
 *  - `estado_convenio` lo escribe el sync desde bitácora.
 */
export const BMAQ_CONVENIO_IMMUTABLE_FIELDS = [
  "no_convenio",
  "objeto",
  "departamento",
  "municipio",
  "entidad_receptora",
  "no_cdp",
  "fecha_cdp",
  "no_rc",
  "fecha_de_rc",
  "valor_total",
  "valor_aporte_municipio",
  "valor_aporte_gobernacion",
  "valor_aporte_ungrd",
  "responsable_juridico",
  "responsable_financiero",
  "responsable_tecnico",
  "estado",
] as const;

/** Columnas F–I del Excel CONVENIOS O PROCESOS (editables tras el alta). */
export const BMAQ_CONVENIO_MUTABLE_FIELDS = [
  "cantidad_maquinaria_expectativa",
  "cantidad_maquinaria_entregada",
  "tiempo_de_ejecucion",
  "fecha_acta_de_inicio",
] as const;

/**
 * Orden de la tabla 1 · Alta convenio (campos visibles).
 * Incluye F–I en su posición natural; el avance posterior solo toca F–I.
 */
export const BMAQ_ALTA_CONVENIO_FIELDS = [
  "no_convenio",
  "objeto",
  "departamento",
  "municipio",
  "entidad_receptora",
  "cantidad_maquinaria_expectativa",
  "cantidad_maquinaria_entregada",
  "tiempo_de_ejecucion",
  "fecha_acta_de_inicio",
  "no_cdp",
  "fecha_cdp",
  "no_rc",
  "fecha_de_rc",
  "valor_total",
  "valor_aporte_municipio",
  "valor_aporte_gobernacion",
  "valor_aporte_ungrd",
  "responsable_juridico",
  "responsable_financiero",
  "responsable_tecnico",
  "estado",
  "observaciones",
] as const;

export type BmaqConvenioMutableField =
  (typeof BMAQ_CONVENIO_MUTABLE_FIELDS)[number];

export const BMAQ_MAQUETA_IMMUTABLE_FIELDS = [
  "no_maquina",
  "referencia",
  "nit",
  "empresa",
  "tipo_maquinaria",
  "valor",
  "serial",
  "n_motor",
  "ano_modelo",
  "placa",
  "chasis_camabaja",
  "placa_camabaja",
  "linea",
  "modelo_y_o_referencia",
  "modalidad",
  "no_orden_de_compra",
] as const;

/**
 * Orden de la tabla 2 · Detalle maquinaria (hoja DETALLE).
 * El nº convenio se hereda del lookup (columna V); no se captura a mano.
 * Sin clasificación (D). Sin estado convenio (AB → sync bitácora).
 */
export const BMAQ_ALTA_DETALLE_FIELDS = [
  "no_maquina",
  "referencia",
  "nit",
  "empresa",
  "entidad_receptora",
  "tipo_maquinaria",
  "departamento",
  "valor",
  "serial",
  "n_motor",
  "fecha",
  "fecha_entrega_o_recibo",
  "ano_modelo",
  "placa",
  "chasis_camabaja",
  "placa_camabaja",
  "linea",
  "modelo_y_o_referencia",
  "modalidad",
  "no_orden_de_compra",
  "encargado",
  "cargo_encargad",
  "estado_maquina",
  "observaciones",
] as const;

export const BMAQ_MAQUETA_MUTABLE_FIELDS = [
  "entidad_receptora",
  "departamento",
  "municipio",
  "fecha",
  "fecha_entrega_o_recibo",
  "encargado",
  "cargo_encargad",
  "estado_maquina",
  "observaciones",
] as const;

export type BmaqMaquetaMutableField =
  (typeof BMAQ_MAQUETA_MUTABLE_FIELDS)[number];

export function sanitizeBmaqMaquetaOperativoPatch(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const allowed = new Set<string>([
    ...BMAQ_MAQUETA_MUTABLE_FIELDS,
    "clave_seguimiento",
    "serial",
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!allowed.has(k)) continue;
    if (k === "serial" || k === "clave_seguimiento") continue;
    out[k] = v;
  }
  return out;
}

/** PATCH de avance F–I: no pisa el marco del convenio. */
export function sanitizeBmaqConvenioAvancePatch(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const allowed = new Set<string>([
    ...BMAQ_CONVENIO_MUTABLE_FIELDS,
    "clave_seguimiento",
    "no_convenio",
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!allowed.has(k)) continue;
    if (k === "no_convenio" || k === "clave_seguimiento") continue;
    out[k] = v;
  }
  return out;
}
