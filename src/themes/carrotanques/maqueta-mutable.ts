/**
 * Campos mutables de la maqueta Carrotanques (columnas K–L).
 * B–J son inmutables tras el alta; M–P/T–Z y Q–R–S los escribe el sync.
 */
export const CARRO_MAQUETA_MUTABLE_FIELDS = [
  "otras_categorizaciones",
  "clasificacion_propiedad",
] as const;

export type CarroMaquetaMutableField =
  (typeof CARRO_MAQUETA_MUTABLE_FIELDS)[number];

/** B–J · ingreso inicial: no se reescriben en PATCH de categorías. */
export const CARRO_MAQUETA_IMMUTABLE_FIELDS = [
  "placa",
  "placa_ungrd",
  "clase",
  "marca",
  "modelo_ref",
  "serial",
  "modelo",
  "ano_compra",
  "capacidad_lt",
] as const;

/**
 * Filtra un PATCH a maqueta: solo K–L (y claves de seguimiento inocuas).
 * Impide que un formulario de categorías pise B–J o columnas de sync.
 */
export function sanitizeCarroMaquetaCategoriasPatch(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const allowed = new Set<string>([
    ...CARRO_MAQUETA_MUTABLE_FIELDS,
    "clave_seguimiento",
    "placa",
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!allowed.has(k)) continue;
    // placa/clave solo identifican; no se usan para “cambiar” la placa del activo
    if (k === "placa" || k === "clave_seguimiento") continue;
    out[k] = v;
  }
  return out;
}
