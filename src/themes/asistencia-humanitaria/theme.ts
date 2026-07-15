import { buildTheme, type ThemeModule } from "../shared";

/**
 * Módulo autónomo del tema: Asistencia Humanitaria
 * Carpeta: src/themes/asistencia-humanitaria/
 * Ruta app: /app/temas/asistencia-humanitaria
 *
 * Cada desarrollador puede evolucionar este módulo (campos, textos, reglas)
 * sin tocar otros temas. Registre cambios solo dentro de esta carpeta.
 */
export const config = buildTheme({
  id: "asistencia-humanitaria",
  name: "Asistencia Humanitaria",
  shortName: "Asist. hum.",
  description: "Entrega de ayudas humanitarias a población afectada.",
  icon: "heart-handshake",
  unit: "kits",
  valueLabel: "Kits entregados",
  extraFields: [
      {
        name: "tipo_ayuda",
        label: "Tipo de ayuda",
        type: "select",
        required: true,
        options: ["Kit de cocina", "Kit de aseo", "Kit de hábitat", "Alimento", "Frazada"],
      },
      { name: "cantidad", label: "Cantidad", type: "number", required: true },
      { name: "familias", label: "Familias beneficiadas", type: "number", required: true },
      { name: "valor", label: "Valor (COP)", type: "number", required: true },
    ],
});

const themeModule: ThemeModule = { config };

export default themeModule;
