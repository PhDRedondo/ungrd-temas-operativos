/**
 * Formularios del seguimiento por pestaña (resolución o decreto).
 * Fuente: 102 SEGUIMIENTO 04 SEPTIEM 2026. No forman parte del acumulado Fidusap.
 */
import type { RecordRow } from "@/lib/records/types";

export const SEGUIMIENTO_HOJA_KIND = "seguimiento-hoja";
export const SEGUIMIENTO_HOJA_PREFIX = "SEGUIMIENTO";

export type SeguimientoFieldType = "text" | "money" | "textarea";

export type SeguimientoField = {
  name: string;
  label: string;
  type: SeguimientoFieldType;
  required?: boolean;
};

export type SeguimientoHoja = {
  id: string;
  pestana: string;
  titulo: string;
  resolucion: string;
  fields: SeguimientoField[];
};

const LINEA_CDP: SeguimientoField[] = [
  { name: "linea", label: "Línea", type: "text", required: true },
  { name: "detalle", label: "Detalle", type: "textarea", required: true },
  { name: "valor_asignado", label: "Valor asignado", type: "money", required: true },
  { name: "valor_con_cdp", label: "Valor con CDP", type: "money" },
  { name: "saldo_por_expedir_cdp", label: "Saldo por expedir CDP", type: "money" },
  { name: "observaciones", label: "Observaciones", type: "textarea" },
];

const LINEA_CDP_SIN_RC: SeguimientoField[] = [
  ...LINEA_CDP.slice(0, 5),
  { name: "sin_rc", label: "Sin RC", type: "money" },
  { name: "observaciones", label: "Observaciones", type: "textarea" },
];

const LINEA_RC: SeguimientoField[] = [
  { name: "linea", label: "Línea", type: "text", required: true },
  { name: "detalle", label: "Detalle", type: "textarea", required: true },
  { name: "valor_asignado", label: "Valor asignado", type: "money", required: true },
  { name: "valor_con_cdp", label: "Valor con CDP", type: "money" },
  { name: "saldo_por_expedir_rc", label: "Saldo por expedir RC", type: "money" },
  { name: "observaciones", label: "Observaciones", type: "textarea" },
];

const SOLO_DETALLE: SeguimientoField[] = [
  { name: "detalle", label: "Detalle", type: "textarea", required: true },
  { name: "valor_asignado", label: "Valor asignado", type: "money", required: true },
];

/** Pestañas de resolución o decreto del libro de seguimiento. */
export const SEGUIMIENTO_HOJAS: SeguimientoHoja[] = [
  {
    id: "recursos-2025",
    pestana: "RECURSOS 2025",
    titulo: "Recursos 2025 SMD",
    resolucion: "",
    fields: LINEA_CDP,
  },
  {
    id: "decreto-1372",
    pestana: "DECRETO 1372",
    titulo: "Decreto 1372 · adición 2025 SMD",
    resolucion: "09002025",
    fields: LINEA_RC,
  },
  {
    id: "recursos-2026-agosto",
    pestana: "RECURSOS 2026 AGOSTO",
    titulo: "Recursos 2026 agosto",
    resolucion: "00162026",
    fields: LINEA_CDP_SIN_RC,
  },
  {
    id: "recursos-2026",
    pestana: "RECURSOS 2026",
    titulo: "Recursos 2026",
    resolucion: "00162026",
    fields: LINEA_CDP_SIN_RC,
  },
  {
    id: "galeras",
    pestana: "GALERAS",
    titulo: "Galeras",
    resolucion: "",
    fields: LINEA_CDP,
  },
  {
    id: "seguros",
    pestana: "SEGURO VIDA VOLU",
    titulo: "Seguros vida voluntarios",
    resolucion: "689252026",
    fields: LINEA_CDP,
  },
  {
    id: "san-andres",
    pestana: "SAN ANDRES",
    titulo: "Desastre Archipiélago de San Andrés",
    resolucion: "1380",
    fields: LINEA_CDP,
  },
  {
    id: "1372-detalle",
    pestana: "1372",
    titulo: "Decreto 1372 · detalle de bancos",
    resolucion: "09002025",
    fields: SOLO_DETALLE,
  },
];

export function seguimientoHojaById(id: string): SeguimientoHoja | undefined {
  return SEGUIMIENTO_HOJAS.find((h) => h.id === id);
}

export function isSeguimientoHojaRecord(
  row: Record<string, unknown> | RecordRow,
): boolean {
  const kind = String(row._kind ?? "").trim();
  if (kind === SEGUIMIENTO_HOJA_KIND) return true;
  const clave = String(row.clave_seguimiento ?? row.no_cdp ?? "").trim();
  return clave.toUpperCase().startsWith(`${SEGUIMIENTO_HOJA_PREFIX}:`);
}

export function seguimientoClave(hojaId: string, linea: string, detalle: string): string {
  const slug = `${linea} ${detalle}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${SEGUIMIENTO_HOJA_PREFIX}:${hojaId}:${slug || "LINEA"}`;
}
