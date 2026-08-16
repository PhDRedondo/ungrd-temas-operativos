import { buildThemeFromSource, type ThemeModule } from "../shared";
import { SOURCE_FIELDS, SCHEMA_VERSION } from "./fields-from-source";
import { PUENTES_CAPTURE_FORMS } from "./capture-forms";

/**
 * Puentes — inventario + bitácora + estructuración contractual.
 * Llave activo: id_puente · Llave proceso: clave_proceso
 */
export const config = {
  ...buildThemeFromSource({
    id: "puentes",
    name: "Puentes",
    shortName: "Puentes",
    description:
      "Contratos, inventario de puentes y bitácora de estado.",
    icon: "bridge",
    unit: "puentes",
    valueLabel: "Puentes",
    schemaVersion: SCHEMA_VERSION,
    sourceFields: SOURCE_FIELDS,
  }),
  captureForms: PUENTES_CAPTURE_FORMS,
};

const themeModule: ThemeModule = { config };
export default themeModule;
