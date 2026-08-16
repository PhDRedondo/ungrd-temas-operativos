/**
 * Formularios operativos Agua y Saneamiento.
 * La Maqueta (General) es la matriz consolidada.
 *
 * Tablas actualizables (append / historial) — alimentan la maqueta:
 *   1. Modificación  (hoja Excel `modificaciones`)
 *   2. Bitácora
 *   3. Pagos
 *   4. CDPS y RC
 *   5. Bitácora estructuración
 */
import type { CaptureFormConfig } from "../shared";

/** Catálogo oficial de capas (v5). */
export const AGUA_CAPAS = [
  "Alta / orden",
  "Variables líder",
  "Modificación contractual",
  "Bitácora estado",
  "Bitácora estructuración",
  "Pago / desembolso",
  "CDPS y RC",
  "Control ejecución física",
] as const;

export type AguaCapa = (typeof AGUA_CAPAS)[number];

/** Capas que siempre agregan historial (tablas actualizables). */
export const AGUA_TABLAS_ACTUALIZABLES: AguaCapa[] = [
  "Modificación contractual",
  "Bitácora estado",
  "Pago / desembolso",
  "CDPS y RC",
  "Bitácora estructuración",
];

/** Alias de import Excel / UI legacy → capa canónica. */
export const AGUA_CAPA_ALIASES: Record<string, AguaCapa> = {
  "Maqueta / orden": "Alta / orden",
  "maqueta / orden": "Alta / orden",
  "Seguimiento operativo": "Bitácora estructuración",
  // Antes había un form aparte; en Excel solo existe hoja `modificaciones`
  "Modificación plazo-forma pago": "Modificación contractual",
  "modificación plazo-forma pago": "Modificación contractual",
  "Modificación plazo / forma de pago": "Modificación contractual",
  modificaciones: "Modificación contractual",
  Modificaciones: "Modificación contractual",
};

/** Capas oficiales visibles en UI (solo Agua; sin legacy). */
export const AGUA_CAPAS_UI: AguaCapa[] = [...AGUA_CAPAS];

/** Normaliza capa legacy → canónica. */
export function normalizeAguaCapa(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const alias = AGUA_CAPA_ALIASES[s] || AGUA_CAPA_ALIASES[s.toLowerCase()];
  if (alias) return alias;
  if ((AGUA_CAPAS as readonly string[]).includes(s)) return s;
  return s;
}

/** ¿Es una capa oficial de Agua? */
export function isAguaCapaOficial(raw: string): boolean {
  const n = normalizeAguaCapa(raw);
  return (AGUA_CAPAS as readonly string[]).includes(n);
}

/**
 * Variantes de capa a incluir en búsqueda (Excel legacy ↔ UI canónica).
 * Ej.: buscar «Alta / orden» también encuentra «Maqueta / orden».
 */
export function aguaCapaLookupVariants(capa: string): string[] {
  const raw = String(capa || "").trim();
  const canon = normalizeAguaCapa(raw) || raw;
  const out = new Set<string>();
  if (raw) out.add(raw);
  if (canon) out.add(canon);
  for (const [alias, target] of Object.entries(AGUA_CAPA_ALIASES)) {
    if (target === canon || normalizeAguaCapa(alias) === canon) {
      out.add(alias);
      out.add(target);
    }
  }
  if (canon === "Alta / orden") {
    out.add("Maqueta / orden");
    out.add("Alta / orden");
  }
  if (canon === "Bitácora estructuración") {
    out.add("Seguimiento operativo");
    out.add("Bitácora estructuración");
  }
  if (canon === "Modificación contractual") {
    out.add("Modificación contractual");
    out.add("Modificación plazo-forma pago");
    out.add("modificaciones");
  }
  return [...out].filter(Boolean);
}

const OP = ["orden_de_proveeduria"] as const;

/** Formularios posteriores al alta: buscan OP ya registrada. */
const LOOKUP = {
  requiresOrdenLookup: true,
  lookupCapa: "Alta / orden",
} as const;

export const AGUA_CAPTURE_FORMS: CaptureFormConfig[] = [
  {
    id: "alta",
    label: "1 · Registro inicial",
    description:
      "Registre la orden de proveeduría por primera vez: proveedor, valor y territorio. Después no se cambia; los demás formularios usan esta orden.",
    capa: "Alta / orden",
    mode: "create-once",
    fieldNames: [
      ...OP,
      "orden_de_proveeduria_segmentado",
      "op2",
      /** Orden por pago (tabla Pagos); se registra junto a la orden de negocio. */
      "orden_de_proveeduria_x_pago",
      "nit",
      "proveedor",
      "valor",
      "vigencia",
      "tipo_de_orden",
      "orden_relacionada_control_y_seg",
      "proveedor_o_p_par",
      "region",
      "provincia",
      "departamento",
      "municipio",
      "fecha",
      "objeto",
      "decreto",
      "tipo_maquina",
      // Sin coordenadas: Agua es territorio (DIVIPOLA depto/municipio), no punto.
      // Coordenadas sí aplican en otros temas (p. ej. carrotanques).
      "n_sigob_de_solicitud",
      "n_sigob_de_respuesta",
      "tipo_de_evento",
    ],
    requiredNames: ["orden_de_proveeduria", "departamento", "municipio"],
  },
  {
    id: "variables-lider",
    label: "2 · Variables del líder",
    description:
      "Busque la orden ya registrada y complete las variables del líder y quiénes están asignados.",
    capa: "Variables líder",
    mode: "upsert",
    ...LOOKUP,
    fieldNames: [
      ...OP,
      "administracion",
      "procesos_juridicos",
      "nombre_orden",
      "categorizacion",
      "responsable_apoyo_a_la_supervision",
      "tecnico_asignado",
      "abogado_asignado_r_tecnica",
      "financiero_asignado",
      "fecha_de_aval",
    ],
    requiredNames: ["orden_de_proveeduria"],
  },

  // ── Tablas actualizables (historial) ──────────────────────────
  {
    id: "modificaciones",
    label: "3 · Modificaciones",
    description:
      "Busque la orden y agregue un cambio (plazo, pago, adición, etc.). No altera el registro inicial.",
    capa: "Modificación contractual",
    mode: "append",
    ...LOOKUP,
    fieldNames: [
      ...OP,
      "proveedor",
      "num_modificacion",
      "tipo_de_modificacion",
      "modificacion",
      "fecha",
      "valor",
      "plazo_de_ejecucion_dias",
      "horas_maquina",
      "dias_volqueta",
      "sin_info",
      "forma_de_pago",
      "valor_parcial_1",
      "valor_parcial_2",
      "valor_parcial_3",
      "observaciones",
      "horas",
      "verif",
    ],
    requiredNames: ["orden_de_proveeduria"],
  },
  {
    id: "bitacora",
    label: "4 · Bitácora",
    description:
      "Busque la orden y registre un evento de seguimiento (estado, proceso, dependencia, comentario).",
    capa: "Bitácora estado",
    mode: "append",
    ...LOOKUP,
    fieldNames: [
      ...OP,
      "fecha_estado",
      "estado_macro",
      "estado",
      "proceso",
      "dependencia",
      "comentario",
    ],
    requiredNames: ["orden_de_proveeduria", "fecha_estado", "estado"],
  },
  {
    id: "pagos",
    label: "5 · Pagos",
    description:
      "Busque la orden y registre un pago. Proveedor y NIT se cargan solos. El saldo a liberar se calcula solo.",
    capa: "Pago / desembolso",
    mode: "append",
    ...LOOKUP,
    lookupExpandPaymentOps: true,
    fieldNames: [
      ...OP,
      "orden_de_proveeduria_x_pago",
      "nit",
      "proveedor",
      "valor_op_parcial",
      "ano",
      "n_contrato",
      "sd_solicitud_de_desembolso",
      "comprobante_de_egreso",
      "voucher",
      "valor_pagado_sin_impuestos",
      "valor_pagado_total_con_impuestos",
      "saldo_a_liberar",
      "fecha_de_pago",
      "op_paga",
      "saldo_por_liberar",
      "comentario_depuracion",
      "odern_3",
    ],
    requiredNames: ["orden_de_proveeduria"],
    computedFields: {
      saldo_a_liberar: {
        op: "subtract",
        left: "valor_op_parcial",
        right: "valor_pagado_total_con_impuestos",
        leftFallbacks: ["valor"],
        rightFallbacks: ["valor_pagado_sin_impuestos"],
      },
    },
  },
  {
    id: "cdps-rc",
    label: "6 · CDP y RC",
    description:
      "Busque la orden y registre un CDP o un RC.",
    capa: "CDPS y RC",
    mode: "append",
    ...LOOKUP,
    fieldNames: [
      ...OP,
      "proveedor",
      "valor",
      "ano",
      "no_cdp",
      "n_cdp",
      "fecha_cdp",
      "valor_cdp",
      "no_rc",
      "n_rc",
      "fecha_rc",
      "valor_rc",
      "valor_pagado",
      "n_ratificacion",
      "observaciones",
    ],
    requiredNames: ["orden_de_proveeduria"],
  },
  {
    id: "bitacora-estructuracion",
    label: "7 · Seguimiento de estructuración",
    description:
      "Busque la orden y registre el avance semanal y el porcentaje de ejecución.",
    capa: "Bitácora estructuración",
    mode: "append",
    ...LOOKUP,
    fieldNames: [
      ...OP,
      "estado_de_ejecucion",
      "semana_seguimiento",
      "fecha_estado",
      "comentario_semanal",
      "responsable_apoyo_a_la_supervision",
      "fecha_de_asignacion",
      "fecha_inicio_orden",
      "fecha_fin_orden",
      "ejecucion",
      "expediente",
      "fecha_radicacion_expediente",
    ],
    requiredNames: ["orden_de_proveeduria"],
  },
  {
    id: "control",
    label: "8 · Control de ejecución",
    description:
      "Busque la orden y actualice lo contratado frente a lo ejecutado.",
    capa: "Control ejecución física",
    mode: "upsert",
    ...LOOKUP,
    fieldNames: [
      ...OP,
      "tipo_de_orden",
      "tipo_maquina",
      "nombre_orden",
      "cntd_tanques_de_almacenamiento_de_agua_contratados",
      "capacidad_lts_tanques_contratados",
      "cantidad_carrotanques_contratadas",
      "capacidad_lt_crrt_contratadas",
      "dias_suministro_crrt_contratada",
      "cntd_vactor_contratadas",
      "capacidad_lt_vactor_contratada",
      "dias_suministro_vactor_contratada",
      "cantidad_maquinas_m_a_contratadas",
      "horas_maquina_m_a",
      "dias_volqueta_m_a_contratadas",
      "cantidad_de_tanques_de_almacenamiento_de_agua_ejecutadas",
      "capacidad_lt_tanques_ejecutados",
      "cantidad_carrotanques_ejecutadas",
      "capacidad_lt_2_crrt",
      "dias_suministro_crrt",
      "cntd_vactor_ejecutadas",
      "capacidad_lt_vactor_ejecutadas",
      "dias_suministro_vactor_ejecutadas",
      "cantidad_maquinas_m_a_ejecutadas",
      "horas_maquina_m_a_ejecutadas",
      "dias_volqueta_m_a_ejecutadas",
      // Columnas finales de la hoja Excel «control y seguimiento-detalle m»
      "vigencia",
      "proveedor",
      "municipio",
      "departamento",
    ],
    requiredNames: ["orden_de_proveeduria"],
  },
];
