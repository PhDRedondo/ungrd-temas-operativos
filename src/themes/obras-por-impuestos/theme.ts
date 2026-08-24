import { buildThemeFromSource, type ThemeModule } from "../shared";
import { OBRAS_IMP_CAPTURE_FORMS } from "./capture-forms";
import { SOURCE_FIELDS, SCHEMA_VERSION } from "./fields-from-source";
import { ESTADO_CONVENIO_OPCIONES } from "./select-options";

/**
 * Obras por impuestos — convenio + interventoría (capa única).
 * Captura alineada al estilo de Obras de emergencia / tablero SMD.
 */
const base = buildThemeFromSource({
  id: "obras-por-impuestos",
  name: "Obras por impuestos",
  shortName: "Obras impuestos",
  description:
    "Convenios de obras por impuestos (contribuyente, interventoría, BPIN) desde ArcGIS.",
  icon: "landmark",
  unit: "proyectos",
  valueLabel: "Proyectos",
  schemaVersion: SCHEMA_VERSION,
  sourceFields: SOURCE_FIELDS,
});

export const config: ThemeModule["config"] = {
  ...base,
  fields: base.fields.map((f) => {
    if (f.name === "estado" || f.name === "estado_del_convenio_de_interventoria") {
      return {
        ...f,
        type: "select" as const,
        options: [...ESTADO_CONVENIO_OPCIONES],
      };
    }
    return f;
  }),
  captureForms: OBRAS_IMP_CAPTURE_FORMS,
};

const themeModule: ThemeModule = { config };
export default themeModule;
