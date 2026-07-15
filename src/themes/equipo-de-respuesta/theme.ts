import { buildTheme, type ThemeModule } from "../shared";

/**
 * Módulo autónomo del tema: Equipo de respuesta
 * Carpeta: src/themes/equipo-de-respuesta/
 * Ruta app: /app/temas/equipo-de-respuesta
 *
 * Cada desarrollador puede evolucionar este módulo (campos, textos, reglas)
 * sin tocar otros temas. Registre cambios solo dentro de esta carpeta.
 */
export const config = buildTheme({
  id: "equipo-de-respuesta",
  name: "Equipo de respuesta",
  shortName: "Respuesta",
  description: "Despliegue y operación de equipos de respuesta inmediata.",
  icon: "users",
  unit: "misiones",
  valueLabel: "Misiones",
  extraFields: [
      {
        name: "equipo",
        label: "Equipo",
        type: "select",
        required: true,
        options: ["USAR", "Forestal", "Médico", "Logístico", "Evaluación"],
      },
      { name: "personas", label: "Integrantes", type: "number", required: true },
      { name: "dias", label: "Días en terreno", type: "number", required: true },
    ],
});

const themeModule: ThemeModule = { config };

export default themeModule;
