import { buildTheme, type ThemeModule } from "../shared";

/**
 * Módulo autónomo del tema: Agua y Saneamiento
 * Carpeta: src/themes/agua-y-saneamiento/
 * Ruta app: /app/temas/agua-y-saneamiento
 *
 * Cada desarrollador puede evolucionar este módulo (campos, textos, reglas)
 * sin tocar otros temas. Registre cambios solo dentro de esta carpeta.
 */
export const config = buildTheme({
  id: "agua-y-saneamiento",
  name: "Agua y Saneamiento",
  shortName: "Agua",
  description: "Proyectos de acueducto, alcantarillado y potabilización en emergencias.",
  icon: "droplets",
  unit: "beneficiarios",
  valueLabel: "Beneficiarios",
  extraFields: [
      {
        name: "tipo_intervencion",
        label: "Tipo de intervención",
        type: "select",
        required: true,
        options: [
          "Acueducto",
          "Alcantarillado",
          "Potabilización",
          "Carrotanque",
          "Kit higiene",
        ],
      },
      { name: "valor", label: "Valor (COP)", type: "number", required: true },
      { name: "beneficiarios", label: "Beneficiarios", type: "number", required: true },
    ],
});

const themeModule: ThemeModule = { config };

export default themeModule;
