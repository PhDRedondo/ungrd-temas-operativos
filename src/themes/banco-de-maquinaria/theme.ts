import { buildThemeFromSource, type ThemeModule } from "../shared";
import { BMAQ_CAPTURE_FORMS } from "./capture-forms";
import { SOURCE_FIELDS, SCHEMA_VERSION } from "./fields-from-source";

/**
 * Banco de Maquinaria — convenio/proceso (raíz) + detalle de equipos + bitácora + entrega.
 * Como Puentes: todo nace del convenio; las máquinas se atan después (serial).
 * Sync: `maqueta-sync.ts` (bitácora → estado convenio; entrega → ENTREGADA).
 */
export const config: ThemeModule["config"] = {
  ...buildThemeFromSource({
    id: "banco-de-maquinaria",
    name: "Banco de Maquinaria",
    shortName: "Maquinaria",
    description:
      "Convenios de adquisición, detalle de maquinaria y bitácora de seguimiento.",
    icon: "cog",
    unit: "equipos",
    valueLabel: "Equipos",
    schemaVersion: SCHEMA_VERSION,
    sourceFields: SOURCE_FIELDS,
  }),
  captureForms: BMAQ_CAPTURE_FORMS,
};

const themeModule: ThemeModule = { config };
export default themeModule;
