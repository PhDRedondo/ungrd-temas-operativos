import { buildThemeFromSource, type ThemeModule } from "../shared";
import { SOURCE_FIELDS, SCHEMA_VERSION } from "./fields-from-source";

export const config = buildThemeFromSource({
  id: "obras-por-impuestos",
  name: "Obras por impuestos",
  shortName: "Obras impuestos",
  description:
    "Convenios de obras por impuestos (contribuyente, interventoría, BPIN) desde ArcGIS.",
  icon: "landmark",
  unit: "proyectos",
  valueLabel: "Proyectos",
  schemaVersion: SCHEMA_VERSION,
  sourceFields: SOURCE_FIELDS,
});

const themeModule: ThemeModule = { config };
export default themeModule;
