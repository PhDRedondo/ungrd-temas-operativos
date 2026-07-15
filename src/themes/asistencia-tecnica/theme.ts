import { buildTheme, type ThemeModule } from "../shared";

/**
 * Módulo autónomo del tema: Asistencia técnica
 * Carpeta: src/themes/asistencia-tecnica/
 * Ruta app: /app/temas/asistencia-tecnica
 *
 * Cada desarrollador puede evolucionar este módulo (campos, textos, reglas)
 * sin tocar otros temas. Registre cambios solo dentro de esta carpeta.
 */
export const config = buildTheme({
  id: "asistencia-tecnica",
  name: "Asistencia técnica",
  shortName: "Asist. téc.",
  description: "Acompañamiento técnico a entidades territoriales.",
  icon: "wrench",
  unit: "asistencias",
  valueLabel: "Asistencias",
  extraFields: [
      { name: "entidad", label: "Entidad", type: "text", required: true },
      { name: "tema_asistencia", label: "Tema", type: "text", required: true },
      { name: "horas", label: "Horas", type: "number", required: true },
    ],
});

const themeModule: ThemeModule = { config };

export default themeModule;
