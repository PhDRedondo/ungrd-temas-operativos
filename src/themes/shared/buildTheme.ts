import type { FormField, ThemeConfig } from "./types";

export const GEO_FIELDS: FormField[] = [
  {
    name: "departamento",
    label: "Departamento",
    type: "select",
    required: true,
    options: [
      "Antioquia",
      "Atlántico",
      "Bogotá D.C.",
      "Bolívar",
      "Boyacá",
      "Caldas",
      "Cauca",
      "Cesar",
      "Córdoba",
      "Cundinamarca",
      "Huila",
      "La Guajira",
      "Magdalena",
      "Meta",
      "Nariño",
      "Norte de Santander",
      "Quindío",
      "Risaralda",
      "Santander",
      "Sucre",
      "Tolima",
      "Valle del Cauca",
    ],
  },
  {
    name: "municipio",
    label: "Municipio",
    type: "text",
    required: true,
    placeholder: "Nombre del municipio",
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
