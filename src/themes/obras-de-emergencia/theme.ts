import { buildThemeFromSource, type ThemeModule } from "../shared";
import { OBRAS_EMERG_CAPTURE_FORMS } from "./capture-forms";
import { SOURCE_FIELDS, SCHEMA_VERSION } from "./fields-from-source";
import { ESTADO_OBRA_OPCIONES } from "./select-options";

/**
 * Obras de Emergencia — contratos de obra + órdenes de proveeduría (O.P.).
 * Discriminador: tipo_registro.
 * Captura: formularios por capa (estilo Agua/Carrotanques) con lógica SPI/CPI del tablero SMD.
 */
const base = buildThemeFromSource({
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

export const config: ThemeModule["config"] = {
  ...base,
  fields: base.fields.map((f) => {
    if (f.name === "estado") {
      return {
        ...f,
        type: "select" as const,
        options: [...ESTADO_OBRA_OPCIONES],
      };
    }
    return f;
  }),
  captureForms: OBRAS_EMERG_CAPTURE_FORMS,
};

const themeModule: ThemeModule = { config };
export default themeModule;
