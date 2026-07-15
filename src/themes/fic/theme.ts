import { buildTheme, type ThemeModule } from "../shared";

/**
 * Módulo autónomo del tema: FIC
 * Carpeta: src/themes/fic/
 * Ruta app: /app/temas/fic
 *
 * Cada desarrollador puede evolucionar este módulo (campos, textos, reglas)
 * sin tocar otros temas. Registre cambios solo dentro de esta carpeta.
 */
export const config = buildTheme({
  id: "fic",
  name: "FIC",
  shortName: "FIC",
  description: "Fondo de Inversión para la Construcción — seguimiento de recursos.",
  icon: "building-2",
  unit: "proyectos",
  valueLabel: "Proyectos FIC",
  extraFields: [
      { name: "codigo_fic", label: "Código FIC", type: "text", required: true },
      { name: "proyecto", label: "Proyecto", type: "text", required: true },
      { name: "valor", label: "Valor (COP)", type: "number", required: true },
    ],
});

const themeModule: ThemeModule = { config };

export default themeModule;
