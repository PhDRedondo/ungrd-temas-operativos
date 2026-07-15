import { buildTheme, type ThemeModule } from "../shared";

/**
 * Módulo autónomo del tema: Convenios
 * Carpeta: src/themes/convenios/
 * Ruta app: /app/temas/convenios
 *
 * Cada desarrollador puede evolucionar este módulo (campos, textos, reglas)
 * sin tocar otros temas. Registre cambios solo dentro de esta carpeta.
 */
export const config = buildTheme({
  id: "convenios",
  name: "Convenios",
  shortName: "Convenios",
  description: "Convenios interadministrativos y de cooperación.",
  icon: "file-signature",
  unit: "convenios",
  valueLabel: "Convenios",
  extraFields: [
      { name: "numero", label: "Número de convenio", type: "text", required: true },
      { name: "contraparte", label: "Contraparte", type: "text", required: true },
      { name: "objeto", label: "Objeto", type: "textarea", required: true },
      { name: "valor", label: "Valor (COP)", type: "number", required: true },
    ],
});

const themeModule: ThemeModule = { config };

export default themeModule;
