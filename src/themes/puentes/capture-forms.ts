/**
 * Formularios operativos Puentes (puentes 2.xlsx).
 *
 * Llaves:
 *  - id_puente → activo (inventario + bitácora)
 *  - clave_proceso → proceso contractual (estructuración; N puentes : 1 proceso)
 */
import type { CaptureFormConfig } from "../shared";

export const PUENTES_CAPAS = [
  "Contrato estructuración",
  "Inventario puente",
  "Bitácora estado",
] as const;

export type PuenteCapa = (typeof PUENTES_CAPAS)[number];

export const PUENTES_TABLAS_ACTUALIZABLES: PuenteCapa[] = [
  "Bitácora estado",
];

export const PUENTES_CAPA_ALIASES: Record<string, PuenteCapa> = {
  "Base General Puentes": "Inventario puente",
  "base general puentes": "Inventario puente",
  bitacora: "Bitácora estado",
  Bitacora: "Bitácora estado",
  "Contratos Estructuracion": "Contrato estructuración",
  "contratos estructuracion": "Contrato estructuración",
};

export function normalizePuenteCapa(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const alias = PUENTES_CAPA_ALIASES[s] || PUENTES_CAPA_ALIASES[s.toLowerCase()];
  if (alias) return alias;
  if ((PUENTES_CAPAS as readonly string[]).includes(s)) return s;
  return s;
}

export function puenteCapaLookupVariants(capa: string): string[] {
  const raw = String(capa || "").trim();
  const canon = normalizePuenteCapa(raw) || raw;
  const out = new Set<string>();
  if (raw) out.add(raw);
  if (canon) out.add(canon);
  for (const [alias, target] of Object.entries(PUENTES_CAPA_ALIASES)) {
    if (target === canon) {
      out.add(alias);
      out.add(target);
    }
  }
  return [...out].filter(Boolean);
}

const ID = ["id_puente"] as const;

/**
 * Filtros del lookup de puentes, en orden jerárquico.
 * `clave_proceso` (el contrato) es la raíz: acota el universo y sobre ese
 * subconjunto se aplican territorio y atributos.
 */
const PUENTE_LOOKUP = {
  requiresPuenteLookup: true,
  lookupCapa: "Inventario puente",
  lookupFilterFields: [
    "codigo_operativo",
    "convenio_o_cto",
    "departamento",
    "municipio",
  ] as string[],
} as const;

/** Estructuración origina el proceso: registrar si nace, modificar si ya existe. */
const PROCESO_RAIZ = {
  requiresProcesoLookup: true,
  lookupCanCreate: true,
  lookupCapa: "Contrato estructuración",
} as const;

/** Inventario nace de un proceso: el lookup lista contratos y sus puentes (Base General). */
const PROCESO_LOOKUP = {
  requiresProcesoLookup: true,
  lookupCapa: "Inventario puente",
} as const;

export const PUENTES_CAPTURE_FORMS: CaptureFormConfig[] = [
  {
    id: "estructuracion",
    label: "1 · Contrato / estructuración",
    description:
      "Registre el contrato o convenio, o elija uno existente para actualizar etapa y estado.",
    capa: "Contrato estructuración",
    mode: "upsert",
    ...PROCESO_RAIZ,
    fieldNames: [
      "contrato_convenio",
      "clave_proceso",
      "tipo_vinculo",
      "descripcion_proceso",
      "valor",
      "vigencia",
      "tipo_proceso",
      "grupo",
      "etapa",
      "estado",
      "area",
      "responsable",
      "fecha_inicio_proceso",
      "fecha_fin_proceso",
      "plazo_ejecucion",
      "tiempo_etapa_dias",
      "tiempo_acumulado_dias",
      "alerta",
      "comentarios",
      "reporte",
    ],
    requiredNames: ["contrato_convenio", "etapa"],
  },
  {
    id: "inventario",
    label: "2 · Inventario del puente",
    description:
      "Elija el contrato y registre o edite un puente asociado.",
    capa: "Inventario puente",
    mode: "upsert",
    ...PROCESO_LOOKUP,
    // contrato_convenio / clave_proceso / tipo_vinculo NO se listan: llegan
    // heredados del proceso seleccionado. El contrato solo se escribe en la
    // capa Estructuración.
    fieldNames: [
      ...ID,
      "codigo_operativo",
      "clase",
      "tipo",
      "configuracion",
      "ano_compra",
      "longitud_m",
      "capacidad_ton",
      "clasificacion_propiedad",
      "valor",
      "ubicacion_actual",
      "region",
      "departamento",
      "municipio",
      "personas_beneficiadas",
      "latitud",
      "longitud",
      "entidad_receptora",
      "estado",
      "estado_puente",
      "situacion_prestamo",
      "fecha_inicio_estado_actual",
      "fecha_fin_estado_actual",
      "fecha_desde_ultimo_estado",
      "observaciones",
    ],
    requiredNames: ["id_puente", "departamento", "municipio"],
  },
  {
    id: "bitacora",
    label: "3 · Bitácora del puente",
    description:
      "Busque el puente y registre un evento nuevo (estado, ubicación, fechas).",
    capa: "Bitácora estado",
    mode: "append",
    ...PUENTE_LOOKUP,
    fieldNames: [
      ...ID,
      "codigo_operativo",
      "tipo",
      "cantidad_viajes",
      "ubicacion_actual",
      "region",
      "departamento",
      "municipio",
      "vereda",
      "ente_receptor",
      "situacion_prestamo",
      "estado_puente",
      "fecha_inicio",
      "fecha_fin",
      "fecha_corte_reporte",
      "fundamento",
      "observaciones",
      "nombre_hoja_reporte",
      /** Columna Excel bitácora «convenio o cto» — no puede faltar. */
      "convenio_o_cto",
    ],
    requiredNames: ["id_puente", "fecha_inicio"],
  },
];

/** Orden canónico de alimentación: el proceso nace primero. */
export const PUENTES_CAPA_ORDEN: PuenteCapa[] = [
  "Contrato estructuración",
  "Inventario puente",
  "Bitácora estado",
];
