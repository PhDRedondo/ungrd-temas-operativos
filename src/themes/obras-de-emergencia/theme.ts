import { buildThemeFromSource, type ThemeModule } from "../shared";
import { SOURCE_FIELDS, SCHEMA_VERSION } from "./fields-from-source";

/**
 * Obras de Emergencia — contratos de obra + órdenes de proveeduría (O.P.).
 * Discriminador: tipo_registro.
 */
export const config = buildThemeFromSource({
  id: "obras-de-emergencia",
  name: "Obras de Emergencia",
  shortName: "Obras emerg.",
  description:
    "Contratos de obra de emergencia y órdenes de proveeduría (maquinaria amarilla / horas máquina).",
  icon: "hard-hat",
  unit: "obras",
  valueLabel: "Obras",
  schemaVersion: SCHEMA_VERSION,
  sourceFields: SOURCE_FIELDS,
});

const themeModule: ThemeModule = { config };
export default themeModule;
