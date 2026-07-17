export type FieldType = "text" | "number" | "date" | "select" | "textarea";

export type FormField = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
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
};

/** Módulo autónomo de un tema: lo que cada desarrollador mantiene en su carpeta. */
export type ThemeModule = {
  config: ThemeConfig;
};
