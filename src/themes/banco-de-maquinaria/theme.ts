import { buildThemeFromSource, type ThemeModule } from "../shared";
import { SOURCE_FIELDS, SCHEMA_VERSION } from "./fields-from-source";

/**
 * Banco de Maquinaria — inventario, convenios, bitácora y entregas.
 * Discriminador: tipo_registro.
 */
export const config = buildThemeFromSource({
  id: "banco-de-maquinaria",
  name: "Banco de Maquinaria",
  shortName: "Maquinaria",
  description:
    "Inventario de maquinaria, convenios contractuales, bitácora de estados y entregas a beneficiarios — unidos por serial/convenio.",
  icon: "cog",
  unit: "equipos",
  valueLabel: "Equipos",
  schemaVersion: SCHEMA_VERSION,
  sourceFields: SOURCE_FIELDS,
});

const themeModule: ThemeModule = { config };
export default themeModule;
