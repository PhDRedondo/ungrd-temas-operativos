import { buildThemeFromSource, type FormField, type ThemeModule } from "../shared";
import { FIC_CAPTURE_FORMS, FIC_VIGENCIAS } from "./capture-forms";
import { SOURCE_FIELDS, SCHEMA_VERSION } from "./fields-from-source";
import { ESTADO_LEGALIZACION_OPCIONES } from "./select-options";

/**
 * Campos de captura FIC que no vienen del Excel Seguimiento_FIC.
 * (fields-from-source intacto).
 */
const CAPTURE_ONLY_FIELDS: FormField[] = [
  { name: "fecha_cdp", label: "Fecha CDP", type: "date", excelWidth: 14 },
  { name: "fecha_rc", label: "Fecha RC", type: "date", excelWidth: 14 },
  {
    name: "plazo_final_dias",
    label: "Plazo final (días)",
    type: "number",
    excelWidth: 16,
  },
  {
    name: "fecha_final_para_legalizacion",
    label: "Fecha final para legalización",
    type: "date",
    excelWidth: 22,
  },
  {
    name: "fecha_actual",
    label: "Fecha actual",
    type: "date",
    excelWidth: 14,
  },
];

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

function withCaptureOnlyFields(fields: FormField[]): FormField[] {
  const out: FormField[] = [];
  const extras = new Map(CAPTURE_ONLY_FIELDS.map((f) => [f.name, f]));
  for (const f of fields) {
    let next = f;
    if (f.name === "plazo_ejecucion_dias") {
      next = {
        ...f,
        label: "Plazo inicial ejecución (días)",
      };
    } else if (f.name === "plazo_adicion_dias") {
      next = {
        ...f,
        type: "number" as const,
        label: "Plazo adición / prórroga (días)",
      };
    } else if (f.name === "fecha_inicial_para_legalizacion") {
      next = {
        ...f,
        label: "Fecha inicial para legalización",
      };
    } else if (f.name === "fecha_de_legalizacion_por_prorroga") {
      next = {
        ...f,
        label: "Fecha legalización por prórroga (= fecha final)",
      };
    }
    out.push(next);
    if (f.name === "no_cdp" && extras.has("fecha_cdp")) {
      out.push(extras.get("fecha_cdp")!);
      extras.delete("fecha_cdp");
    }
    if (f.name === "no_rc" && extras.has("fecha_rc")) {
      out.push(extras.get("fecha_rc")!);
      extras.delete("fecha_rc");
    }
    if (f.name === "plazo_adicion_dias" && extras.has("plazo_final_dias")) {
      out.push(extras.get("plazo_final_dias")!);
      extras.delete("plazo_final_dias");
    }
    if (
      f.name === "fecha_inicial_para_legalizacion" &&
      extras.has("fecha_final_para_legalizacion")
    ) {
      out.push(extras.get("fecha_final_para_legalizacion")!);
      extras.delete("fecha_final_para_legalizacion");
      if (extras.has("fecha_actual")) {
        out.push(extras.get("fecha_actual")!);
        extras.delete("fecha_actual");
      }
    }
  }
  for (const f of extras.values()) out.push(f);
  return out;
}

export const config: ThemeModule["config"] = {
  ...base,
  fields: withCaptureOnlyFields(base.fields).map((f) => {
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
