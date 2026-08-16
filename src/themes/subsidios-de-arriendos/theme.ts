import { buildThemeFromSource, type ThemeModule } from "../shared";
import { SUBSIDIOS_CAPTURE_FORMS } from "./capture-forms";
import { SOURCE_FIELDS, SCHEMA_VERSION } from "./fields-from-source";

/**
 * Subsidios de Arriendos — consolidado de envíos (Excel).
 * Columnas = las del archivo. El formulario no pide uuid.
 */
export const config: ThemeModule["config"] = {
  ...buildThemeFromSource({
    id: "subsidios-de-arriendos",
    name: "Subsidios de Arriendos",
    shortName: "Arriendos",
    description:
      "Envíos de subsidio de arriendo por hogar. Se puede cargar por Excel o registrar uno a uno.",
    icon: "home",
    unit: "hogares",
    valueLabel: "Hogares",
    schemaVersion: SCHEMA_VERSION,
    sourceFields: SOURCE_FIELDS,
  }),
  captureForms: SUBSIDIOS_CAPTURE_FORMS,
};

const themeModule: ThemeModule = { config };
export default themeModule;
