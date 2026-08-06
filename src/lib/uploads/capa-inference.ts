/**
 * Inferencia segura de capa / tipo_registro para cargas Excel.
 * Solo rellena campos vacíos; nunca sobrescribe lo que el equipo ya puso.
 */
import type { ThemeConfig } from "@/themes/shared/types";
import {
  normalizeAguaCdp,
  normalizeAguaRc,
  normalizeAguaTipoDeEvento,
} from "@/themes/agua-y-saneamiento/select-options";
import { applyProcesoKeys } from "@/themes/puentes/process-keys";
import {
  inferOrigenAdquisicion,
  procesoSigla,
} from "@/themes/puentes/asset-keys";
import { normalizePuenteCapa } from "@/themes/puentes/capture-forms";

/** Opciones oficiales de capa por tema (alineadas a fields-from-source). */
const THEME_CAPA_HINTS: Record<
  string,
  { pattern: RegExp; capa: string }[]
> = {
  "agua-y-saneamiento": [
    { pattern: /pago|desembolso/i, capa: "Pago / desembolso" },
    { pattern: /cdp|rc\b|cdps/i, capa: "CDPS y RC" },
    { pattern: /estructuracion|estructuración|semana/i, capa: "Bitácora estructuración" },
    { pattern: /lider|variables.?lider|categoriz/i, capa: "Variables líder" },
    { pattern: /bitacora|bitácora/i, capa: "Bitácora estado" },
    // Una sola hoja Excel `modificaciones` (plazo / forma de pago van aquí)
    { pattern: /modific|plazo|forma.?de.?pago/i, capa: "Modificación contractual" },
    { pattern: /control/i, capa: "Control ejecución física" },
    { pattern: /alta|maqueta|orden|general/i, capa: "Alta / orden" },
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
  puentes: [
    { pattern: /estructuracion|estructuración|contratos/i, capa: "Contrato estructuración" },
    { pattern: /bitacora|bitácora/i, capa: "Bitácora estado" },
    { pattern: /base\s*general|inventario|general/i, capa: "Inventario puente" },
  ],
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

  // Compatibilidad import Agua: Maqueta / orden → Alta / orden
  if (theme.id === "agua-y-saneamiento") {
    const normalize = (v: string) => {
      if (/^maqueta\s*\/\s*orden$/i.test(v)) return "Alta / orden";
      if (/^seguimiento\s*operativo$/i.test(v)) return "Bitácora estructuración";
      return v;
    };
    if (out.tipo_registro) out.tipo_registro = normalize(String(out.tipo_registro));
    if (out.capa) out.capa = normalize(String(out.capa));
    // bitacora estructuracion usa "op"
    if (!out.orden_de_proveeduria && out.op) {
      out.orden_de_proveeduria = out.op;
    }
    if (out.tipo_de_evento != null && String(out.tipo_de_evento).trim()) {
      out.tipo_de_evento = normalizeAguaTipoDeEvento(String(out.tipo_de_evento));
    }
    if (out.no_cdp != null && String(out.no_cdp).trim()) {
      out.no_cdp = normalizeAguaCdp(String(out.no_cdp));
    }
    if (out.no_rc != null && String(out.no_rc).trim()) {
      out.no_rc = normalizeAguaRc(String(out.no_rc));
    }
    // ValorOP de maqueta → valor canónico
    if (
      (out.valor === undefined ||
        out.valor === null ||
        out.valor === "" ||
        Number(out.valor) === 0) &&
      (out.valorop != null || out.ValorOP != null)
    ) {
      out.valor = out.valorop ?? out.ValorOP;
    }
  }

  if (theme.id === "puentes") {
    const normalizeCapa = (v: string) => normalizePuenteCapa(v) || v;
    if (out.tipo_registro) {
      out.tipo_registro = normalizeCapa(String(out.tipo_registro));
    }
    if (out.capa) out.capa = normalizeCapa(String(out.capa));
    if (!out.id_puente && (out.ID != null || out.id != null)) {
      out.id_puente = String(out.ID ?? out.id).trim();
    }
    if (
      !out.id_puente &&
      (out.id_unico != null ||
        out["ID UNICO"] != null ||
        out["Id Unico"] != null)
    ) {
      out.id_puente = String(
        out.id_unico ?? out["ID UNICO"] ?? out["Id Unico"],
      ).trim();
    }
    // Excel Base General trae un 2.º «ID UNICO» (código operativo por puente).
    if (!String(out.codigo_operativo || "").trim()) {
      const op =
        out["ID UNICO_1"] ?? out.id_unico_1 ?? out["Id Unico_1"];
      const opText = String(op ?? "").trim();
      const idp = String(out.id_puente || "").trim();
      if (opText && opText !== idp && !/^\d+$/.test(opText)) {
        out.codigo_operativo = opText;
      }
    }
    if (out.id_puente && !out.clave_seguimiento) {
      out.clave_seguimiento = String(out.id_puente).trim();
    }
    const capaPuente = normalizeCapa(
      String(out.capa ?? out.tipo_registro ?? ""),
    );
    /**
     * El contrato solo entra por Estructuración (donde nace) o por Inventario
     * (donde el activo declara de qué proceso proviene). La bitácora nunca
     * origina un contrato: hereda el del puente al que le hace seguimiento.
     * Sí conserva «convenio o cto» como etiqueta de filtro del Excel.
     */
    const puedeDeclararContrato = capaPuente !== "Bitácora estado";

    // Columna Excel «convenio o cto» → convenio_o_cto (filtro de bitácora).
    if (!out.convenio_o_cto) {
      const looseConv = Object.entries(out).find(([k]) => {
        const n = k.trim().toLowerCase().replace(/\s+/g, " ");
        return (
          n === "convenio o cto" ||
          n === "convenio_o_cto" ||
          n === "convenio o contrato"
        );
      });
      if (looseConv && String(looseConv[1] ?? "").trim()) {
        out.convenio_o_cto = looseConv[1];
      }
    }

    if (puedeDeclararContrato) {
      if (!out.contrato_convenio && out.contrato) {
        out.contrato_convenio = out.contrato;
      }
      if (!out.contrato_convenio) {
        const loose = Object.entries(out).find(
          ([k]) => k.trim().toLowerCase() === "contrato",
        );
        if (loose && String(loose[1] ?? "").trim()) {
          out.contrato_convenio = loose[1];
        }
      }
      if (
        !String(out.convenio_o_cto || "").trim() &&
        String(out.contrato_convenio || "").trim()
      ) {
        out.convenio_o_cto = out.contrato_convenio;
      }
    } else {
      // Se descarta el contrato del archivo: la fuente es el inventario.
      // Se conserva convenio_o_cto como etiqueta de seguimiento del Excel.
      const convenioSeguimiento = String(out.convenio_o_cto || "").trim();
      delete out.contrato_convenio;
      delete out.clave_proceso;
      delete out.tipo_vinculo;
      for (const key of Object.keys(out)) {
        if (key.trim().toLowerCase() === "contrato") delete out[key];
      }
      if (convenioSeguimiento) out.convenio_o_cto = convenioSeguimiento;
    }
    if (!out.ubicacion_actual && out.lugar) {
      out.ubicacion_actual = out.lugar;
    }
    if (!out.configuracion && out.segun_configuracion) {
      out.configuracion = out.segun_configuracion;
    }
    if (!out.entidad_receptora && out.ente_receptor) {
      out.entidad_receptora = out.ente_receptor;
    }
    Object.assign(out, applyProcesoKeys(out));

    const contrato = String(out.contrato_convenio || "").trim();
    if (contrato) {
      const tipo = String(out.tipo_vinculo || "").trim() as
        | "contrato"
        | "donacion"
        | "otro";
      if (!String(out.origen_adquisicion || "").trim()) {
        out.origen_adquisicion = inferOrigenAdquisicion(contrato, tipo || undefined);
      }
      if (!String(out.proceso_sigla || "").trim()) {
        out.proceso_sigla = procesoSigla(contrato, tipo || undefined);
      }
    }
  }

  const claveRaw =
    out.clave_seguimiento ??
    out.orden_de_proveeduria ??
    out.id_puente ??
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
        "Alta / orden",
        "Modificación contractual",
        "Bitácora estado",
        "Bitácora estructuración",
        "Pago / desembolso",
        "CDPS y RC",
      ],
      tip: "Tablas actualizables (append): modificación, bitácora, pagos, CDPS/RC y bitácora estructuración. Alta es única; la Maqueta consolida el vigente.",
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
      clave: "id_puente (inventario) · clave_proceso (estructuración)",
      capas: [
        "Inventario puente",
        "Bitácora estado",
        "Contrato estructuración",
      ],
      tip: "Alta única por puente; bitácora y estructuración son tablas append. Tras bitácora, el inventario refleja el último estado.",
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
