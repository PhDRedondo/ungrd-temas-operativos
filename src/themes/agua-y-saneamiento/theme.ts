import { buildThemeFromSource, type ThemeModule } from "../shared";
import { SOURCE_FIELDS, SCHEMA_VERSION } from "./fields-from-source";

/**
 * Agua y Saneamiento — maqueta de órdenes + bitácora de estados.
 * Discriminador: tipo_registro.
 */
export const config = buildThemeFromSource({
  id: "agua-y-saneamiento",
  name: "Agua y Saneamiento",
  shortName: "Agua",
  description:
    "Maqueta de órdenes OP, control físico (tanques/CT/vactor/M.A.), modificaciones, bitácora de estados y pagos — unidos por orden de proveeduría.",
  icon: "droplets",
  unit: "órdenes",
  valueLabel: "Órdenes",
  schemaVersion: SCHEMA_VERSION,
  sourceFields: SOURCE_FIELDS,
});

const themeModule: ThemeModule = { config };
export default themeModule;
