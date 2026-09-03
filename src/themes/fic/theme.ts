import { buildThemeFromSource, type ThemeModule } from "../shared";
import { FIC_CAPTURE_FORMS, FIC_VIGENCIAS } from "./capture-forms";
import { SOURCE_FIELDS, SCHEMA_VERSION } from "./fields-from-source";
import { ESTADO_LEGALIZACION_OPCIONES } from "./select-options";

/**
 * FIC — Seguimiento y control de transferencias directas
 * (Fondo de Inversión Colectiva). Fuente: Seguimiento_FIC_2026.xlsx
 * Capas = vigencia (hoja por año). Clave: No. CDP.
 * Captura alineada a AppSheet CONTROL FIC (fic_transferencias_Form).
 */
const base = buildThemeFromSource({
  id: "fic",
  name: "FIC",
  shortName: "FIC",
  description:
    "Seguimiento y control de transferencias directas del Fondo de Inversión Colectiva (FR-1703-SMD-44) — una capa por vigencia, unidos por No. CDP.",
  icon: "building-2",
  unit: "transferencias",
  valueLabel: "Transferencias FIC",
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
        options: [...ESTADO_LEGALIZACION_OPCIONES],
      };
    }
    if (f.name === "vigencia") {
      return {
        ...f,
        type: "select" as const,
        options: [...FIC_VIGENCIAS],
      };
    }
    return f;
  }),
  captureForms: FIC_CAPTURE_FORMS,
};

const themeModule: ThemeModule = { config };

export default themeModule;
