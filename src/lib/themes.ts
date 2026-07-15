/**
 * Compatibilidad: el catálogo de temas vive en `src/themes/`.
 * Cada tema es una carpeta autónoma (`src/themes/<slug>/`).
 */
export {
  THEMES,
  THEME_MODULES,
  getTheme,
  getThemeModule,
  buildTheme,
  GEO_FIELDS,
  BASE_DATE_FIELDS,
} from "@/themes";

export type {
  FieldType,
  FormField,
  ThemeConfig,
  ThemeModule,
} from "@/themes";
