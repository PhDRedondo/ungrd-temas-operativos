import { buildTheme, type ThemeModule } from "../shared";

/**
 * Módulo autónomo del tema: Materiales
 * Carpeta: src/themes/materiales/
 * Ruta app: /app/temas/materiales
 *
 * Cada desarrollador puede evolucionar este módulo (campos, textos, reglas)
 * sin tocar otros temas. Registre cambios solo dentro de esta carpeta.
 */
export const config = buildTheme({
  id: "materiales",
  name: "Materiales",
  shortName: "Materiales",
  description: "Inventario y movimiento de materiales de respuesta.",
  icon: "package",
  unit: "unidades",
  valueLabel: "Unidades",
  extraFields: [
      { name: "item", label: "Ítem", type: "text", required: true },
      { name: "cantidad", label: "Cantidad", type: "number", required: true },
      { name: "bodega", label: "Bodega / almacén", type: "text", required: true },
      {
        name: "movimiento",
        label: "Movimiento",
        type: "select",
        required: true,
        options: ["Entrada", "Salida", "Traslado"],
      },
    ],
});

const themeModule: ThemeModule = { config };

export default themeModule;
