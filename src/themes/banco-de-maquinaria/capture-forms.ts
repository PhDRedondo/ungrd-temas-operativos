/**
 * Formularios operativos Banco de Maquinaria.
 *
 * Orden:
 *  1. Convenio / proceso (raíz) — se llena una sola vez
 *  2. Detalle maquinaria (máquinas del convenio; llave serial)
 *  3. Bitácora convenio
 *
 * Sync:
 *  - Bitácora → estado del convenio + estado_convenio en equipos
 */
import type { CaptureFormConfig } from "../shared";
import {
  BMAQ_ALTA_CONVENIO_FIELDS,
  BMAQ_ALTA_DETALLE_FIELDS,
} from "./maqueta-mutable";

export const BMAQ_CAPAS = [
  "Convenio o proceso",
  "Maqueta / inventario",
  "Bitácora convenio",
  "Entrega a beneficiario",
] as const;

export type BmaqCapa = (typeof BMAQ_CAPAS)[number];

export const BMAQ_CAPA_ALIASES: Record<string, BmaqCapa> = {
  MAQUETA: "Maqueta / inventario",
  Maqueta: "Maqueta / inventario",
  maqueta: "Maqueta / inventario",
  inventario: "Maqueta / inventario",
  "DETALLE MAQUINARIA": "Maqueta / inventario",
  detalle: "Maqueta / inventario",
  "CONVENIOS O PROCESOS": "Convenio o proceso",
  convenio: "Convenio o proceso",
  proceso: "Convenio o proceso",
  "BITACORA CONVENIOS": "Bitácora convenio",
  bitacora: "Bitácora convenio",
  "BASE ENTREGA BOMBEROS": "Entrega a beneficiario",
  entrega: "Entrega a beneficiario",
  bomberos: "Entrega a beneficiario",
};

export function normalizeBmaqCapa(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const alias = BMAQ_CAPA_ALIASES[s] || BMAQ_CAPA_ALIASES[s.toLowerCase()];
  if (alias) return alias;
  if ((BMAQ_CAPAS as readonly string[]).includes(s)) return s;
  return s;
}

export function bmaqCapaLookupVariants(capa: string): string[] {
  const raw = String(capa || "").trim();
  const canon = normalizeBmaqCapa(raw) || raw;
  const out = new Set<string>();
  if (raw) out.add(raw);
  if (canon) out.add(canon);
  for (const [alias, target] of Object.entries(BMAQ_CAPA_ALIASES)) {
    if (target === canon) {
      out.add(alias);
      out.add(target);
    }
  }
  return [...out].filter(Boolean);
}

const CONVENIO = ["no_convenio"] as const;

/** El detalle cuelga del convenio: filtrar por OC o contrato de adquisición. */
const LOOKUP_CONTRATO = {
  requiresOrdenLookup: true,
  lookupBy: "contrato" as const,
  lookupCapa: "Convenio o proceso",
};

/** Bitácora: mismas claves que Detalle (convenio u OC desde DETALLE). */
const LOOKUP_CONVENIO = {
  requiresOrdenLookup: true,
  lookupBy: "contrato" as const,
  lookupCapa: "Convenio o proceso",
};

export const BMAQ_CAPTURE_FORMS: CaptureFormConfig[] = [
  {
    id: "alta-convenio",
    label: "1 · Alta convenio o proceso",
    description:
      "Registro del convenio o proceso de adquisición. Se llena una sola vez. Luego, en Detalle, se atan las máquinas de ese convenio.",
    capa: "Convenio o proceso",
    mode: "create-once",
    requiredNames: ["no_convenio"],
    fieldNames: [...BMAQ_ALTA_CONVENIO_FIELDS],
  },
  {
    id: "alta-detalle",
    label: "2 · Detalle maquinaria",
    description:
      "Busque por nº de orden de compra o por contrato de adquisición / convenio. Al elegir, se cargan los datos asociados; complete el resto de la hoja DETALLE (serial, referencia, tipo, etc.).",
    capa: "Maqueta / inventario",
    mode: "create-once",
    ...LOOKUP_CONTRATO,
    requiredNames: ["serial"],
    fieldNames: [...BMAQ_ALTA_DETALLE_FIELDS],
  },
  {
    id: "bitacora-convenio",
    label: "3 · Bitácora de convenio",
    description:
      "Seguimiento del convenio: departamento y municipio vienen del convenio (no se reeditan). Capture el nuevo estado, fecha y comentario. Al guardar, ese último estado queda en el convenio y en ESTADO CONVENIO de los equipos (maqueta).",
    capa: "Bitácora convenio",
    mode: "append",
    ...LOOKUP_CONVENIO,
    requiredNames: ["no_convenio", "estado", "fecha_de_estado"],
    fieldNames: [
      ...CONVENIO,
      "departamento",
      "municipio",
      "estado",
      "fecha_de_estado",
      "comentario",
    ],
    readonlyWhenEditing: [...CONVENIO, "departamento", "municipio"],
  },
];
