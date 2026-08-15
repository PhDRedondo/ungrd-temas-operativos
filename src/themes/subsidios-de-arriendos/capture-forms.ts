/**
 * Formularios Subsidios de Arriendos.
 *
 * Ingesta principal: Excel consolidado (envíos). El formulario cubre la misma
 * capa por si la línea captura un registro puntual.
 *
 * Campos = columnas del consolidado Bronze. `uuid` no se captura: viene del
 * Excel o se genera al guardar.
 */
import type { CaptureFormConfig } from "../shared";

export const SUBSIDIOS_CAPAS = ["Consolidado / envío"] as const;
export type SubsidiosCapa = (typeof SUBSIDIOS_CAPAS)[number];

export const SUBSIDIOS_CAPA_ALIASES: Record<string, SubsidiosCapa> = {
  consolidado: "Consolidado / envío",
  Consolidado: "Consolidado / envío",
  envio: "Consolidado / envío",
  envío: "Consolidado / envío",
  Envío: "Consolidado / envío",
  bronze: "Consolidado / envío",
};

export function normalizeSubsidiosCapa(raw: string): string {
  const s = String(raw || "").trim();
  if (!s) return "";
  const alias = SUBSIDIOS_CAPA_ALIASES[s] || SUBSIDIOS_CAPA_ALIASES[s.toLowerCase()];
  if (alias) return alias;
  if ((SUBSIDIOS_CAPAS as readonly string[]).includes(s)) return s;
  return s;
}

/** Columnas del Excel consolidado, sin `uuid` (no se digita). */
const CONSOLIDADO_FIELDS = [
  "numero_envio",
  "n_orden",
  "estado",
  "departamento",
  "municipio",
  "cod_dane",
  "lugar_giro",
  "cod_oficina",
  "doc_identidad_arrendador",
  "apellidos_arrendador",
  "nombres_arrendador",
  "rud_arrendador",
  "doc_identidad_arrendatario",
  "apellidos_arrendatario",
  "nombres_arrendatario",
  "rud_arrendatario",
  "id_vivienda",
  "tenencia",
  "no_contrato",
  "duracion",
  "fecha_inicio",
  "fecha_final",
  "fecha_entrega_vivienda",
  "valor_total_pagado",
  "_archivo_fuente",
] as const;

export const SUBSIDIOS_CAPTURE_FORMS: CaptureFormConfig[] = [
  {
    id: "consolidado",
    label: "Registro consolidado (envío)",
    description:
      "Misma estructura del Excel consolidado. Preferible cargar el archivo de envío; use este formulario para un alta puntual.",
    capa: "Consolidado / envío",
    mode: "upsert",
    fieldNames: [...CONSOLIDADO_FIELDS],
    requiredNames: [
      "numero_envio",
      "n_orden",
      "departamento",
      "municipio",
      "doc_identidad_arrendador",
      "doc_identidad_arrendatario",
    ],
  },
];
