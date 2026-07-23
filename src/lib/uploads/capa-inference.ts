/**
 * Inferencia segura de capa / tipo_registro para cargas Excel.
 * Solo rellena campos vacíos; nunca sobrescribe lo que el equipo ya puso.
 */
import type { ThemeConfig } from "@/themes/shared/types";

/** Opciones oficiales de capa por tema (alineadas a fields-from-source). */
const THEME_CAPA_HINTS: Record<
  string,
  { pattern: RegExp; capa: string }[]
> = {
  "agua-y-saneamiento": [
    { pattern: /pago|desembolso/i, capa: "Pago / desembolso" },
    { pattern: /bitacora|bitácora|seguimiento/i, capa: "Bitácora estado" },
    { pattern: /modific/i, capa: "Modificación contractual" },
    { pattern: /control/i, capa: "Control ejecución física" },
    { pattern: /maqueta|orden|general/i, capa: "Maqueta / orden" },
  ],
  carrotanques: [
    { pattern: /suministro|viaje/i, capa: "Suministro / viajes" },
    { pattern: /bitacora|bitácora|seguimiento/i, capa: "Bitácora estado" },
    { pattern: /maqueta|inventario/i, capa: "Maqueta / inventario" },
  ],
  "banco-de-maquinaria": [
    { pattern: /entrega/i, capa: "Entrega a beneficiario" },
    { pattern: /bitacora|bitácora|seguimiento/i, capa: "Bitácora convenio" },
    { pattern: /convenio|proceso/i, capa: "Convenio o proceso" },
    { pattern: /maqueta|inventario|detalle/i, capa: "Maqueta / inventario" },
  ],
  "obras-de-emergencia": [
    { pattern: /o\.?\s*p\.?|orden|proveedur/i, capa: "Orden de proveeduría" },
    { pattern: /contrato/i, capa: "Contrato de obra" },
  ],
  fic: [
    // vigencia por año en el hint
  ],
  puentes: [{ pattern: /./, capa: "Inventario puente" }],
  "declaratoria-de-emergencia": [
    { pattern: /./, capa: "Decreto / declaratoria" },
  ],
  "obras-por-impuestos": [
    { pattern: /./, capa: "Convenio obra por impuesto" },
  ],
};

function capaOptions(theme: ThemeConfig): string[] {
  const field =
    theme.fields.find((f) => f.name === "tipo_registro") ||
    theme.fields.find((f) => f.name === "capa");
  return field?.options || [];
}

function pickClosestOption(candidate: string, options: string[]): string | null {
  if (!candidate || !options.length) return null;
  const exact = options.find((o) => o === candidate);
  if (exact) return exact;
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const n = norm(candidate);
  const fuzzy = options.find(
    (o) => norm(o) === n || norm(o).includes(n) || n.includes(norm(o)),
  );
  return fuzzy || null;
}

/** Infere capa desde nombre de archivo / hoja / texto libre. */
export function inferCapaFromHint(
  themeId: string,
  hint: string,
): string | null {
  const h = String(hint || "").trim();
  if (!h) return null;

  if (themeId === "fic") {
    const y = h.match(/(20\d{2})/);
    if (y) return `Transferencia FIC ${y[1]}`;
  }

  const rules = THEME_CAPA_HINTS[themeId];
  if (!rules) return null;
  for (const r of rules) {
    if (r.pattern.test(h)) return r.capa;
  }
  return null;
}

/** Quita sufijos de evento: "SMD-1 / pago 1" → "SMD-1" */
export function cleanClaveSeguimiento(raw: unknown): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  return s.split("/")[0]!.trim().replace(/\s+/g, " ");
}

/**
 * Prepara fila antes de validar:
 * - sincroniza tipo_registro ↔ capa si uno está vacío
 * - infiere capa desde hint solo si ambos están vacíos
 * - limpia clave_seguimiento (base sin "/ …")
 */
export function prepareTrackingRow(
  theme: ThemeConfig,
  row: Record<string, unknown>,
  opts?: { hint?: string },
): Record<string, unknown> {
  const out = { ...row };
  const options = capaOptions(theme);
  const hasTracking = options.length > 0 || theme.fields.some(
    (f) => f.name === "clave_seguimiento",
  );
  if (!hasTracking) return out;

  let tipo = String(out.tipo_registro ?? "").trim();
  let capa = String(out.capa ?? "").trim();

  if (!tipo && capa) tipo = capa;
  if (!capa && tipo) capa = tipo;

  if (!tipo && !capa && opts?.hint) {
    const inferred = inferCapaFromHint(theme.id, opts.hint);
    const matched = inferred ? pickClosestOption(inferred, options) : null;
    if (matched) {
      tipo = matched;
      capa = matched;
    } else if (inferred && !options.length) {
      tipo = inferred;
      capa = inferred;
    }
  }

  // Si el valor no está en el enum, intentar acercarlo (sin inventar otro)
  if (tipo && options.length) {
    const m = pickClosestOption(tipo, options);
    if (m) tipo = m;
  }
  if (capa && options.length) {
    const m = pickClosestOption(capa, options);
    if (m) capa = m;
  }

  // Mantener sincronizados
  if (tipo && !capa) capa = tipo;
  if (capa && !tipo) tipo = capa;
  if (tipo && capa && tipo !== capa) {
    // Preferir tipo_registro como fuente de verdad
    capa = tipo;
  }

  if (tipo) out.tipo_registro = tipo;
  if (capa) out.capa = capa;

  const claveRaw =
    out.clave_seguimiento ??
    out.orden_de_proveeduria ??
    out.placa ??
    out.serial ??
    out.no_cdp ??
    out.no_declaratoria ??
    out.no_convenio;
  const cleaned = cleanClaveSeguimiento(claveRaw);
  if (cleaned) {
    out.clave_seguimiento = cleaned;
  }

  return out;
}

/** Texto corto de guía operativa por tema (para UI). */
export function feedingGuideForTheme(themeId: string): {
  clave: string;
  capas: string[];
  tip: string;
} {
  const guides: Record<
    string,
    { clave: string; capas: string[]; tip: string }
  > = {
    "agua-y-saneamiento": {
      clave: "Orden de proveeduría (OP)",
      capas: [
        "Maqueta / orden",
        "Bitácora estado",
        "Pago / desembolso",
        "Control ejecución física",
        "Modificación contractual",
      ],
      tip: "Una fila por OP+capa. Actualice la maqueta semanalmente; agregue bitácoras como eventos nuevos o con upsert de la misma capa.",
    },
    carrotanques: {
      clave: "Placa",
      capas: ["Maqueta / inventario", "Bitácora estado", "Suministro / viajes"],
      tip: "La maqueta es el inventario del vehículo; la bitácora registra cambios de estado, póliza o ubicación.",
    },
    "banco-de-maquinaria": {
      clave: "Serial / Nº máquina / convenio",
      capas: [
        "Maqueta / inventario",
        "Convenio o proceso",
        "Bitácora convenio",
        "Entrega a beneficiario",
      ],
      tip: "No mezcle maqueta y bitácora en la misma fila: use la misma clave y cambie solo la capa.",
    },
    "obras-de-emergencia": {
      clave: "OP o contrato de obra",
      capas: ["Contrato de obra", "Orden de proveeduría"],
      tip: "Cargue contrato y OP como capas distintas con la misma clave cuando aplique el cruce con Agua.",
    },
    fic: {
      clave: "No. CDP",
      capas: ["Transferencia FIC (por vigencia/año)"],
      tip: "Una capa por vigencia. Use upsert para actualizar el mismo CDP+año sin duplicar.",
    },
    puentes: {
      clave: "Id / identificador del puente",
      capas: ["Inventario puente"],
      tip: "Base de inventario: actualice con upsert sobre la misma clave.",
    },
    "declaratoria-de-emergencia": {
      clave: "Nº declaratoria",
      capas: ["Decreto / declaratoria"],
      tip: "Actualice estado y retorno a normalidad sobre la misma clave (upsert).",
    },
    "obras-por-impuestos": {
      clave: "Nº convenio / BPIN",
      capas: ["Convenio obra por impuesto"],
      tip: "Una fila por convenio; use upsert para avances y vencimientos.",
    },
  };
  return (
    guides[themeId] || {
      clave: "clave_seguimiento",
      capas: ["Según tipo_registro del tema"],
      tip: "Complete tipo_registro/capa y la clave antes de cargar.",
    }
  );
}
