import { buildTheme, type ThemeModule } from "../shared";

/**
 * Módulo autónomo del tema: Obras de Emergencia
 * Carpeta: src/themes/obras-de-emergencia/
 * Ruta app: /app/temas/obras-de-emergencia
 *
 * Cada desarrollador puede evolucionar este módulo (campos, textos, reglas)
 * sin tocar otros temas. Registre cambios solo dentro de esta carpeta.
 */
export const config = buildTheme({
  id: "obras-de-emergencia",
  name: "Obras de Emergencia",
  shortName: "Obras emerg.",
  description: "Obras temporales y de estabilización ante eventos.",
  icon: "hard-hat",
  unit: "obras",
  valueLabel: "Obras",
  extraFields: [
      {
        name: "tipo_obra",
        label: "Tipo de obra",
        type: "select",
        required: true,
        options: ["Jarillón", "Descolmatación", "Estabilización", "Vía temporal", "Otra"],
      },
      { name: "valor", label: "Inversión (COP)", type: "number", required: true },
      { name: "avance", label: "Avance (%)", type: "number", required: true },
    ],
});

const themeModule: ThemeModule = { config };

export default themeModule;
