import { buildThemeFromSource, type ThemeModule } from "../shared";
import { SOURCE_FIELDS, SCHEMA_VERSION } from "./fields-from-source";
import { AGUA_CAPTURE_FORMS } from "./capture-forms";

/**
 * Agua y Saneamiento — formularios por capa que alimentan la Maqueta.
 * Discriminador: tipo_registro / capa.
 */
export const config = {
  ...buildThemeFromSource({
    id: "agua-y-saneamiento",
    name: "Agua y Saneamiento",
    shortName: "Agua",
    description:
      "Órdenes de proveeduría: registro inicial, bitácora, pagos, CDP/RC y control de ejecución.",
    icon: "droplets",
    unit: "órdenes",
    valueLabel: "Órdenes",
    schemaVersion: SCHEMA_VERSION,
    sourceFields: SOURCE_FIELDS,
  }),
  captureForms: AGUA_CAPTURE_FORMS,
};

const themeModule: ThemeModule = { config };
export default themeModule;
