/**
 * Formularios de captura — Obras de emergencia.
 *
 * Lógica de negocio portada del tablero `obras_emergencia` (formulario
 * contratista + seguimiento), adaptada a capas Postgres/Supabase:
 *  - Contrato de obra
 *  - Orden de proveeduría
 *  - Seguimiento de avances (actualiza contrato existente)
 *
 * No elimina campos del Excel oficial (`fields-from-source.ts`).
 */
import type { CaptureFormConfig } from "../shared";

export const OBRAS_EMERG_CAPAS = [
  "Contrato de obra",
  "Orden de proveeduría",
] as const;

export type ObrasEmergCapa = (typeof OBRAS_EMERG_CAPAS)[number];

export const OBRAS_EMERG_CAPA_ALIASES: Record<string, ObrasEmergCapa> = {
  contrato: "Contrato de obra",
  "contrato de obra": "Contrato de obra",
  "CONTRATO DE OBRA": "Contrato de obra",
  op: "Orden de proveeduría",
  "o.p.": "Orden de proveeduría",
  "orden de proveeduria": "Orden de proveeduría",
  "orden de proveeduría": "Orden de proveeduría",
  "ORDEN DE PROVEEDURÍA": "Orden de proveeduría",
  "ORDEN DE PROVEEDURIA": "Orden de proveeduría",
};

export function normalizeObrasEmergCapa(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const alias =
    OBRAS_EMERG_CAPA_ALIASES[s] || OBRAS_EMERG_CAPA_ALIASES[s.toLowerCase()];
  if (alias) return alias;
  if ((OBRAS_EMERG_CAPAS as readonly string[]).includes(s)) return s;
  return s;
}

export function obrasEmergCapaLookupVariants(capa: string): string[] {
  const raw = String(capa || "").trim();
  const canon = normalizeObrasEmergCapa(raw) || raw;
  const out = new Set<string>();
  if (raw) out.add(raw);
  if (canon) out.add(canon);
  for (const [alias, target] of Object.entries(OBRAS_EMERG_CAPA_ALIASES)) {
    if (target === canon) {
      out.add(alias);
      out.add(target);
    }
  }
  return [...out].filter(Boolean);
}

/** Campos del formulario zip → nombres canónicos en `fields-from-source`. */
const CONTRATO_FIELDS = [
  "contrato_de_obra",
  "departamento",
  "municipio",
  "contratista",
  "obra_realizada",
  "objeto_del_contrato",
  "valor",
  "estado",
  "estado_de_pago",
  "avance_fisico_ejecutado",
  "avance_financiero_ejecutado",
  "avance_fisico_programado",
  "fecha",
  "fecha_finalizacion_uno",
  "no_cdp",
  "no_rc",
  "lugar",
  "latitud",
  "longitud",
  "observaciones",
] as const;

const OP_FIELDS = [
  "orden_de_proveeduria",
  "departamento",
  "municipio",
  "proveedor",
  "tipo_de_contrato",
  "valor",
  "estado",
  "estado_de_pago",
  "horas_maquina",
  "dias_volqueta",
  "fecha_orden",
  "fecha_de_activacion",
  "fecha_finalizacion",
  "porcentaje_avance_fisico_ejecutado",
  "porcentaje_avance_financiero_ejecutado",
  "porcentaje_avance_fisico_programado",
  "nit",
  "representante_legal",
  "telefono_contratista",
  "correo_contratista",
  "observaciones",
] as const;

const SEGUIMIENTO_FIELDS = [
  "estado",
  "estado_de_pago",
  "avance_fisico_ejecutado",
  "avance_financiero_ejecutado",
  "avance_fisico_programado",
  "fecha",
  "fecha_finalizacion_uno",
  "cuentas_de_cobro_tramitadas",
  "observaciones",
] as const;

export const OBRAS_EMERG_CAPTURE_FORMS: CaptureFormConfig[] = [
  {
    id: "contrato",
    label: "1 · Contrato de obra",
    description:
      "Alta o actualización del contrato (campos del tablero SMD: convenio, contratista, valor, avances y plazos).",
    capa: "Contrato de obra",
    mode: "upsert",
    fieldNames: [...CONTRATO_FIELDS],
    requiredNames: [
      "contrato_de_obra",
      "departamento",
      "municipio",
      "valor",
      "estado",
      "fecha",
    ],
  },
  {
    id: "orden-proveeduria",
    label: "2 · Orden de proveeduría",
    description:
      "Registro de O.P. (maquinaria amarilla / horas máquina) vinculada a la operación.",
    capa: "Orden de proveeduría",
    mode: "upsert",
    fieldNames: [...OP_FIELDS],
    requiredNames: [
      "orden_de_proveeduria",
      "departamento",
      "municipio",
      "valor",
      "estado",
    ],
  },
  {
    id: "seguimiento",
    label: "3 · Seguimiento de avances",
    description:
      "Actualice estado, avances físico/financiero y observaciones de un contrato ya registrado (lógica SPI/CPI del tablero SMD).",
    capa: "Contrato de obra",
    mode: "upsert",
    requiresOrdenLookup: true,
    lookupBy: "orden",
    lookupCapa: "Contrato de obra",
    fieldNames: [...SEGUIMIENTO_FIELDS],
    requiredNames: ["estado"],
    patchFieldNames: [...SEGUIMIENTO_FIELDS],
    readonlyWhenEditing: ["contrato_de_obra", "departamento", "municipio"],
  },
];
