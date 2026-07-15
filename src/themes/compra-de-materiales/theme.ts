import { buildTheme, type ThemeModule } from "../shared";

/**
 * Módulo autónomo del tema: Compra de materiales
 * Carpeta: src/themes/compra-de-materiales/
 * Ruta app: /app/temas/compra-de-materiales
 *
 * Cada desarrollador puede evolucionar este módulo (campos, textos, reglas)
 * sin tocar otros temas. Registre cambios solo dentro de esta carpeta.
 */
export const config = buildTheme({
  id: "compra-de-materiales",
  name: "Compra de materiales",
  shortName: "Compra mat.",
  description: "Adquisición de materiales para respuesta y recuperación.",
  icon: "shopping-cart",
  unit: "órdenes",
  valueLabel: "Órdenes",
  extraFields: [
      { name: "material", label: "Material", type: "text", required: true },
      { name: "cantidad", label: "Cantidad", type: "number", required: true },
      { name: "proveedor", label: "Proveedor", type: "text", required: true },
      { name: "valor", label: "Valor (COP)", type: "number", required: true },
    ],
});

const themeModule: ThemeModule = { config };

export default themeModule;
