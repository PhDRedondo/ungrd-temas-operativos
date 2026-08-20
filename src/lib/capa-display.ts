/**
 * Etiquetas legibles de capa / formulario para UI.
 * No cambia el valor guardado en BD (`tipo_registro` / `capa`).
 */

const BY_THEME: Record<string, Record<string, string>> = {
  "agua-y-saneamiento": {
    "Alta / orden": "Registro inicial",
    "Maqueta / orden": "Registro inicial",
    "Variables líder": "Variables del líder",
    "Modificación contractual": "Modificaciones",
    "Bitácora estado": "Bitácora",
    "Bitácora estructuración": "Seguimiento de estructuración",
    "Pago / desembolso": "Pagos",
    "CDPS y RC": "CDP y RC",
    "Control ejecución física": "Control de ejecución",
  },
  carrotanques: {
    "Maqueta / inventario": "Inventario del vehículo",
    "Actualizar categorías": "Categorías del vehículo",
    "Bitácora estado": "Bitácora de estado",
    "Suministro / viajes": "Suministro / viajes",
  },
  "banco-de-maquinaria": {
    "Convenio o proceso": "Convenio o proceso",
    "Maqueta / inventario": "Detalle de maquinaria",
    "Bitácora convenio": "Bitácora del convenio",
    "Entrega a beneficiario": "Entrega a beneficiario",
  },
  puentes: {
    "Contrato estructuración": "Contrato / estructuración",
    "Inventario puente": "Inventario del puente",
    "Bitácora estado": "Bitácora del puente",
  },
  "subsidios-de-arriendos": {
    "Consolidado / envío": "Consolidado de envío",
  },
};

/** Nombre amigable de una capa interna. */
export function displayCapaLabel(themeId: string, capa: string): string {
  const raw = String(capa || "").trim();
  if (!raw) return "Sin tipo";
  return BY_THEME[themeId]?.[raw] || raw;
}

/**
 * Título del paso de captura (sidebar).
 * Prioriza el label del formulario; evita kickers tipo Actualizar/Eventos.
 */
export function displayFormStepTitle(
  themeId: string,
  form: { capa: string; label: string },
): string {
  let cleaned = String(form.label || "")
    .replace(/^\d+\s*·\s*/, "")
    .trim();
  if (/^Actualizar categor/i.test(cleaned)) {
    return "Categorías del vehículo";
  }
  if (/^(Actualizar|Eventos|Nuevo)$/i.test(cleaned)) {
    return displayCapaLabel(themeId, form.capa);
  }
  if (/^Actualizar\s+/i.test(cleaned)) {
    cleaned = cleaned.replace(/^Actualizar\s+/i, "");
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  if (!cleaned || cleaned === form.capa) {
    return displayCapaLabel(themeId, form.capa);
  }
  return cleaned;
}
