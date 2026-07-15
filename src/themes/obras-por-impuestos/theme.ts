import { buildTheme, type ThemeModule } from "../shared";

/**
 * Módulo autónomo del tema: Obras por impuestos
 * Carpeta: src/themes/obras-por-impuestos/
 * Ruta app: /app/temas/obras-por-impuestos
 *
 * Cada desarrollador puede evolucionar este módulo (campos, textos, reglas)
 * sin tocar otros temas. Registre cambios solo dentro de esta carpeta.
 */
export const config = buildTheme({
  id: "obras-por-impuestos",
  name: "Obras por impuestos",
  shortName: "Obras impuestos",
  description: "Proyectos financiados mediante el mecanismo de obras por impuestos.",
  icon: "landmark",
  unit: "proyectos",
  valueLabel: "Proyectos",
  extraFields: [
      { name: "contribuyente", label: "Contribuyente", type: "text", required: true },
      { name: "proyecto", label: "Nombre del proyecto", type: "text", required: true },
      { name: "valor", label: "Valor aprobado (COP)", type: "number", required: true },
    ],
});

const themeModule: ThemeModule = { config };

export default themeModule;
