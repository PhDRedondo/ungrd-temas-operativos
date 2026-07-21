export type FieldType = "text" | "number" | "date" | "select" | "textarea";

export type FormField = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  /** Validación numérica / Excel */
  min?: number;
  max?: number;
  pattern?: string;
  excelWidth?: number;
};

export type ThemeConfig = {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  unit: string;
  valueLabel: string;
  fields: FormField[];
  /** URL de publicación/embed de Quick BI (Alibaba) para la pestaña QuickBI. */
  quickBiUrl?: string;
  /** Versión del schema para plantillas Excel (bump al cambiar fields). */
  schemaVersion?: number;
};

/** Módulo autónomo de un tema: lo que cada desarrollador mantiene en su carpeta. */
export type ThemeModule = {
  config: ThemeConfig;
};

export type AppRole = "captura" | "analista" | "admin" | "auditor";
