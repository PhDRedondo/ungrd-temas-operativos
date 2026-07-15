import { buildTheme, type ThemeModule } from "../shared";

/**
 * Módulo autónomo del tema: Carrotanques
 * Carpeta: src/themes/carrotanques/
 * Ruta app: /app/temas/carrotanques
 *
 * Cada desarrollador puede evolucionar este módulo (campos, textos, reglas)
 * sin tocar otros temas. Registre cambios solo dentro de esta carpeta.
 */
export const config = buildTheme({
  id: "carrotanques",
  name: "Carrotanques",
  shortName: "Carrotanques",
  description: "Despacho y seguimiento de carrotanques de agua potable.",
  icon: "truck",
  unit: "m³",
  valueLabel: "Volumen (m³)",
  extraFields: [
      { name: "placa", label: "Placa", type: "text", required: true },
      { name: "volumen_m3", label: "Volumen (m³)", type: "number", required: true },
      { name: "destino", label: "Sitio de descarga", type: "text", required: true },
      { name: "valor", label: "Costo (COP)", type: "number", required: true },
    ],
});

const themeModule: ThemeModule = { config };

export default themeModule;
