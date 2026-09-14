/**
 * Cabeceras de plantilla_fic_v3.xlsx → campos canónicos del tema.
 * Se aplica en remap Excel y en prepareTrackingRow (formulario + carga).
 */
function norm(s: string): string {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function filled(v: unknown): boolean {
  return v !== undefined && v !== null && String(v).trim() !== "";
}

/** Canónico → variantes de cabecera en la plantilla consolidada. */
export const FIC_EXCEL_ALIASES: Record<string, string[]> = {
  formato_de_aprobacion_de_la_atencion: [
    "#formato de aprobacion",
    "#formato de aprobación",
    "formato de aprobacion",
    "formato de aprobación",
    "formato_de_aprobacion",
  ],
  acto_administrativo_otorgamiento_del_recurso_2: [
    "acto_administrativo_otorgamiento_del_recurso -2",
    "acto_administrativo_otorgamiento_del_recurso -2-",
    "acto_administrativo_otorgamiento_del_recurso-2",
    "acto administrativo otorgamiento del recurso 2",
  ],
  fecha_acto_administrativo_resolucion_2: [
    "fecha_acto_administrativo_resolucion-2",
    "fecha_acto_administrativo_resolucion -2",
    "fecha acto administrativo resolucion 2",
  ],
  fecha_acto_administrativo_modificacion: [
    "fecha acto administrativo modificacion",
    "fecha acto administrativo modificación",
    "fecha_acto_administrativo_modificacion",
  ],
  valor: ["valor desembolso", "valor_desembolso", "Valor Desemboloso"],
  fecha: ["fecha de desembolso", "fecha_de_desembolso", "Fecha de Desembolso"],
  fecha_de_notificacion: [
    "fecha-(cambiar a fecha denotificacion)",
    "fecha-(cambiar a fecha de notificacion)",
    "fecha de notificacion",
    "fecha_de_notificacion",
  ],
  no_cdp: ["No. Fic", "No. FIC", "numero_fic", "número FIC"],
  tiene_anticipo: ["tiene anticipo", "tiene_anticipo"],
  valor_anticipo: ["valor anticipo", "valor_anticipo"],
};

export function applyFicExcelAliases(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...row };
  const byNorm = new Map<string, unknown>();
  for (const [key, value] of Object.entries(out)) {
    if (!filled(value)) continue;
    const n = norm(key);
    if (n && !byNorm.has(n)) byNorm.set(n, value);
  }

  for (const [canon, aliases] of Object.entries(FIC_EXCEL_ALIASES)) {
    if (filled(out[canon])) continue;
    for (const alias of aliases) {
      if (filled(out[alias])) {
        out[canon] = out[alias];
        break;
      }
      const hit = byNorm.get(norm(alias));
      if (filled(hit)) {
        out[canon] = hit;
        break;
      }
    }
  }

  if (filled(out.tiene_anticipo)) {
    const t = String(out.tiene_anticipo)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toUpperCase();
    if (t === "SI" || t === "S" || t === "YES" || t === "TRUE" || t === "1") {
      out.tiene_anticipo = "SI";
    } else if (t === "NO" || t === "N" || t === "FALSE" || t === "0") {
      out.tiene_anticipo = "NO";
    }
  }
  return out;
}
