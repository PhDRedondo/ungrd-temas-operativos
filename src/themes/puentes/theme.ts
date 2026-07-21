import { buildThemeFromSource, type ThemeModule } from "../shared";
import { SOURCE_FIELDS, SCHEMA_VERSION } from "./fields-from-source";

/**
 * Puentes — Consolidado de Puentes SMD ArcGIS (todos los campos).
 */
export const config = buildThemeFromSource({
  id: "puentes",
  name: "Puentes",
  shortName: "Puentes",
  description:
    "Inventario e intervención de puentes modulares SMD (Acrow/Bailey) desde consolidado ArcGIS.",
  icon: "bridge",
  unit: "puentes",
  valueLabel: "Puentes",
  schemaVersion: SCHEMA_VERSION,
  sourceFields: SOURCE_FIELDS,
});

const themeModule: ThemeModule = { config };
export default themeModule;
