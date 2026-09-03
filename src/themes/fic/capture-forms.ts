/**
 * Formularios de captura — FIC (CONTROL FIC / AppSheet).
 *
 * Fuente: alimentador.fic_transferencias_Form (+ modificaciones).
 * Persistencia: records theme_id=fic. Capas = Transferencia FIC {vigencia}.
 * Clave: No. CDP. No reduce fields-from-source.ts (Excel intacto).
 */
import type { CaptureFormConfig } from "../shared";

export const FIC_VIGENCIAS = [
  "2014",
  "2015",
  "2016",
  "2017",
  "2018",
  "2019",
  "2020",
  "2021",
  "2022",
  "2023",
  "2024",
  "2025",
  "2026",
] as const;

export const FIC_CAPAS = FIC_VIGENCIAS.map(
  (y) => `Transferencia FIC ${y}`,
) as readonly string[];

/** Capa por defecto del form (prepareTrackingRow la corrige con vigencia). */
export const FIC_CAPA_DEFAULT = "Transferencia FIC 2026";

export function ficCapaFromVigencia(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const y = s.match(/(20\d{2})/);
  if (!y) return null;
  const capa = `Transferencia FIC ${y[1]}`;
  return (FIC_CAPAS as readonly string[]).includes(capa) ? capa : capa;
}

export function normalizeFicCapa(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const fromYear = ficCapaFromVigencia(s);
  if (fromYear && /^transferencia\s+fic/i.test(s) === false && /^\d{4}/.test(s)) {
    return fromYear;
  }
  const hit = FIC_CAPAS.find((c) => c.toLowerCase() === s.toLowerCase());
  if (hit) return hit;
  const y = s.match(/(20\d{2})/);
  if (y && /fic/i.test(s)) return `Transferencia FIC ${y[1]}`;
  return s;
}

/** Lookup: cualquier vigencia FIC encuentra CDPs de todas las capas Transferencia. */
export function ficCapaLookupVariants(capa: string): string[] {
  const raw = String(capa || "").trim();
  const canon = normalizeFicCapa(raw) || raw;
  if (/transferencia\s+fic/i.test(canon) || /transferencia\s+fic/i.test(raw)) {
    return [...FIC_CAPAS];
  }
  const out = new Set<string>();
  if (raw) out.add(raw);
  if (canon) out.add(canon);
  return [...out].filter(Boolean);
}

/** ColumnOrder AppSheet → nombres Excel UNGRD (alta transferencia). */
const TRANSFERENCIA_FIELDS = [
  "acto_administrativo_otorgamiento_del_recurso",
  "fecha_acto_administrativo_resolucion",
  "vigencia",
  "departamento",
  "municipio",
  "objeto_transferencia",
  "tipo_de_evento",
  "fecha_formato_de_aprobacion_de_la_atencion",
  "plazo_ejecucion_dias",
  "clasificacion",
  "no_cdp",
  "no_rc",
  "valor",
  "fecha",
  "comunicacion_de_notificacion_ente_territorial",
  "fecha_de_radicacion_comunicacion_ente_territorial",
  "nombre_del_supervisor_administrativo",
  "fecha_inicial_para_legalizacion",
  "estado",
  "valor_legalizado",
  "valor_por_legalizar",
  "porcentaje_de_avance_en_el_ejericicio_de_legalizacion",
  "responsabilidades_de_la_supervision_descripcion_de_las_acciones_",
  "observaciones",
] as const;

const LEGALIZACION_FIELDS = [
  "estado",
  "valor_legalizado",
  "valor_por_legalizar",
  "porcentaje_de_avance_en_el_ejericicio_de_legalizacion",
  "fecha_inicial_para_legalizacion",
  "nombre_del_supervisor_administrativo",
  "responsabilidades_de_la_supervision_descripcion_de_las_acciones_",
  "se_realizaron_visitas_de_seguimiento",
  "describa_el_resultado_de_las_visitas_realizadas",
  "fecha_de_radicacion_en_gafc",
  "observaciones",
] as const;

/** alimentador.fic_modificaciones_Form → columnas prórroga del Excel. */
const MODIFICACION_FIELDS = [
  "acto_administrativo_prorroga",
  "plazo_adicion_dias",
  "fecha_de_legalizacion_por_prorroga",
  "estado",
  "observaciones",
] as const;

export const FIC_CAPTURE_FORMS: CaptureFormConfig[] = [
  {
    id: "transferencia",
    label: "1 · Transferencia FIC",
    description:
      "Alta o actualización de transferencia (CDP, vigencia, acto, desembolso y legalización). La capa se fija con la vigencia.",
    capa: FIC_CAPA_DEFAULT,
    mode: "upsert",
    fieldNames: [...TRANSFERENCIA_FIELDS],
    requiredNames: [
      "no_cdp",
      "vigencia",
      "departamento",
      "municipio",
      "valor",
      "estado",
    ],
  },
  {
    id: "legalizacion",
    label: "2 · Seguimiento legalización",
    description:
      "Actualice estado, valores legalizados y avance de un CDP ya registrado (busque por No. CDP).",
    capa: FIC_CAPA_DEFAULT,
    mode: "upsert",
    requiresOrdenLookup: true,
    lookupBy: "orden",
    lookupCapa: FIC_CAPA_DEFAULT,
    fieldNames: [...LEGALIZACION_FIELDS],
    requiredNames: ["estado"],
    patchFieldNames: [...LEGALIZACION_FIELDS],
    readonlyWhenEditing: [
      "no_cdp",
      "vigencia",
      "departamento",
      "municipio",
      "valor",
    ],
  },
  {
    id: "modificacion",
    label: "3 · Modificación / prórroga",
    description:
      "Acto de prórroga, plazo adicionado y fecha de legalización por prórroga (form AppSheet modificaciones).",
    capa: FIC_CAPA_DEFAULT,
    mode: "upsert",
    requiresOrdenLookup: true,
    lookupBy: "orden",
    lookupCapa: FIC_CAPA_DEFAULT,
    fieldNames: [...MODIFICACION_FIELDS],
    requiredNames: ["acto_administrativo_prorroga"],
    patchFieldNames: [...MODIFICACION_FIELDS],
    readonlyWhenEditing: [
      "no_cdp",
      "vigencia",
      "departamento",
      "municipio",
      "valor",
    ],
  },
];
