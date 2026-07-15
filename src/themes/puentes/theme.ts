import { buildTheme, type ThemeModule } from "../shared";

/**
 * Módulo autónomo del tema: Puentes
 * Carpeta: src/themes/puentes/
 * Ruta app: /app/temas/puentes
 *
 * Cada desarrollador puede evolucionar este módulo (campos, textos, reglas)
 * sin tocar otros temas. Registre cambios solo dentro de esta carpeta.
 */
export const config = buildTheme({
  id: "puentes",
  name: "Puentes",
  shortName: "Puentes",
  description: "Intervención y reconstrucción de puentes vehiculares y peatonales.",
  icon: "bridge",
  unit: "puentes",
  valueLabel: "Puentes",
  extraFields: [
      {
        name: "tipo_puente",
        label: "Tipo",
        type: "select",
        required: true,
        options: ["Vehicular", "Peatonal", "Bailey", "Provisional"],
      },
      { name: "longitud_m", label: "Longitud (m)", type: "number", required: true },
      { name: "valor", label: "Inversión (COP)", type: "number", required: true },
    ],
});

const themeModule: ThemeModule = { config };

export default themeModule;
