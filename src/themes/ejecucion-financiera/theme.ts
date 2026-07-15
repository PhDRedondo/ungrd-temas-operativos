import { buildTheme, type ThemeModule } from "../shared";

/**
 * Módulo autónomo del tema: Ejecución financiera
 * Carpeta: src/themes/ejecucion-financiera/
 * Ruta app: /app/temas/ejecucion-financiera
 *
 * Cada desarrollador puede evolucionar este módulo (campos, textos, reglas)
 * sin tocar otros temas. Registre cambios solo dentro de esta carpeta.
 */
export const config = buildTheme({
  id: "ejecucion-financiera",
  name: "Ejecución financiera",
  shortName: "Ejecución",
  description: "Seguimiento de compromisos, obligaciones y pagos.",
  icon: "line-chart",
  unit: "COP",
  valueLabel: "Ejecutado (COP)",
  extraFields: [
      { name: "rubro", label: "Rubro", type: "text", required: true },
      { name: "comprometido", label: "Comprometido (COP)", type: "number", required: true },
      { name: "pagado", label: "Pagado (COP)", type: "number", required: true },
      { name: "valor", label: "Obligado (COP)", type: "number", required: true },
    ],
});

const themeModule: ThemeModule = { config };

export default themeModule;
