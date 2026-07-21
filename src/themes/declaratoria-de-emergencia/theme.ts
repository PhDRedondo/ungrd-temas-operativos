import { buildThemeFromSource, type ThemeModule } from "../shared";
import { SOURCE_FIELDS, SCHEMA_VERSION } from "./fields-from-source";

export const config = buildThemeFromSource({
  id: "declaratoria-de-emergencia",
  name: "Declaratoria de emergencia",
  shortName: "Declaratoria",
  description:
    "Decretos de calamidad pública: vigencia, prórrogas, retorno a normalidad y soportes (ACTA, PAE, EDAN).",
  icon: "siren",
  unit: "declaratorias",
  valueLabel: "Declaratorias",
  schemaVersion: SCHEMA_VERSION,
  sourceFields: SOURCE_FIELDS,
});

const themeModule: ThemeModule = { config };
export default themeModule;
