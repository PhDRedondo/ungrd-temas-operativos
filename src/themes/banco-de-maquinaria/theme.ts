import { buildTheme, type ThemeModule } from "../shared";

/**
 * Módulo autónomo del tema: Banco de Maquinaria
 * Carpeta: src/themes/banco-de-maquinaria/
 * Ruta app: /app/temas/banco-de-maquinaria
 *
 * Cada desarrollador puede evolucionar este módulo (campos, textos, reglas)
 * sin tocar otros temas. Registre cambios solo dentro de esta carpeta.
 */
export const config = buildTheme({
  id: "banco-de-maquinaria",
  name: "Banco de Maquinaria",
  shortName: "Maquinaria",
  description: "Disponibilidad y asignación de maquinaria amarilla.",
  icon: "cog",
  unit: "horas",
  valueLabel: "Horas máquina",
  extraFields: [
      {
        name: "equipo",
        label: "Equipo",
        type: "select",
        required: true,
        options: ["Retroexcavadora", "Bulldozer", "Volqueta", "Motoniveladora", "Cargador"],
      },
      { name: "horas", label: "Horas asignadas", type: "number", required: true },
      { name: "valor", label: "Costo (COP)", type: "number", required: true },
    ],
});

const themeModule: ThemeModule = { config };

export default themeModule;
