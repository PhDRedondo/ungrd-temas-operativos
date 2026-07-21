import type { FormField, ThemeConfig } from "./types";
import { departmentNames } from "@/lib/geo";

/** Geo DIVIPOLA: departamentos oficiales; municipio se restringe en UI/validación. */
export const GEO_FIELDS: FormField[] = [
  {
    name: "departamento",
    label: "Departamento",
    type: "select",
    required: true,
    options: departmentNames(),
  },
  {
    name: "municipio",
    label: "Municipio (DIVIPOLA)",
    type: "text",
    required: true,
    placeholder: "Seleccione departamento primero",
  },
];

export const BASE_DATE_FIELDS: FormField[] = [
  { name: "fecha", label: "Fecha", type: "date", required: true },
  {
    name: "estado",
    label: "Estado",
    type: "select",
    required: true,
    options: ["Programado", "En ejecución", "Finalizado", "Suspendido"],
  },
  {
    name: "observaciones",
    label: "Observaciones",
    type: "textarea",
    placeholder: "Detalle adicional…",
  },
];

/** Ensambla un ThemeConfig con geo + campos propios + fechas/estado. */
export function buildTheme(
  partial: Omit<ThemeConfig, "fields"> & { extraFields: FormField[] },
): ThemeConfig {
  return {
    ...partial,
    fields: [...GEO_FIELDS, ...partial.extraFields, ...BASE_DATE_FIELDS],
  };
}

/**
 * Tema alimentado por Excel/maqueta/bitácora real.
 * Los campos ya incluyen departamento/municipio/fecha/estado/valor
 * (sin duplicar GEO_FIELDS ni BASE_DATE_FIELDS).
 */
export function buildThemeFromSource(
  partial: Omit<ThemeConfig, "fields"> & {
    sourceFields: FormField[];
    schemaVersion?: number;
  },
): ThemeConfig {
  const { sourceFields, schemaVersion = 2, ...rest } = partial;
  return {
    ...rest,
    schemaVersion,
    fields: sourceFields,
  };
}
