import { buildTheme, type ThemeModule } from "../shared";

/**
 * Módulo autónomo del tema: Declaratoria de emergencia
 * Carpeta: src/themes/declaratoria-de-emergencia/
 * Ruta app: /app/temas/declaratoria-de-emergencia
 *
 * Cada desarrollador puede evolucionar este módulo (campos, textos, reglas)
 * sin tocar otros temas. Registre cambios solo dentro de esta carpeta.
 */
export const config = buildTheme({
  id: "declaratoria-de-emergencia",
  name: "Declaratoria de emergencia",
  shortName: "Declaratoria",
  description: "Registro y seguimiento de declaratorias de calamidad y emergencia.",
  icon: "siren",
  unit: "declaratorias",
  valueLabel: "Declaratorias",
  extraFields: [
      {
        name: "tipo",
        label: "Tipo",
        type: "select",
        required: true,
        options: ["Calamidad pública", "Emergencia", "Desastre", "Alerta máxima"],
      },
      { name: "acto_administrativo", label: "Acto administrativo", type: "text", required: true },
      { name: "poblacion_afectada", label: "Población afectada", type: "number", required: true },
    ],
});

const themeModule: ThemeModule = { config };

export default themeModule;
