/**
 * Formularios de captura — Obras por impuestos.
 *
 * Una capa canónica (Convenio obra por impuesto). Formularios:
 *  1. Alta / actualización del convenio (contribuyente, BPIN, plazos)
 *  2. Interventoría (datos del convenio de interventoría)
 *  3. Seguimiento (estado y fechas)
 *
 * No reduce `fields-from-source.ts` (Excel ArcGIS intacto).
 */
import type { CaptureFormConfig } from "../shared";

export const OBRAS_IMP_CAPAS = ["Convenio obra por impuesto"] as const;

export type ObrasImpCapa = (typeof OBRAS_IMP_CAPAS)[number];

export const OBRAS_IMP_CAPA_ALIASES: Record<string, ObrasImpCapa> = {
  convenio: "Convenio obra por impuesto",
  "convenio obra por impuesto": "Convenio obra por impuesto",
  "CONVENIO OBRA POR IMPUESTO": "Convenio obra por impuesto",
  "obra por impuesto": "Convenio obra por impuesto",
  "obras por impuestos": "Convenio obra por impuesto",
};

export function normalizeObrasImpCapa(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const alias =
    OBRAS_IMP_CAPA_ALIASES[s] || OBRAS_IMP_CAPA_ALIASES[s.toLowerCase()];
  if (alias) return alias;
  if ((OBRAS_IMP_CAPAS as readonly string[]).includes(s)) return s;
  return s;
}

export function obrasImpCapaLookupVariants(capa: string): string[] {
  const raw = String(capa || "").trim();
  const canon = normalizeObrasImpCapa(raw) || raw;
  const out = new Set<string>();
  if (raw) out.add(raw);
  if (canon) out.add(canon);
  for (const [alias, target] of Object.entries(OBRAS_IMP_CAPA_ALIASES)) {
    if (target === canon) {
      out.add(alias);
      out.add(target);
    }
  }
  return [...out].filter(Boolean);
}

const CONVENIO_FIELDS = [
  "no_convenio",
  "departamento",
  "municipio",
  "lugar",
  "contribuyente",
  "contratista",
  "objeto_del_convenio",
  "valor",
  "estado",
  "fecha",
  "fecha_de_inicio_del_convenio",
  "fecha_de_terminacion_del_convenio",
  "fecha_de_activacion",
  "fecha_finalizacion",
  "municipios_apoyados_por_convenio",
  "entidad_de_iconos",
  "latitud",
  "longitud",
  "observaciones",
] as const;

const INTERVENTORIA_FIELDS = [
  "convenio_de_interventoria_no",
  "objeto_del_convenio_de_interventoria",
  "contratista",
  "estado_del_convenio_de_interventoria",
  "valor_convenio_de_interventoria",
  "plazo_convenio_de_interventoria",
  "fecha_inicio_de_convenio_interventoria",
  "fecha_terminacion_de_convenio_de_interventoria",
  "observaciones",
] as const;

const SEGUIMIENTO_FIELDS = [
  "estado",
  "fecha_de_inicio_del_convenio",
  "fecha_de_terminacion_del_convenio",
  "fecha_de_activacion",
  "fecha_finalizacion",
  "observaciones",
] as const;

export const OBRAS_IMP_CAPTURE_FORMS: CaptureFormConfig[] = [
  {
    id: "convenio",
    label: "1 · Convenio obra por impuesto",
    description:
      "Alta o actualización del convenio (BPIN/Nº convenio, contribuyente, valor y plazos).",
    capa: "Convenio obra por impuesto",
    mode: "upsert",
    fieldNames: [...CONVENIO_FIELDS],
    requiredNames: [
      "no_convenio",
      "departamento",
      "municipio",
      "valor",
      "estado",
    ],
  },
  {
    id: "interventoria",
    label: "2 · Interventoría",
    description:
      "Datos del convenio de interventoría vinculados al convenio principal.",
    capa: "Convenio obra por impuesto",
    mode: "upsert",
    requiresOrdenLookup: true,
    lookupBy: "convenio",
    lookupCapa: "Convenio obra por impuesto",
    fieldNames: [...INTERVENTORIA_FIELDS],
    requiredNames: ["convenio_de_interventoria_no"],
    patchFieldNames: [...INTERVENTORIA_FIELDS],
    readonlyWhenEditing: ["no_convenio", "departamento", "municipio"],
  },
  {
    id: "seguimiento",
    label: "3 · Seguimiento de estado",
    description:
      "Actualice estado y fechas de terminación de un convenio ya registrado.",
    capa: "Convenio obra por impuesto",
    mode: "upsert",
    requiresOrdenLookup: true,
    lookupBy: "convenio",
    lookupCapa: "Convenio obra por impuesto",
    fieldNames: [...SEGUIMIENTO_FIELDS],
    requiredNames: ["estado"],
    patchFieldNames: [...SEGUIMIENTO_FIELDS],
    readonlyWhenEditing: ["no_convenio", "departamento", "municipio", "valor"],
  },
];
