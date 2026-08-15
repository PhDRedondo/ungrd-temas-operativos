import { buildThemeFromSource, type ThemeModule } from "../shared";
import { CARRO_CAPTURE_FORMS } from "./capture-forms";
import { SOURCE_FIELDS, SCHEMA_VERSION } from "./fields-from-source";

/**
 * Carrotanques — maqueta/inventario + bitácora + suministro, unidos por placa.
 * Sync: `maqueta-sync.ts` (M–P/T–Z ← bitácora; Q–R–S ← sum suministro).
 */
export const config: ThemeModule["config"] = {
  ...buildThemeFromSource({
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
  }),
  captureForms: CARRO_CAPTURE_FORMS,
};

const themeModule: ThemeModule = { config };
export default themeModule;
