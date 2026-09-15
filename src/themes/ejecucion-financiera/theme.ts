import { buildThemeFromSource, type ThemeModule } from "../shared";
import { SOURCE_FIELDS, SCHEMA_VERSION } from "./fields";

export const config = buildThemeFromSource({
  id: "ejecucion-financiera",
  name: "Ejecución financiera",
  shortName: "Ejecución",
  description:
    "CDP de Fidusap: pestaña SMD del reporte (o CDP extendido filtrado a Manejo de Desastres).",
  icon: "line-chart",
  unit: "CDP",
  valueLabel: "Valor CDP (COP)",
  schemaVersion: SCHEMA_VERSION,
  sourceFields: SOURCE_FIELDS,
  workspaceTabs: ["cargas", "analitica", "quickbi"],
});

const themeModule: ThemeModule = { config };

export default themeModule;
