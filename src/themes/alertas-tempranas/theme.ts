import { buildTheme, type ThemeModule } from "../shared";

/**
 * Módulo autónomo del tema: Alertas tempranas
 * Carpeta: src/themes/alertas-tempranas/
 * Ruta app: /app/temas/alertas-tempranas
 *
 * Cada desarrollador puede evolucionar este módulo (campos, textos, reglas)
 * sin tocar otros temas. Registre cambios solo dentro de esta carpeta.
 */
export const config = buildTheme({
  id: "alertas-tempranas",
  name: "Alertas tempranas",
  shortName: "Alertas",
  description: "Monitoreo y emisión de alertas tempranas territoriales.",
  icon: "bell-ring",
  unit: "alertas",
  valueLabel: "Alertas",
  extraFields: [
      {
        name: "nivel",
        label: "Nivel",
        type: "select",
        required: true,
        options: ["Amarilla", "Naranja", "Roja"],
      },
      {
        name: "amenaza",
        label: "Amenaza",
        type: "select",
        required: true,
        options: ["Inundación", "Deslizamiento", "Incendio", "Sismo", "Otro"],
      },
      { name: "poblacion_expuesta", label: "Población expuesta", type: "number", required: true },
    ],
});

const themeModule: ThemeModule = { config };

export default themeModule;
