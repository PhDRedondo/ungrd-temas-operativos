import { buildTheme, type ThemeModule } from "../shared";

/**
 * Módulo autónomo del tema: Subsidios de Arriendos
 * Carpeta: src/themes/subsidios-de-arriendos/
 * Ruta app: /app/temas/subsidios-de-arriendos
 *
 * Cada desarrollador puede evolucionar este módulo (campos, textos, reglas)
 * sin tocar otros temas. Registre cambios solo dentro de esta carpeta.
 */
export const config = buildTheme({
  id: "subsidios-de-arriendos",
  name: "Subsidios de Arriendos",
  shortName: "Arriendos",
  description: "Apoyo de arriendo temporal a hogares damnificados.",
  icon: "home",
  unit: "hogares",
  valueLabel: "Hogares",
  extraFields: [
      { name: "documento", label: "Documento beneficiario", type: "text", required: true },
      { name: "meses", label: "Meses cubiertos", type: "number", required: true },
      { name: "valor", label: "Valor mensual (COP)", type: "number", required: true },
    ],
});

const themeModule: ThemeModule = { config };

export default themeModule;
