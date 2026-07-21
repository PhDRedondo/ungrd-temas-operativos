import { buildThemeFromSource, type ThemeModule } from "../shared";
import { SOURCE_FIELDS, SCHEMA_VERSION } from "./fields-from-source";

/**
 * Carrotanques — maqueta/inventario + bitácora de estados.
 * Discriminador: tipo_registro.
 */
export const config = buildThemeFromSource({
  id: "carrotanques",
  name: "Carrotanques",
  shortName: "Carrotanques",
  description:
    "Maqueta/inventario de carrotanques, bitácora de estados y suministro (litros/beneficiarios) — unidos por placa.",
  icon: "truck",
  unit: "unidades",
  valueLabel: "Carrotanques",
  schemaVersion: SCHEMA_VERSION,
  sourceFields: SOURCE_FIELDS,
});

const themeModule: ThemeModule = { config };
export default themeModule;
