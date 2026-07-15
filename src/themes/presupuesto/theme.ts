import { buildTheme, type ThemeModule } from "../shared";

/**
 * Módulo autónomo del tema: Presupuesto
 * Carpeta: src/themes/presupuesto/
 * Ruta app: /app/temas/presupuesto
 *
 * Cada desarrollador puede evolucionar este módulo (campos, textos, reglas)
 * sin tocar otros temas. Registre cambios solo dentro de esta carpeta.
 */
export const config = buildTheme({
  id: "presupuesto",
  name: "Presupuesto",
  shortName: "Presupuesto",
  description: "Asignación y programación presupuestal por rubro.",
  icon: "wallet",
  unit: "millones",
  valueLabel: "Presupuesto (COP)",
  extraFields: [
      { name: "rubro", label: "Rubro", type: "text", required: true },
      {
        name: "vigencia",
        label: "Vigencia",
        type: "select",
        required: true,
        options: ["2024", "2025", "2026"],
      },
      { name: "valor", label: "Valor asignado (COP)", type: "number", required: true },
    ],
});

const themeModule: ThemeModule = { config };

export default themeModule;
