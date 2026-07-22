import { buildThemeFromSource, type ThemeModule } from "../shared";
import { SOURCE_FIELDS, SCHEMA_VERSION } from "./fields-from-source";

/**
 * FIC — Seguimiento y control de transferencias directas
 * (Fondo de Inversión Colectiva). Fuente: Seguimiento_FIC_2026.xlsx
 * Capas = vigencia (hoja por año). Clave: No. CDP.
 */
export const config = buildThemeFromSource({
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

const themeModule: ThemeModule = { config };

export default themeModule;
