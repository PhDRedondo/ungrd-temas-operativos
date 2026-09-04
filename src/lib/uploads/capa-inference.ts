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
import { normalizeCarroCapa } from "@/themes/carrotanques/capture-forms";
import { normalizeSubsidiosCapa } from "@/themes/subsidios-de-arriendos/capture-forms";
import { normalizeObrasEmergCapa } from "@/themes/obras-de-emergencia/capture-forms";
import { canonicalEstadoObra } from "@/themes/obras-de-emergencia/select-options";
import { normalizeObrasImpCapa } from "@/themes/obras-por-impuestos/capture-forms";
import { canonicalEstadoConvenio } from "@/themes/obras-por-impuestos/select-options";
import {
  ficCapaFromVigencia,
  normalizeFicCapa,
} from "@/themes/fic/capture-forms";
import { canonicalEstadoLegalizacion } from "@/themes/fic/select-options";

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
  "subsidios-de-arriendos": [
    { pattern: /./, capa: "Consolidado / envío" },
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

  if (theme.id === "carrotanques") {
    const normalizeCapa = (v: string) => normalizeCarroCapa(v) || v;
    if (out.tipo_registro) {
      out.tipo_registro = normalizeCapa(String(out.tipo_registro));
    }
    if (out.capa) out.capa = normalizeCapa(String(out.capa));
    const placa = String(out.placa || "").trim();
    const clave = String(out.clave_seguimiento || "").trim();
    if (placa && !clave) out.clave_seguimiento = placa;
    if (clave && !placa) out.placa = clave;
    // Bitácora Excel: Ente receptor → entidad_receptora en maqueta sync
    if (!out.ente_receptor && out.entidad_receptora) {
      out.ente_receptor = out.entidad_receptora;
    }
    if (!out.fech_fin_estado_actual && out.fecha_fin) {
      out.fech_fin_estado_actual = out.fecha_fin;
    }
    if (!out.fecha_inicio_estado_actual && out.fecha_inicio) {
      out.fecha_inicio_estado_actual = out.fecha_inicio;
    }
    // Placeholders de la maqueta vacía → no fallar enum DIVIPOLA / selects
    const blankish = /^(sin\s*registro|no\s*registra|n\/?a|-+|\.)$/i;
    for (const key of [
      "departamento",
      "municipio",
      "region",
      "ubicacion_actual",
      "estado",
      "situacion_de_prestamo",
      "entidad_receptora",
      "observaciones",
      "fecha_inicio_estado_actual",
      "fech_fin_estado_actual",
      "fecha_desde_ultm_estado",
    ]) {
      if (blankish.test(String(out[key] ?? "").trim())) out[key] = "";
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

  if (theme.id === "subsidios-de-arriendos") {
    const normalizeCapa = (v: string) => normalizeSubsidiosCapa(v) || v;
    if (out.tipo_registro) {
      out.tipo_registro = normalizeCapa(String(out.tipo_registro));
    }
    if (out.capa) out.capa = normalizeCapa(String(out.capa));
    if (!out.tipo_registro) out.tipo_registro = "Consolidado / envío";
    if (!out.capa) out.capa = "Consolidado / envío";

    let uuid = String(out.uuid || "").trim();
    if (!uuid) {
      uuid =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-subsidio`;
      out.uuid = uuid;
    }
    const clave = String(out.clave_seguimiento || "").trim();
    if (!clave) out.clave_seguimiento = uuid;
    if (clave && !String(out.uuid || "").trim()) out.uuid = clave;

    if (
      (out.valor === undefined ||
        out.valor === null ||
        out.valor === "" ||
        Number(out.valor) === 0) &&
      out.valor_total_pagado != null &&
      String(out.valor_total_pagado).trim() !== ""
    ) {
      out.valor = out.valor_total_pagado;
    }
    if (!out.fecha && out.fecha_inicio) out.fecha = out.fecha_inicio;
  }

  if (theme.id === "obras-de-emergencia") {
    const normalizeCapa = (v: string) => normalizeObrasEmergCapa(v) || v;
    if (out.tipo_registro) {
      out.tipo_registro = normalizeCapa(String(out.tipo_registro));
    }
    if (out.capa) out.capa = normalizeCapa(String(out.capa));
    if (out.estado != null && String(out.estado).trim()) {
      out.estado = canonicalEstadoObra(out.estado);
    }
    const contrato = String(out.contrato_de_obra || "").trim();
    const op = String(out.orden_de_proveeduria || "").trim();
    const clave = String(out.clave_seguimiento || "").trim();
    // Clave de seguimiento = contrato u OP (lookup y upsert).
    if (!clave && contrato) out.clave_seguimiento = contrato;
    if (!clave && !contrato && op) out.clave_seguimiento = op;
    if (
      out.avance_fisico_ejecutado != null &&
      out.avance_fisico_ejecutado !== "" &&
      (out.porcentaje_avance_fisico_ejecutado == null ||
        out.porcentaje_avance_fisico_ejecutado === "")
    ) {
      out.porcentaje_avance_fisico_ejecutado = out.avance_fisico_ejecutado;
    }
    if (
      out.avance_financiero_ejecutado != null &&
      out.avance_financiero_ejecutado !== "" &&
      (out.porcentaje_avance_financiero_ejecutado == null ||
        out.porcentaje_avance_financiero_ejecutado === "")
    ) {
      out.porcentaje_avance_financiero_ejecutado = out.avance_financiero_ejecutado;
    }
    if (
      (out.avance_fisico_ejecutado == null || out.avance_fisico_ejecutado === "") &&
      out.porcentaje_avance_fisico_ejecutado != null &&
      out.porcentaje_avance_fisico_ejecutado !== ""
    ) {
      out.avance_fisico_ejecutado = out.porcentaje_avance_fisico_ejecutado;
    }
    if (
      (out.avance_financiero_ejecutado == null ||
        out.avance_financiero_ejecutado === "") &&
      out.porcentaje_avance_financiero_ejecutado != null &&
      out.porcentaje_avance_financiero_ejecutado !== ""
    ) {
      out.avance_financiero_ejecutado =
        out.porcentaje_avance_financiero_ejecutado;
    }
  }

  if (theme.id === "obras-por-impuestos") {
    const normalizeCapa = (v: string) => normalizeObrasImpCapa(v) || v;
    if (out.tipo_registro) {
      out.tipo_registro = normalizeCapa(String(out.tipo_registro));
    }
    if (out.capa) out.capa = normalizeCapa(String(out.capa));
    if (!out.tipo_registro) out.tipo_registro = "Convenio obra por impuesto";
    if (!out.capa) out.capa = "Convenio obra por impuesto";
    if (out.estado != null && String(out.estado).trim()) {
      out.estado = canonicalEstadoConvenio(out.estado);
    }
    if (
      out.estado_del_convenio_de_interventoria != null &&
      String(out.estado_del_convenio_de_interventoria).trim()
    ) {
      out.estado_del_convenio_de_interventoria = canonicalEstadoConvenio(
        out.estado_del_convenio_de_interventoria,
      );
    }
    const convenio = String(out.no_convenio || "").trim();
    const clave = String(out.clave_seguimiento || "").trim();
    if (!clave && convenio) out.clave_seguimiento = convenio;
    if (clave && !convenio) out.no_convenio = clave;
    if (
      !out.fecha &&
      (out.fecha_de_inicio_del_convenio || out.fecha_de_activacion)
    ) {
      out.fecha =
        out.fecha_de_inicio_del_convenio || out.fecha_de_activacion;
    }
  }

  if (theme.id === "fic") {
    const fromVig =
      ficCapaFromVigencia(out.vigencia) ||
      ficCapaFromVigencia(out.tipo_registro) ||
      ficCapaFromVigencia(out.capa);
    if (fromVig) {
      out.tipo_registro = fromVig;
      out.capa = fromVig;
      const y = fromVig.match(/(20\d{2})/);
      if (y && !String(out.vigencia || "").trim()) out.vigencia = y[1];
    } else {
      if (out.tipo_registro) {
        out.tipo_registro = normalizeFicCapa(String(out.tipo_registro));
      }
      if (out.capa) out.capa = normalizeFicCapa(String(out.capa));
    }
    if (out.estado != null && String(out.estado).trim()) {
      out.estado = canonicalEstadoLegalizacion(out.estado);
    }
    const cdp = String(out.no_cdp || "").trim();
    const clave = String(out.clave_seguimiento || "").trim();
    if (!clave && cdp) out.clave_seguimiento = cdp;
    if (clave && !cdp) out.no_cdp = clave;

    const toNum = (v: unknown): number | null => {
      if (v === undefined || v === null || v === "") return null;
      const n =
        typeof v === "number" ? v : Number(String(v).replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : null;
    };
    const desembolso = toNum(out.valor);
    const porLegalizar = toNum(out.valor_por_legalizar);
    if (desembolso != null && desembolso !== 0 && porLegalizar != null) {
      const pct = ((desembolso - porLegalizar) / desembolso) * 100;
      out.porcentaje_de_avance_en_el_ejericicio_de_legalizacion =
        Math.round(pct * 100) / 100;
    }

    const plazoInicial = toNum(out.plazo_ejecucion_dias) ?? 0;
    const plazoAdicion = toNum(out.plazo_adicion_dias) ?? 0;
    const hasPlazo =
      toNum(out.plazo_ejecucion_dias) != null ||
      toNum(out.plazo_adicion_dias) != null;
    if (hasPlazo) {
      out.plazo_final_dias = plazoInicial + plazoAdicion;
    }
    const fechaIni = String(out.fecha_inicial_para_legalizacion || "")
      .trim()
      .slice(0, 10);
    const plazoFinal = toNum(out.plazo_final_dias);
    if (fechaIni && plazoFinal != null) {
      const base = new Date(`${fechaIni}T12:00:00`);
      if (!Number.isNaN(base.getTime())) {
        base.setDate(base.getDate() + Math.round(plazoFinal));
        const y = base.getFullYear();
        const m = String(base.getMonth() + 1).padStart(2, "0");
        const d = String(base.getDate()).padStart(2, "0");
        const fechaFinal = `${y}-${m}-${d}`;
        out.fecha_final_para_legalizacion = fechaFinal;
        // Columna Excel de prórroga: misma fecha final (no se pierde el rastro).
        if (plazoAdicion > 0) {
          out.fecha_de_legalizacion_por_prorroga = fechaFinal;
        }
      }
    }

    // Fecha actual del sistema (visor / comparación vs fecha final).
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    out.fecha_actual = `${y}-${m}-${d}`;
  }

  const claveRaw =
    out.clave_seguimiento ??
    out.orden_de_proveeduria ??
    out.contrato_de_obra ??
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
      clave: "Orden de proveeduría (número de la orden)",
      capas: [
        "Registro inicial",
        "Modificaciones",
        "Bitácora",
        "Pagos",
        "CDP y RC",
        "Seguimiento de estructuración",
        "Control de ejecución",
      ],
      tip: "Primero registre la orden. Luego use Bitácora, Pagos u otros formularios buscando esa misma orden.",
    },
    carrotanques: {
      clave: "Placa del vehículo",
      capas: [
        "Inventario del vehículo",
        "Bitácora de estado",
        "Suministro / viajes",
      ],
      tip: "Primero registre la placa. Luego agregue bitácora o suministros buscando esa placa.",
    },
    "banco-de-maquinaria": {
      clave: "Número de convenio · Serial del equipo",
      capas: [
        "Convenio o proceso",
        "Detalle de maquinaria",
        "Bitácora del convenio",
      ],
      tip: "Primero el convenio. Luego detalle de cada máquina. La bitácora actualiza el estado del convenio.",
    },
    "obras-de-emergencia": {
      clave: "Orden de proveeduría o contrato de obra",
      capas: ["Contrato de obra", "Orden de proveeduría"],
      tip: "Cargue contrato y orden como tipos distintos cuando deba cruzarse con Agua.",
    },
    fic: {
      clave: "Número FIC",
      capas: [
        "1 · Transferencia FIC",
        "2 · Seguimiento legalización",
        "3 · Modificación / prórroga",
      ],
      tip: "Primero registre el FIC con plazo y fecha inicial. La prórroga suma días y corre la fecha final; el visor usa plazo/fecha final.",
    },
    puentes: {
      clave: "Identificador del puente · Contrato",
      capas: [
        "Contrato / estructuración",
        "Inventario del puente",
        "Bitácora del puente",
      ],
      tip: "Primero el contrato, luego el inventario del puente y después la bitácora.",
    },
    "declaratoria-de-emergencia": {
      clave: "Número de declaratoria",
      capas: ["Decreto / declaratoria"],
      tip: "Si ya existe, active «Actualizar si el registro ya existe» para no duplicar.",
    },
    "obras-por-impuestos": {
      clave: "Número de convenio / BPIN",
      capas: ["Convenio obra por impuesto"],
      tip: "Primero el convenio. Luego Interventoría o Seguimiento buscando el mismo Nº convenio.",
    },
    "subsidios-de-arriendos": {
      clave: "Número de envío + número de orden",
      capas: ["Consolidado de envío"],
      tip: "Preferible cargar el Excel de envío. El formulario es solo para un registro puntual.",
    },
  };
  return (
    guides[themeId] || {
      clave: "Identificador del registro",
      capas: ["Registro"],
      tip: "Descargue la plantilla del tema, llénela y valídela antes de guardar.",
    }
  );
}
